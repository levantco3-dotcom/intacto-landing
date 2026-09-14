function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderPage({ title, body }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #F0EAE0; color: #1A1714; padding: 40px 20px; max-width: 640px; margin: 0 auto; line-height: 1.6; }
  h1 { font-size: 1.5rem; }
  code, .token-box { display: block; background: #FAF7F3; border: 1px solid #E2D9CC; border-radius: 6px; padding: 16px; word-break: break-all; font-family: monospace; font-size: 0.95rem; margin: 16px 0; }
  .error { color: #B5763A; font-weight: bold; }
  ol { padding-left: 20px; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

module.exports = async (req, res) => {
  const { code, state, error } = req.query || {};

  if (error) {
    res.status(400).send(renderPage({
      title: 'Error de autorización',
      body: `<h1 class="error">Shopify rechazó la autorización</h1><p>${escapeHtml(error)}</p>`
    }));
    return;
  }

  if (!code) {
    res.status(400).send(renderPage({
      title: 'Falta el código',
      body: `<h1 class="error">Falta el parámetro "code"</h1><p>Visita /api/shopify/install primero.</p>`
    }));
    return;
  }

  const cookies = req.headers.cookie || '';
  const cookieState = (cookies.match(/shopify_oauth_state=([^;]+)/) || [])[1];
  if (!state || !cookieState || state !== cookieState) {
    res.status(400).send(renderPage({
      title: 'Estado inválido',
      body: `<h1 class="error">El parámetro "state" no coincide</h1><p>Por seguridad, vuelve a iniciar el flujo desde /api/shopify/install.</p>`
    }));
    return;
  }

  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!shopDomain || !clientId || !clientSecret) {
    res.status(500).send(renderPage({
      title: 'Faltan variables de entorno',
      body: `<h1 class="error">Faltan SHOPIFY_SHOP_DOMAIN, SHOPIFY_CLIENT_ID o SHOPIFY_CLIENT_SECRET</h1>`
    }));
    return;
  }

  try {
    const tokenResponse = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code
      })
    });

    const data = await tokenResponse.json();

    if (!tokenResponse.ok || !data.access_token) {
      res.status(502).send(renderPage({
        title: 'Error al obtener el token',
        body: `<h1 class="error">Shopify no devolvió un access_token</h1><pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`
      }));
      return;
    }

    res.setHeader('Set-Cookie', 'shopify_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
    res.status(200).send(renderPage({
      title: 'Token de acceso generado',
      body: `
        <h1>Conexión con Shopify autorizada</h1>
        <p>Copia este token y agrégalo como variable de entorno <strong>SHOPIFY_ACCESS_TOKEN</strong> en Vercel, luego redeploya.</p>
        <code class="token-box">${escapeHtml(data.access_token)}</code>
        <ol>
          <li>Ve a tu proyecto en Vercel &rarr; Settings &rarr; Environment Variables.</li>
          <li>Crea <strong>SHOPIFY_ACCESS_TOKEN</strong> con el valor de arriba.</li>
          <li>Redeploya el proyecto.</li>
          <li>Este token no se vuelve a mostrar. Guárdalo antes de salir de esta página.</li>
        </ol>
      `
    }));
  } catch (err) {
    res.status(500).send(renderPage({
      title: 'Error inesperado',
      body: `<h1 class="error">Error al comunicarse con Shopify</h1><pre>${escapeHtml(err.message)}</pre>`
    }));
  }
};
