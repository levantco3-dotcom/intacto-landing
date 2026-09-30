const crypto = require('crypto');
const { verifyWebhookSignature, readRawBody } = require('./_lib/bold');

const META_GRAPH_VERSION = 'v21.0';

const ORDER_STATUS_QUERY = `
  query orderStatus($id: ID!) {
    order(id: $id) {
      id
      displayFinancialStatus
      email
      shippingAddress {
        firstName
        lastName
        city
        phone
      }
    }
  }
`;

const ORDER_MARK_AS_PAID_MUTATION = `
  mutation orderMarkAsPaid($input: OrderMarkAsPaidInput!) {
    orderMarkAsPaid(input: $input) {
      order {
        id
        displayFinancialStatus
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// -- Meta Conversions API: mismo patrón de hashing que api/create-order.js --

function normalizeForHash(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function normalizePhoneForHash(value) {
  return String(value || '').replace(/\D+/g, '');
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hashField(value, normalizer) {
  const normalized = (normalizer || normalizeForHash)(value);
  return normalized ? sha256Hex(normalized) : undefined;
}

async function sendMetaPurchaseEvent({ eventId, value, currency, contentId, firstName, lastName, phone, city, email }) {
  const pixelId = process.env.META_PIXEL_ID || '2177392419686177';
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    console.error('bold-webhook: faltan META_PIXEL_ID o META_CAPI_ACCESS_TOKEN, se omite el evento Purchase de servidor');
    return;
  }

  const userData = {
    em: hashField(email),
    ph: hashField(phone, normalizePhoneForHash),
    fn: hashField(firstName),
    ln: hashField(lastName),
    ct: hashField(city),
    country: hashField('co')
  };

  Object.keys(userData).forEach((key) => {
    if (userData[key] === undefined) delete userData[key];
  });

  const eventPayload = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: 'website',
    user_data: userData,
    custom_data: {
      value,
      currency,
      contents: contentId ? [{ id: contentId, quantity: 1, item_price: value }] : undefined
    }
  };

  if (!eventPayload.custom_data.contents) delete eventPayload.custom_data.contents;

  const body = { data: [eventPayload] };
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const capiResponse = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal }
    );
    const result = await capiResponse.json().catch(() => null);
    if (!capiResponse.ok) console.error('bold-webhook: Meta CAPI respuesta de error', result || capiResponse.status);
  } catch (err) {
    console.error('bold-webhook: Meta CAPI no se pudo enviar el evento Purchase', err.message || err);
  } finally {
    clearTimeout(timeout);
  }
}

async function shopifyGraphQL(query, variables) {
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

  const response = await fetch(`https://${shopDomain}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken
    },
    body: JSON.stringify({ query, variables })
  });

  return response.json();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    console.error('bold-webhook: no se pudo leer el body', err && err.message ? err.message : err);
    res.status(400).json({ error: 'Body inválido' });
    return;
  }

  const signatureHeader = req.headers['x-bold-signature'];

  let signatureValid;
  try {
    signatureValid = verifyWebhookSignature(rawBody, signatureHeader);
  } catch (err) {
    console.error('bold-webhook: excepción verificando firma', err && err.message ? err.message : err);
    res.status(500).json({ error: 'No se pudo verificar la firma' });
    return;
  }

  if (!signatureValid) {
    console.error('bold-webhook: firma inválida, se rechaza la petición');
    res.status(401).json({ error: 'Firma inválida' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    res.status(400).json({ error: 'JSON inválido' });
    return;
  }

  const eventType = payload && payload.type;

  if (eventType !== 'SALE_APPROVED') {
    // SALE_REJECTED / VOID_APPROVED / VOID_REJECTED: se registran, sin
    // acción automática — fuera del alcance de esta primera integración.
    console.log(`bold-webhook: evento ${eventType || 'desconocido'} recibido, sin acción`);
    res.status(200).json({ received: true });
    return;
  }

  const reference = payload.data && payload.data.metadata && payload.data.metadata.reference;

  if (!reference) {
    console.error('bold-webhook: SALE_APPROVED sin metadata.reference, no se puede identificar el pedido');
    res.status(200).json({ received: true, warning: 'sin referencia' });
    return;
  }

  const orderGid = `gid://shopify/Order/${reference}`;

  try {
    const statusResult = await shopifyGraphQL(ORDER_STATUS_QUERY, { id: orderGid });

    if (statusResult.errors || !statusResult.data || !statusResult.data.order) {
      console.error('bold-webhook: no se encontró la orden', reference, JSON.stringify(statusResult.errors || statusResult));
      res.status(200).json({ received: true, warning: 'orden no encontrada' });
      return;
    }

    const order = statusResult.data.order;

    if (String(order.displayFinancialStatus).toUpperCase() === 'PAID') {
      // Reintento de Bold sobre un webhook que ya procesamos: idempotente,
      // no se vuelve a marcar como pagada ni se reenvía el evento a Meta.
      res.status(200).json({ received: true, alreadyProcessed: true });
      return;
    }

    const markPaidResult = await shopifyGraphQL(ORDER_MARK_AS_PAID_MUTATION, { input: { id: orderGid } });

    if (markPaidResult.errors) {
      console.error('bold-webhook: error de GraphQL marcando la orden como pagada', JSON.stringify(markPaidResult.errors));
      res.status(500).json({ error: 'No se pudo confirmar el pago' });
      return;
    }

    const { userErrors } = markPaidResult.data.orderMarkAsPaid;

    if (userErrors && userErrors.length > 0) {
      console.error('bold-webhook: userErrors marcando la orden como pagada', JSON.stringify(userErrors));
      res.status(500).json({ error: 'No se pudo confirmar el pago' });
      return;
    }

    const amountData = payload.data.amount || {};
    const address = order.shippingAddress || {};

    await sendMetaPurchaseEvent({
      eventId: payload.id,
      value: amountData.total,
      currency: amountData.currency || 'COP',
      contentId: process.env.SHOPIFY_VARIANT_ID,
      firstName: address.firstName,
      lastName: address.lastName,
      phone: address.phone,
      city: address.city,
      email: order.email
    });

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('bold-webhook: excepción inesperada', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Excepción inesperada' });
  }
};

module.exports.config = {
  api: {
    bodyParser: false
  }
};
