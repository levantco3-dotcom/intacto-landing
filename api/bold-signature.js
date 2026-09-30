const { computeSignature } = require('./_lib/bold');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const { orderId, amount, currency } = req.body || {};

  if (!orderId || typeof orderId !== 'string') {
    res.status(400).json({ error: 'Falta orderId' });
    return;
  }

  const amountNumber = Number(amount);
  if (!Number.isFinite(amountNumber) || amountNumber < 1000 || !Number.isInteger(amountNumber)) {
    res.status(400).json({ error: 'amount inválido (entero, mínimo 1000 COP)' });
    return;
  }

  if (currency !== 'COP' && currency !== 'USD') {
    res.status(400).json({ error: 'currency inválida' });
    return;
  }

  try {
    const signature = computeSignature({ orderId, amount: amountNumber, currency });
    res.status(200).json({ signature });
  } catch (err) {
    console.error('bold-signature: excepción inesperada', err && err.message ? err.message : err);
    res.status(500).json({ error: 'No se pudo generar la firma' });
  }
};
