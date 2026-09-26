const crypto = require('crypto');

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

const META_GRAPH_VERSION = 'v21.0';

// -- Meta Conversions API: utilidades de hashing --------------------------

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

// -- Meta Conversions API: envío del evento Purchase -----------------------
// Nunca debe bloquear ni tumbar la creación de la orden: cualquier error se
// registra en consola del servidor y se ignora para la respuesta al cliente.
async function sendMetaPurchaseEvent({
  eventId,
  eventSourceUrl,
  value,
  currency,
  contentId,
  nombre,
  telefono,
  direccion,
  ciudad,
  clientIp,
  clientUserAgent
}) {
  // El Pixel ID no es secreto (ya va expuesto en el snippet del cliente), así
  // que se puede fijar como fallback aquí; META_PIXEL_ID en el entorno lo
  // sobreescribe si se define.
  const pixelId = process.env.META_PIXEL_ID || '2177392419686177';
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    console.error('Meta CAPI: faltan META_PIXEL_ID o META_CAPI_ACCESS_TOKEN, se omite el evento Purchase de servidor');
    return;
  }

  const nameParts = String(nombre || '').trim().split(/\s+/);
  const firstName = nameParts.shift() || '';
  const lastName = nameParts.join(' ');

  const userData = {
    ph: hashField(telefono, normalizePhoneForHash),
    fn: hashField(firstName),
    ln: hashField(lastName),
    ct: hashField(ciudad),
    country: hashField('co'),
    client_ip_address: clientIp || undefined,
    client_user_agent: clientUserAgent || undefined
  };

  // direccion (calle) no tiene un campo estándar de user_data en Meta CAPI
  // (solo ct/st/zp/country están soportados como geo), así que no se manda.
  void direccion;

  Object.keys(userData).forEach((key) => {
    if (userData[key] === undefined) delete userData[key];
  });

  const eventPayload = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    event_source_url: eventSourceUrl,
    action_source: 'website',
    user_data: userData,
    custom_data: {
      value,
      currency,
      contents: contentId ? [{ id: contentId, quantity: 1, item_price: value }] : undefined
    }
  };

  if (!eventPayload.custom_data.contents) delete eventPayload.custom_data.contents;

  const body = {
    data: [eventPayload]
  };

  // Para pruebas en Meta Events Manager → Test Events, define
  // META_TEST_EVENT_CODE como variable de entorno opcional; si no existe
  // simplemente no se manda.
  if (process.env.META_TEST_EVENT_CODE) {
    body.test_event_code = process.env.META_TEST_EVENT_CODE;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const capiResponse = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      }
    );

    const result = await capiResponse.json().catch(() => null);

    if (!capiResponse.ok) {
      console.error('Meta CAPI: respuesta de error', result || capiResponse.status);
    }
  } catch (err) {
    console.error('Meta CAPI: no se pudo enviar el evento Purchase', err.message || err);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Método no permitido' });
    return;
  }

  const { nombre, telefono, direccion, ciudad, eventId, eventSourceUrl } = req.body || {};

  if (!nombre || !telefono || !direccion || !ciudad) {
    res.status(400).json({ success: false, error: 'Faltan datos del formulario' });
    return;
  }

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  const variantId = process.env.SHOPIFY_VARIANT_ID;

  if (!shopDomain || !accessToken || !variantId) {
    res.status(500).json({ success: false, error: 'Configuración del servidor incompleta' });
    return;
  }

  const nameParts = String(nombre).trim().split(/\s+/);
  const firstName = nameParts.shift() || nombre;
  const lastName = nameParts.join(' ') || firstName;

  const order = {
    lineItems: [
      {
        variantId: `gid://shopify/ProductVariant/${variantId}`,
        quantity: 1
      }
    ],
    shippingAddress: {
      firstName,
      lastName,
      address1: direccion,
      city: ciudad,
      phone: telefono,
      countryCode: 'CO'
    },
    phone: telefono,
    financialStatus: 'PENDING'
  };

  // inventoryBehaviour vive en OrderCreateOptionsInput (argumento "options",
  // hermano de "order" en la mutación) — NO es un campo de
  // OrderCreateOrderInput. Sin esto, Shopify usa BYPASS por default y el
  // pedido nunca descuenta inventario, sin importar el financialStatus.
  // DECREMENT_OBEYING_POLICY aplica el descuento respetando la política de
  // "seguir vendiendo sin stock" que tenga configurada cada variante —
  // independiente de si el pago es COD (PENDING) o anticipado.
  const options = {
    inventoryBehaviour: 'DECREMENT_OBEYING_POLICY'
  };

  try {
    const shopifyResponse = await fetch(`https://${shopDomain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify({
        query: ORDER_CREATE_MUTATION,
        variables: { order, options }
      })
    });

    const result = await shopifyResponse.json();

    if (result.errors) {
      console.error('create-order: error de GraphQL de Shopify', JSON.stringify(result.errors));
      res.status(502).json({ success: false, error: result.errors[0].message });
      return;
    }

    const { order: createdOrder, userErrors } = result.data.orderCreate;

    if (userErrors && userErrors.length > 0) {
      console.error('create-order: userErrors de orderCreate', JSON.stringify(userErrors));
      res.status(422).json({ success: false, error: userErrors[0].message });
      return;
    }

    // La orden ya se confirmó en Shopify en este punto: recién aquí, nunca
    // antes, se dispara la Purchase de Meta CAPI. Si falla, no afecta la
    // orden ni la respuesta al cliente (ver try/catch interno de la función).
    const forwardedFor = req.headers['x-forwarded-for'];
    const clientIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : (forwardedFor || '').split(',')[0].trim() || req.socket.remoteAddress;

    await sendMetaPurchaseEvent({
      eventId,
      eventSourceUrl,
      value: 119900,
      currency: 'COP',
      contentId: variantId,
      nombre,
      telefono,
      direccion,
      ciudad,
      clientIp,
      clientUserAgent: req.headers['user-agent']
    });

    res.status(200).json({ success: true, orderNumber: createdOrder.name });
  } catch (err) {
    console.error('create-order: excepción inesperada', err && err.message ? err.message : err);
    res.status(500).json({ success: false, error: 'No se pudo crear la orden' });
  }
};
