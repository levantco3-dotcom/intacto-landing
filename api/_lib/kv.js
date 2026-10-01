// Cliente mínimo para la API REST de Upstash Redis — sin SDK, un fetch
// más, igual que el resto de las integraciones de este proyecto. Usa las
// variables KV_REST_API_URL / KV_REST_API_TOKEN que Vercel inyecta al
// conectar la integración de Upstash desde el Marketplace.

function getConfig() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Faltan KV_REST_API_URL o KV_REST_API_TOKEN en las variables de entorno');
  return { url, token };
}

async function runCommand(command) {
  const { url, token } = getConfig();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(`Upstash error: ${data.error || response.status}`);
  }

  return data.result;
}

// Guarda un objeto (serializado a JSON) con expiración en segundos.
async function kvSetJSON(key, value, ttlSeconds) {
  await runCommand(['SET', key, JSON.stringify(value), 'EX', String(ttlSeconds)]);
}

// Devuelve el objeto guardado, o null si no existe/expiró.
async function kvGetJSON(key) {
  const raw = await runCommand(['GET', key]);
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

module.exports = { kvSetJSON, kvGetJSON };
