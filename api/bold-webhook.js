const crypto = require('crypto');
const { verifyWebhookSignature, readRawBody } = require('./_lib/bold');
const { kvGetJSON, kvSetJSON } = require('./_lib/kv');

const META_GRAPH_VERSION = 'v21.0';
const SECOND_KIT_PRICE_COP = '83930';
const PROCESSED_TTL_SECONDS = 2 * 24 * 60 * 60; // 2 días: cubre el último reintento de Bold (24h) con margen

const ORDER_CREATE_MUTATION = `
  mutation orderCreate($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
    orderCreate(order: $order, options: $options) {
      order {
        id
        name
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

async function sendMetaPurchaseEvent({ eventId, value, currency, contentId, nombre, telefono, ciudad, email }) {
  const pixelId = process.env.META_PIXEL_ID || '2177392419686177';
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    console.error('bold-webhook: faltan META_PIXEL_ID o META_CAPI_ACCESS_TOKEN, se omite el evento Purchase de servidor');
    return;
  }

  const nameParts = String(nombre || '').trim().split(/\s+/);
  const firstName = nameParts.shift() || '';
  const lastName = nameParts.join(' ');

  const userData = {
    em: hashField(email),
    ph: hashField(telefono, normalizePhoneForHash),
    fn: hashField(firstName),
    ln: hashField(lastName),
    ct: hashField(ciudad),
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

  const kvKey = `bold:pending:${reference}`;

  try {
    const pending = await kvGetJSON(kvKey);

    if (!pending) {
      // Vencido (pasaron los 30 min), referencia inválida, o Redis ya no
      // lo tiene por cualquier otra razón — no hay nada que crear.
      console.error('bold-webhook: no se encontró el pedido pendiente en Redis', reference);
      res.status(200).json({ received: true, warning: 'pedido pendiente no encontrado' });
      return;
    }

    if (pending.processed) {
      // Reintento de Bold sobre un webhook que ya procesamos: idempotente,
      // no se vuelve a crear la orden ni se reenvía el evento a Meta.
      res.status(200).json({ received: true, alreadyProcessed: true });
      return;
    }

    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    const variantId = process.env.SHOPIFY_VARIANT_ID;

    if (!shopDomain || !accessToken || !variantId) {
      console.error('bold-webhook: configuración de Shopify incompleta');
      res.status(500).json({ error: 'Configuración del servidor incompleta' });
      return;
    }

    const { nombre, telefono, direccion, ciudad, email, prizeIds, wonSecondKitDiscount, amount } = pending;

    const nameParts = String(nombre).trim().split(/\s+/);
    const firstName = nameParts.shift() || nombre;
    const lastName = nameParts.join(' ') || firstName;

    const lineItems = [
      { variantId: `gid://shopify/ProductVariant/${variantId}`, quantity: 1 }
    ];

    if (wonSecondKitDiscount) {
      lineItems.push({
        variantId: `gid://shopify/ProductVariant/${variantId}`,
        quantity: 1,
        priceSet: { shopMoney: { amount: SECOND_KIT_PRICE_COP, currencyCode: 'COP' } }
      });
    }

    // La orden se crea YA pagada: se registra la transacción como
    // capturada por la pasarela externa (Bold), que es la forma correcta
    // en Shopify de reflejar un pago que no pasó por Shopify Payments.
    const order = {
      lineItems,
      email,
      shippingAddress: {
        firstName,
        lastName,
        address1: direccion,
        city: ciudad,
        phone: telefono,
        countryCode: 'CO'
      },
      phone: telefono,
      financialStatus: 'PAID',
      transactions: [
        {
          kind: 'SALE',
          status: 'SUCCESS',
          gateway: 'Bold',
          amountSet: { shopMoney: { amount: String(amount), currencyCode: 'COP' } }
        }
      ]
    };

    const tags = (prizeIds || []).map((id) => `ruleta:${id}`);
    tags.push('pago:bold');
    order.tags = tags;

    if ((prizeIds || []).includes('garantia-extra')) {
      order.note = 'Premio de la ruleta: +5 días extra de garantía (20 días en total desde la entrega).';
    }

    const options = { inventoryBehaviour: 'DECREMENT_OBEYING_POLICY' };

    const createResult = await shopifyGraphQL(ORDER_CREATE_MUTATION, { order, options });

    if (createResult.errors) {
      console.error('bold-webhook: error de GraphQL creando la orden', JSON.stringify(createResult.errors));
      res.status(500).json({ error: 'No se pudo crear la orden' });
      return;
    }

    const { order: createdOrder, userErrors } = createResult.data.orderCreate;

    if (userErrors && userErrors.length > 0) {
      console.error('bold-webhook: userErrors creando la orden', JSON.stringify(userErrors));
      res.status(500).json({ error: 'No se pudo crear la orden' });
      return;
    }

    // Se marca como procesado ANTES de notificar a Meta, para que un
    // reintento de Bold que llegue mientras tanto no dispare un segundo
    // intento de creación.
    await kvSetJSON(kvKey, { ...pending, processed: true, shopifyOrderId: createdOrder.id, shopifyOrderName: createdOrder.name }, PROCESSED_TTL_SECONDS);

    const amountData = payload.data.amount || {};

    await sendMetaPurchaseEvent({
      eventId: payload.id,
      value: amountData.total || amount,
      currency: amountData.currency || 'COP',
      contentId: variantId,
      nombre,
      telefono,
      ciudad,
      email
    });

    res.status(200).json({ received: true, orderNumber: createdOrder.name });
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
