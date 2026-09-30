const { WHEEL_PRIZES, pickWeightedPrize, signPrize } = require('./_lib/wheel-token');

const SPIN_COOKIE = 'intacto_wheel_spun';

function hasSpunCookie(req) {
  const cookieHeader = req.headers.cookie || '';
  return cookieHeader.split(';').some((part) => part.trim().startsWith(`${SPIN_COOKIE}=`));
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

  if (hasSpunCookie(req)) {
    res.status(409).json({ error: 'already_spun' });
    return;
  }

  const prize = pickWeightedPrize();
  const token = signPrize(prize.id);

  // HttpOnly: el frontend no puede leer ni falsificar esta cookie desde la
  // consola de devtools, a diferencia de sessionStorage.
  res.setHeader(
    'Set-Cookie',
    `${SPIN_COOKIE}=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24}`
  );

  res.status(200).json({
    prizeId: prize.id,
    label: prize.label,
    token,
    // El frontend usa esto SOLO para dibujar los segmentos a escala real;
    // el sorteo ya ocurrió arriba, esto no vuelve a decidir nada.
    weights: WHEEL_PRIZES.map((p) => ({ id: p.id, label: p.label, weight: p.weight }))
  });
};
