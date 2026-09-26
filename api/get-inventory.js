const VARIANT_INVENTORY_QUERY = `
  query getVariantInventory($id: ID!) {
    productVariant(id: $id) {
      inventoryQuantity
    }
  }
`;

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido' });
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

      const hasAccessDenied = Array.isArray(result.errors) &&
        result.errors.some((e) => e.extensions && e.extensions.code === 'ACCESS_DENIED');

      if (hasAccessDenied) {
        // Diagnóstico: si Shopify rechaza por scope, confirmamos en el log
        // cuáles scopes tiene REALMENTE el token que está corriendo ahora
        // mismo, para no tener que adivinar si el token en Vercel quedó
        // desactualizado tras una re-autorización.
        try {
          const scopesResponse = await fetch(`https://${shopDomain}/admin/oauth/access_scopes.json`, {
            headers: { 'X-Shopify-Access-Token': accessToken }
          });
          const scopesResult = await scopesResponse.json();
          console.error('get-inventory: scopes reales del SHOPIFY_ACCESS_TOKEN actual', JSON.stringify(scopesResult));
        } catch (scopeErr) {
          console.error('get-inventory: no se pudo verificar los scopes del token', scopeErr.message || scopeErr);
        }
      }

      res.status(502).json({ error: 'No se pudo obtener el inventario' });
      return;
    }

    const available = Math.max(0, result.data.productVariant.inventoryQuantity || 0);
    res.status(200).json({ available });
  } catch (err) {
    console.error('get-inventory: excepción al consultar Shopify', err);
    res.status(500).json({ error: 'No se pudo obtener el inventario' });
  }
};
