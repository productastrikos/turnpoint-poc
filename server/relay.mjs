// The relay for the two calls TURNPOINT makes to the outside world. One implementation, mounted two ways:
//   - dev / preview: as Vite middleware (vite-relay.ts)
//   - deployed:      as the standalone backend (server/index.mjs, one port for everything)
//   /api/anthropic/v1/messages  ->  Anthropic Messages API, with ANTHROPIC_API_KEY added here (the assistant)
//   /api/sap/<service>/<entity> ->  SAP Business Accelerator Hub sandbox (S/4HANA Cloud OData), with SAP_API_KEY added here
//   /api/relay/status           ->  which of the two are configured (never the keys)
// Keys are read from .env.local / the environment, stay in this Node process and never reach the browser.
// Only those paths and methods are forwarded. Plain ESM JavaScript so pm2 can run it on any recent Node.
import { Readable } from 'node:stream';

export const ASSISTANT_MODEL = 'claude-opus-5-5';
const ANTHROPIC = 'https://api.anthropic.com';
const SAP_SANDBOX = 'https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap';
// SAP services the demo reads (API_MAINTNOTIFICATION, API_MAINTENANCEORDER, equipment / functional location masters)
const SAP_SERVICES = /^\/(API_MAINTNOTIFICATION|API_MAINTENANCEORDER|API_EQUIPMENT|API_FUNCTIONALLOCATION_SRV)\/[A-Za-z_]+/;
const MAX_BODY = 2 * 1024 * 1024;

class TooLarge extends Error {}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) throw new TooLarge('Request body too large');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(data));
}

async function pipe(upstream, res) {
  res.statusCode = upstream.status;
  for (const h of ['content-type', 'request-id', 'retry-after', 'anthropic-ratelimit-requests-remaining']) {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  }
  if (!upstream.body) return res.end();
  Readable.fromWeb(upstream.body).pipe(res); // streams SSE through as it arrives
}

/** Fixed-window limiter per client IP, so a public deployment cannot be used to burn the API key. */
function limiter(perMinute) {
  const hits = new Map();
  return (req) => {
    const fwd = req.headers['x-forwarded-for'];
    const ip = (typeof fwd === 'string' && fwd.split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const e = hits.get(ip);
    if (!e || now - e.start > 60_000) {
      hits.set(ip, { start: now, n: 1 });
      if (hits.size > 5000) for (const [k, v] of hits) if (now - v.start > 60_000) hits.delete(k);
      return true;
    }
    e.n += 1;
    return e.n <= perMinute;
  };
}

/**
 * Builds the connect-style middleware `(req, res, next)`.
 * Env: ANTHROPIC_API_KEY, SAP_API_KEY, CORS_ORIGIN (comma list, default "*"), RATE_LIMIT_PER_MIN (default 60).
 * With `cors: true` (standalone backend, cross-origin from the frontend subdomain) it also answers preflights.
 */
export function relay(env, { cors = false } = {}) {
  const get = (k) => env[k] || process.env[k];
  const anthropicKey = () => get('ANTHROPIC_API_KEY');
  const sapKey = () => get('SAP_API_KEY');
  const allowed = (get('CORS_ORIGIN') || '*').split(',').map((s) => s.trim()).filter(Boolean);
  const allow = limiter(Number(get('RATE_LIMIT_PER_MIN')) || 60);

  function setCors(req, res) {
    const origin = req.headers.origin;
    if (allowed.includes('*')) res.setHeader('access-control-allow-origin', '*');
    else if (origin && allowed.includes(origin)) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('vary', 'Origin');
    }
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    res.setHeader('access-control-allow-headers', req.headers['access-control-request-headers'] || 'content-type');
    res.setHeader('access-control-max-age', '86400');
  }

  return async (req, res, next) => {
    const url = req.url ?? '';
    if (!url.startsWith('/api/')) return next();
    if (cors) {
      setCors(req, res);
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        return res.end();
      }
    }
    try {
      if (url === '/api/relay/status') {
        return json(res, 200, { anthropic: Boolean(anthropicKey()), model: ASSISTANT_MODEL, sap: Boolean(sapKey()) });
      }

      if (url.startsWith('/api/anthropic/')) {
        const path = url.slice('/api/anthropic'.length).split('?')[0];
        if (req.method !== 'POST' || path !== '/v1/messages') return json(res, 404, { error: 'Only POST /v1/messages is relayed' });
        const key = anthropicKey();
        if (!key) return json(res, 503, { type: 'error', error: { type: 'not_configured', message: 'ANTHROPIC_API_KEY is not set for the relay (add it to the backend .env.local and restart)' } });
        if (!allow(req)) return json(res, 429, { type: 'error', error: { type: 'rate_limited', message: 'Too many assistant requests, try again in a minute' } });
        const headers = { 'content-type': 'application/json', 'x-api-key': key };
        for (const h of ['anthropic-version', 'anthropic-beta', 'accept']) {
          const v = req.headers[h];
          if (typeof v === 'string') headers[h] = v;
        }
        const upstream = await fetch(`${ANTHROPIC}${path}`, { method: 'POST', headers, body: new Uint8Array(await body(req)) });
        return pipe(upstream, res);
      }

      if (url.startsWith('/api/sap/')) {
        const rest = url.slice('/api/sap'.length);
        if (req.method !== 'GET' || !SAP_SERVICES.test(rest)) return json(res, 404, { error: 'Only GET reads of the maintenance services are relayed' });
        const key = (typeof req.headers['x-sap-key'] === 'string' && req.headers['x-sap-key']) || sapKey();
        if (!key) return json(res, 503, { error: { message: 'SAP_API_KEY is not set (add it to the backend .env.local, or paste it in Integration Hub > SAP sandbox)' } });
        if (!allow(req)) return json(res, 429, { error: { message: 'Too many requests, try again in a minute' } });
        const upstream = await fetch(`${SAP_SANDBOX}${rest}`, { headers: { APIKey: key, Accept: 'application/json' } });
        return pipe(upstream, res);
      }
      return next();
    } catch (err) {
      if (err instanceof TooLarge) return json(res, 413, { type: 'error', error: { type: 'too_large', message: err.message } });
      return json(res, 502, { type: 'error', error: { type: 'relay_error', message: err instanceof Error ? err.message : 'Relay request failed' } });
    }
  };
}
