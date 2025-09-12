// api/birth-chart.js
// Minimal Vercel proxy for Prokerala Astrology API
// Accepts POST JSON with: { datetime, coordinates | {lat, lon}, ayanamsa?, house_system?, la?, path? }
// If 'path' is omitted, defaults to '/v2/astrology/planet-position'.
// Returns upstream JSON as-is.

const ALLOWED_PATHS = new Set([
  '/v2/astrology/planet-position',
  '/v2/astrology/natal-planet-position',
  '/v2/astrology/natal-chart',
  '/v2/astrology/natal-aspect-chart',
]);

let cachedToken = null;
let tokenExpiresAt = 0;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Token');
}

async function getAccessToken() {
  const { PROKERALA_CLIENT_ID, PROKERALA_CLIENT_SECRET } = process.env;
  const TOKEN_URL = process.env.TOKEN_URL || 'https://api.prokerala.com/token';
  if (!PROKERALA_CLIENT_ID || !PROKERALA_CLIENT_SECRET) {
    throw new Error('Missing PROKERALA_CLIENT_ID or PROKERALA_CLIENT_SECRET');
  }
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: PROKERALA_CLIENT_ID,
    client_secret: PROKERALA_CLIENT_SECRET,
  });
  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const reason = data.error_description || data.error || resp.statusText;
    throw new Error(`Token error: ${reason}`);
  }
  const token = data.access_token || data.accessToken;
  const expiresIn = Number(data.expires_in || 3600);
  if (!token) throw new Error('No access_token in token response');
  cachedToken = token;
  tokenExpiresAt = Date.now() + expiresIn * 1000;
  return token;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const { APP_TOKEN } = process.env;
    if (APP_TOKEN) {
      const headerToken = req.headers['x-app-token'];
      if (!headerToken || headerToken !== APP_TOKEN) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }
    }

    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      return res.status(400).json({ ok: false, error: 'Content-Type must be application/json' });
    }

    const body = req.body ?? await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => {
        try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); }
      });
      req.on('error', reject);
    });

    let { datetime, coordinates, lat, lon, la, ayanamsa, house_system, birth_time_unknown, orb, birth_time_rectification, aspect_filter, path } = body || {};

    if (!coordinates && (lat != null && lon != null)) {
      coordinates = `${lat},${lon}`;
    }
    if (!datetime || !coordinates) {
      return res.status(400).json({ ok: false, error: 'Missing required fields: datetime and coordinates' });
    }

    const BASE_URL = process.env.BASE_URL || 'https://api.prokerala.com';
    const defaultPath = process.env.BIRTH_CHART_PATH || '/v2/astrology/planet-position';
    const finalPath = path ? (path.startsWith('/v2/') ? path : `/v2/${path.replace(/^\//, '')}`) : defaultPath;
    if (!ALLOWED_PATHS.has(finalPath)) {
      return res.status(400).json({ ok: false, error: `Unsupported path. Allowed: ${Array.from(ALLOWED_PATHS).join(', ')}` });
    }

    const qs = new URLSearchParams();
    qs.set('datetime', String(datetime));
    qs.set('coordinates', String(coordinates));
    if (la) qs.set('la', String(la));
    if (ayanamsa != null) qs.set('ayanamsa', String(ayanamsa)); // 1=Lahiri, 3=Raman, 5=KP
    if (house_system) qs.set('house_system', String(house_system));
    if (birth_time_unknown != null) qs.set('birth_time_unknown', String(birth_time_unknown));
    if (orb) qs.set('orb', String(orb));
    if (birth_time_rectification) qs.set('birth_time_rectification', String(birth_time_rectification));
    if (aspect_filter) qs.set('aspect_filter', String(aspect_filter));

    const url = `${BASE_URL}${finalPath}?${qs.toString()}`;

    const token = await getAccessToken();
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const text = await upstream.text();
    const isJson = upstream.headers.get('content-type')?.includes('application/json');
    if (!upstream.ok) {
      let errPayload;
      try { errPayload = JSON.parse(text); } catch { errPayload = { error: text || upstream.statusText }; }
      return res.status(upstream.status).json({ ok: false, upstream_status: upstream.status, ...errPayload });
    }
    if (isJson) {
      const json = JSON.parse(text);
      return res.status(200).json(json);
    } else {
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/plain');
      return res.status(200).send(text);
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Internal Server Error' });
  }
}
