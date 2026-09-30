const crypto = require('crypto');

function getSecretKey() {
  const secret = process.env.BOLD_SECRET_KEY;
  if (!secret) throw new Error('Falta BOLD_SECRET_KEY en las variables de entorno');
  return secret;
}

// Firma de integridad del botón de pagos: SHA256 de la concatenación exacta
// {orderId}{amount}{currency}{secretKey}, sin separadores. El orden importa.
function computeSignature({ orderId, amount, currency }) {
  const raw = `${orderId}${amount}${currency}${getSecretKey()}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Verificación del webhook: HMAC-SHA256 con BOLD_SECRET_KEY sobre el body
// crudo codificado en base64, comparado en hex contra el header
// x-bold-signature. Nunca se confía en JSON re-serializado: tiene que ser
// exactamente el body tal como Bold lo mandó.
function verifyWebhookSignature(rawBodyBuffer, headerSignature) {
  if (!headerSignature || typeof headerSignature !== 'string') return false;

  const base64Body = rawBodyBuffer.toString('base64');
  const expected = crypto.createHmac('sha256', getSecretKey()).update(base64Body).digest('hex');

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(headerSignature);
  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = { computeSignature, verifyWebhookSignature, readRawBody };
