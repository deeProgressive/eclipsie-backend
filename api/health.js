// api/health.js
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Token');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  return res.status(200).json({ ok: true, message: 'ok' });
}
