const crypto = require('crypto');

// Tabla de premios y probabilidades — única fuente de verdad server-side.
// El frontend tiene su propia copia SOLO de los pesos/orden para dibujar la
// ruleta con el tamaño de segmento correcto, pero nunca decide el resultado.
const WHEEL_PRIZES = [
  { id: 'casi-ganas', label: '¡Pa\' la próxima!', weight: 40 },
  { id: 'garantia-extra', label: '5 días extra de garantía', weight: 10 },
  { id: 'prepago-5', label: '5% off pagando anticipado', weight: 30 },
  { id: 'segundo-kit-30', label: '30% en tu segundo kit', weight: 20 }
];

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora — más que suficiente para terminar un checkout
const MAX_SPINS_PER_SESSION = 2;

function getSecret() {
  const secret = process.env.WHEEL_SIGNING_SECRET;
  if (!secret) throw new Error('Falta WHEEL_SIGNING_SECRET en las variables de entorno');
  return secret;
}

function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(input) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, 'base64').toString('utf8');
}

function pickWeightedPrize() {
  const totalWeight = WHEEL_PRIZES.reduce((sum, p) => sum + p.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const prize of WHEEL_PRIZES) {
    if (roll < prize.weight) return prize;
    roll -= prize.weight;
  }

  return WHEEL_PRIZES[WHEEL_PRIZES.length - 1];
}

function signPrize(prizeId) {
  const payload = {
    prizeId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + TOKEN_TTL_MS
  };

  const payloadPart = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', getSecret()).update(payloadPart).digest('hex');

  return `${payloadPart}.${signature}`;
}

// Devuelve el prizeId si el token es válido y no expiró, o null si es
// inválido/manipulado/vencido — nunca lanza para datos de cliente malformados.
function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;

  const [payloadPart, signature] = token.split('.');
  if (!payloadPart || !signature) return null;

  let expectedSignature;
  try {
    expectedSignature = crypto.createHmac('sha256', getSecret()).update(payloadPart).digest('hex');
  } catch (err) {
    return null;
  }

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

  let payload;
  try {
    payload = JSON.parse(base64urlDecode(payloadPart));
  } catch (err) {
    return null;
  }

  if (!payload || typeof payload.prizeId !== 'string') return null;
  if (typeof payload.expiresAt !== 'number' || Date.now() > payload.expiresAt) return null;

  return payload.prizeId;
}

module.exports = { WHEEL_PRIZES, MAX_SPINS_PER_SESSION, pickWeightedPrize, signPrize, verifyToken };
