module.exports = (req, res) => {
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;

  if (!shopDomain || !clientId) {
    res.status(500).send('Faltan variables de entorno SHOPIFY_SHOP_DOMAIN o SHOPIFY_CLIENT_ID.');
    return;
  }

  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const redirectUri = `${protocol}://${host}/api/shopify/callback`;

  const state = require('crypto').randomBytes(16).toString('hex');
  const scope = 'read_orders,write_orders,read_products,read_inventory';

  const authorizeUrl =
    `https://${shopDomain}/admin/oauth/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  res.writeHead(307, {
    Location: authorizeUrl,
    'Set-Cookie': `shopify_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`
  });
  res.end();
};
