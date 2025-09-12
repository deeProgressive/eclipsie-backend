# Eclipsie Vercel Proxy (Prokerala)

Minimal proxy to call Prokerala Astrology API from your app without exposing secrets.

## Files
- `api/health.js` — basic health check (`/api/health` → `{ ok: true }`)
- `api/birth-chart.js` — proxy to Prokerala (`/api/birth-chart`)

## Environment Variables (Vercel → Project → Settings → Environment Variables)
- `PROKERALA_CLIENT_ID` — from Prokerala dashboard
- `PROKERALA_CLIENT_SECRET` — from Prokerala dashboard
- (optional) `BASE_URL` — default `https://api.prokerala.com`
- (optional) `TOKEN_URL` — default `https://api.prokerala.com/token`
- (optional) `BIRTH_CHART_PATH` — default `/v2/astrology/planet-position`
- (optional) `APP_TOKEN` — any long random string; if set, requests must include header `x-app-token: <value>`

## How to Deploy
1. Create a new project on Vercel (Framework preset: "Other").
2. Upload these files (or push to a Git repo and import).
3. Add env vars above → Redeploy.
4. Test: open `/api/health` → should return `{ ok: true }`.

## How to Call from Flutter (example)
POST `/api/birth-chart` with JSON:
{
  "datetime": "2004-02-12T15:19:21+05:30",
  "lat": 40.7143,
  "lon": -74.006,
  "la": "en",
  "ayanamsa": 1
}
If you want a different Prokerala endpoint, pass `"path": "/v2/astrology/natal-planet-position"` or `"path": "/v2/astrology/natal-aspect-chart"`.
Allowed paths are enforced for safety.
