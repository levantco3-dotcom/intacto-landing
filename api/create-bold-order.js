const crypto = require('crypto');
const { verifyToken } = require('./_lib/wheel-token');
const { kvSetJSON } = require('./_lib/kv');

const SECOND_KIT_PRICE_COP = '83930'; // $119.900 con 30% off, como string per MoneyBagInput
const PENDING_TTL_SECONDS = 30 * 60; // 30 minutos para completar el pago en Bold

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

  const boldApiKey = process.env.BOLD_IDENTITY_KEY;

  if (!boldApiKey || !process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    res.status(500).json({ success: false, error: 'Configuración del servidor incompleta' });
    return;
  }

  // Mismo criterio que create-order.js: el premio nunca se confía a lo que
  // mande el cliente, cada token se vuelve a verificar acá.
  const prizeIds = Array.isArray(wheelTokens)
    ? Array.from(new Set(wheelTokens.map((t) => verifyToken(t)).filter(Boolean)))
    : [];

  const wonSecondKitDiscount = prizeIds.includes('segundo-kit-30') && wantsSecondKit === true;
  const amount = wonSecondKitDiscount ? 119900 + Number(SECOND_KIT_PRICE_COP) : 119900;

  // La orden en Shopify NO se crea acá. Solo se guarda temporalmente en
  // Redis (Upstash) lo necesario para crearla cuando llegue la
  // confirmación real de Bold por webhook — así nunca aparece un pedido
  // en Shopify (ni su notificación de venta) mientras el cliente todavía
  // no pagó nada.
  const reference = crypto.randomBytes(16).toString('hex'); // 32 chars, alfanumérico, cumple el límite de Bold

  const pendingOrder = {
    nombre,
    telefono,
    direccion,
    ciudad,
    email,
    prizeIds,
    wonSecondKitDiscount,
    amount,
    processed: false,
    createdAt: Date.now()
  };

  try {
    await kvSetJSON(`bold:pending:${reference}`, pendingOrder, PENDING_TTL_SECONDS);

    res.status(200).json({
      success: true,
      orderId: reference,
      amount,
      currency: 'COP',
      apiKey: boldApiKey
    });
  } catch (err) {
    console.error('create-bold-order: excepción inesperada', err && err.message ? err.message : err);
    res.status(500).json({ success: false, error: 'No se pudo preparar el pago' });
  }
};
