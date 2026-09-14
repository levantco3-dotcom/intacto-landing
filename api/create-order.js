const ORDER_CREATE_MUTATION = `
  mutation orderCreate($order: OrderCreateOrderInput!) {
    orderCreate(order: $order) {
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

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Método no permitido' });
    return;
  }

  const { nombre, telefono, direccion, ciudad } = req.body || {};

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

  try {
    const shopifyResponse = await fetch(`https://${shopDomain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify({
        query: ORDER_CREATE_MUTATION,
        variables: { order }
      })
    });

    const result = await shopifyResponse.json();

    if (result.errors) {
      res.status(502).json({ success: false, error: result.errors[0].message });
      return;
    }

    const { order: createdOrder, userErrors } = result.data.orderCreate;

    if (userErrors && userErrors.length > 0) {
      res.status(422).json({ success: false, error: userErrors[0].message });
      return;
    }

    res.status(200).json({ success: true, orderNumber: createdOrder.name });
  } catch (err) {
    res.status(500).json({ success: false, error: 'No se pudo crear la orden' });
  }
};
