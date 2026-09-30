const { WHEEL_PRIZES, MAX_SPINS_PER_SESSION, pickWeightedPrize, signPrize } = require('./_lib/wheel-token');

const SPIN_COOKIE = 'intacto_wheel_spins';

function getSpinsUsed(req) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.split(';').find((part) => part.trim().startsWith(`${SPIN_COOKIE}=`));
  if (!match) return 0;

  const raw = match.split('=')[1];
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  if (!process.env.WHEEL_SIGNING_SECRET) {
    res.status(500).json({ error: 'Configuración del servidor incompleta' });
    return;
  }

  const spinsUsed = getSpinsUsed(req);

  if (spinsUsed >= MAX_SPINS_PER_SESSION) {
    res.status(409).json({ error: 'no_spins_left' });
    return;
  }

  const prize = pickWeightedPrize();
  const token = signPrize(prize.id);
  const spinsUsedNow = spinsUsed + 1;

  // HttpOnly: el frontend no puede leer ni falsificar esta cookie desde la
  // consola de devtools, a diferencia de sessionStorage. Guarda un CONTADOR,
  // no un booleano, para permitir hasta MAX_SPINS_PER_SESSION giros reales.
  res.setHeader(
    'Set-Cookie',
    `${SPIN_COOKIE}=${spinsUsedNow}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24}`
  );

  res.status(200).json({
    prizeId: prize.id,
    label: prize.label,
    token,
    spinsUsed: spinsUsedNow,
    spinsRemaining: Math.max(0, MAX_SPINS_PER_SESSION - spinsUsedNow),
    // El frontend usa esto SOLO para dibujar los segmentos a escala real;
    // el sorteo ya ocurrió arriba, esto no vuelve a decidir nada.
    weights: WHEEL_PRIZES.map((p) => ({ id: p.id, label: p.label, weight: p.weight }))
  });
};
