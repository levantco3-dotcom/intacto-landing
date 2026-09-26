const VARIANT_INVENTORY_QUERY = `
  query getVariantInventory($id: ID!) {
    productVariant(id: $id) {
      inventoryQuantity
    }
  }
`;

const CACHE_TTL_MS = 45000;

// Cache en memoria del proceso: evita golpear la Admin API de Shopify en
// cada carga de página. Vive mientras la instancia serverless siga tibia
// (se reinicia en cold start), pero en la práctica cubre la gran mayoría
// de las visitas dentro de la ventana de 45s.
let cachedPayload = null;
let cachedAt = 0;

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  if (cachedPayload && Date.now() - cachedAt < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 'public, max-age=45');
    res.status(200).json(cachedPayload);
    return;
  }

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  const variantId = process.env.SHOPIFY_VARIANT_ID;

  if (!shopDomain || !accessToken || !variantId) {
    res.status(500).json({ error: 'Configuración del servidor incompleta' });
    return;
  }

  try {
    const shopifyResponse = await fetch(`https://${shopDomain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify({
        query: VARIANT_INVENTORY_QUERY,
        variables: { id: `gid://shopify/ProductVariant/${variantId}` }
      })
    });

    const result = await shopifyResponse.json();

    if (result.errors || !result.data || !result.data.productVariant) {
      console.error('get-inventory: respuesta inesperada de Shopify', JSON.stringify(result.errors || result));
      res.status(502).json({ error: 'No se pudo obtener el inventario' });
      return;
    }

    const available = Math.max(0, result.data.productVariant.inventoryQuantity || 0);
    const payload = { available };

    cachedPayload = payload;
    cachedAt = Date.now();

    res.setHeader('Cache-Control', 'public, max-age=45');
    res.status(200).json(payload);
  } catch (err) {
    console.error('get-inventory: excepción al consultar Shopify', err);
    res.status(500).json({ error: 'No se pudo obtener el inventario' });
  }
};
