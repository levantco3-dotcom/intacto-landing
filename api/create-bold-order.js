const crypto = require('crypto');
const { verifyToken } = require('./_lib/wheel-token');
const { kvSetJSON } = require('./_lib/kv');

const KIT_PRICE_COP = 119900;
const SECOND_KIT_PRICE_COP = 83930; // $119.900 con 30% off de la ruleta
const PENDING_TTL_SECONDS = 30 * 60; // 30 minutos para completar el pago en Bold
const PHONE_REGEX = /^\d{10}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Método no permitido' });
    return;
  }

  const {
    nombre,
    apellidos,
    telefono,
    direccion,
    direccion2,
    departamento,
    ciudad,
    email,
    wheelTokens,
    wantsSecondKit
  } = req.body || {};

  if (!nombre || !apellidos || !telefono || !direccion || !direccion2 || !departamento || !ciudad || !email) {
    res.status(400).json({ success: false, error: 'Faltan datos del formulario' });
    return;
  }

  if (!PHONE_REGEX.test(telefono)) {
    res.status(400).json({ success: false, error: 'El WhatsApp debe tener exactamente 10 dígitos, sin indicativo' });
    return;
  }

  if (!EMAIL_REGEX.test(email)) {
    res.status(400).json({ success: false, error: 'El correo electrónico no es válido' });
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

  // Descuento por pagar con Bold: 5% automático para cualquiera que pague
  // así (tarjeta/Nequi/Bre-B), sin importar la ruleta. Si además ganó el
  // premio "5% off pago ya" de la ruleta, se ACUMULA (10% total) — es
  // intencional, no son mutuamente excluyentes.
  let boldDiscountRate = 0.05;
  if (prizeIds.includes('prepago-5')) boldDiscountRate += 0.05;
  const boldFactor = 1 - boldDiscountRate;

  const kitPrice = Math.round(KIT_PRICE_COP * boldFactor);
  const secondKitPrice = wonSecondKitDiscount ? Math.round(SECOND_KIT_PRICE_COP * boldFactor) : 0;
  const amount = kitPrice + secondKitPrice;

  // La orden en Shopify NO se crea acá. Solo se guarda temporalmente en
  // Redis (Upstash) lo necesario para crearla cuando llegue la
  // confirmación real de Bold por webhook — así nunca aparece un pedido
  // en Shopify (ni su notificación de venta) mientras el cliente todavía
  // no pagó nada.
  const reference = crypto.randomBytes(16).toString('hex'); // 32 chars, alfanumérico, cumple el límite de Bold

  const pendingOrder = {
    nombre,
    apellidos,
    telefono,
    direccion,
    direccion2,
    departamento,
    ciudad,
    email,
    prizeIds,
    wonSecondKitDiscount,
    kitPrice,
    secondKitPrice,
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
