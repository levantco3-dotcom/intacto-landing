const { verifyToken } = require('./_lib/wheel-token');

const SECOND_KIT_PRICE_COP = '83930'; // $119.900 con 30% off, como string per MoneyBagInput

const DRAFT_ORDER_CREATE_MUTATION = `
  mutation draftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
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

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Método no permitido' });
    return;
  }

  const { nombre, telefono, direccion, ciudad, email, wheelTokens, wantsSecondKit } = req.body || {};

  if (!nombre || !telefono || !direccion || !ciudad || !email) {
    res.status(400).json({ success: false, error: 'Faltan datos del formulario' });
    return;
  }

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  const variantId = process.env.SHOPIFY_VARIANT_ID;
  const boldApiKey = process.env.BOLD_IDENTITY_KEY;

  if (!shopDomain || !accessToken || !variantId || !boldApiKey) {
    res.status(500).json({ success: false, error: 'Configuración del servidor incompleta' });
    return;
  }

  // Mismo criterio que create-order.js: el premio nunca se confía a lo que
  // mande el cliente, cada token se vuelve a verificar acá.
  const prizeIds = Array.isArray(wheelTokens)
    ? Array.from(new Set(wheelTokens.map((t) => verifyToken(t)).filter(Boolean)))
    : [];

  const wonSecondKitDiscount = prizeIds.includes('segundo-kit-30') && wantsSecondKit === true;

  const nameParts = String(nombre).trim().split(/\s+/);
  const firstName = nameParts.shift() || nombre;
  const lastName = nameParts.join(' ') || firstName;

  const lineItems = [
    {
      variantId: `gid://shopify/ProductVariant/${variantId}`,
      quantity: 1
    }
  ];

  if (wonSecondKitDiscount) {
    lineItems.push({
      variantId: `gid://shopify/ProductVariant/${variantId}`,
      quantity: 1,
      originalUnitPrice: SECOND_KIT_PRICE_COP // Decimal en la unidad mayor de la moneda (COP no tiene centavos)
    });
  }

  const input = {
    lineItems,
    email,
    shippingAddress: {
      firstName,
      lastName,
      address1: direccion,
      city: ciudad,
      phone: telefono,
      countryCode: 'CO'
    }
  };

  const tags = ['bold-pendiente'];
  prizeIds.forEach((id) => tags.push(`ruleta:${id}`));
  input.tags = tags;

  if (prizeIds.includes('garantia-extra')) {
    input.note = 'Premio de la ruleta: +5 días extra de garantía (20 días en total desde la entrega).';
  }

  const amount = wonSecondKitDiscount ? 119900 + Number(SECOND_KIT_PRICE_COP) : 119900;

  try {
    const shopifyResponse = await fetch(`https://${shopDomain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify({
        query: DRAFT_ORDER_CREATE_MUTATION,
        variables: { input }
      })
    });

    const result = await shopifyResponse.json();

    if (result.errors) {
      console.error('create-bold-draft-order: error de GraphQL de Shopify', JSON.stringify(result.errors));
      res.status(502).json({ success: false, error: result.errors[0].message });
      return;
    }

    const { draftOrder, userErrors } = result.data.draftOrderCreate;

    if (userErrors && userErrors.length > 0) {
      console.error('create-bold-draft-order: userErrors de draftOrderCreate', JSON.stringify(userErrors));
      res.status(422).json({ success: false, error: userErrors[0].message });
      return;
    }

    // Bold exige un order-id alfanumérico de máx 60 caracteres: se usa
    // solo la parte numérica del GID del draft order (ej. "123456789"),
    // que alcanza para reconstruir el GID completo cuando llegue el webhook.
    const numericId = draftOrder.id.split('/').pop();

    res.status(200).json({
      success: true,
      orderId: numericId,
      amount,
      currency: 'COP',
      apiKey: boldApiKey
    });
  } catch (err) {
    console.error('create-bold-draft-order: excepción inesperada', err && err.message ? err.message : err);
    res.status(500).json({ success: false, error: 'No se pudo preparar el pago' });
  }
};
