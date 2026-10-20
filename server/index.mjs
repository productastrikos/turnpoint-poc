// Standalone TURNPOINT backend for the astrikos.xyz deployment: REST (and any future websocket upgrade) on ONE port.
//   PORT=4339 pm2 start server/index.mjs --name turnpoint_be_4339
// Reads PORT (required in production), HOST (default 127.0.0.1, nginx proxies to it), ANTHROPIC_API_KEY, SAP_API_KEY,
// CORS_ORIGIN, RATE_LIMIT_PER_MIN. Secrets come from server/.env or .env.local (both git-ignored) or the process env.
import { createServer } from 'node:http';
import { relay, ASSISTANT_MODEL } from './relay.mjs';

for (const f of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(f); // Node 20.12+; values already in the environment win
  } catch {
    /* file absent: fine */
  }
}

const PORT = Number(process.env.PORT) || 4339;
const HOST = process.env.HOST || '127.0.0.1';
const handle = relay(process.env, { cors: true });

const server = createServer((req, res) => {
  handle(req, res, () => {
    res.setHeader('content-type', 'application/json');
    res.setHeader('access-control-allow-origin', process.env.CORS_ORIGIN?.split(',')[0]?.trim() || '*');
    if (req.url === '/' || req.url === '/health') {
      res.end(JSON.stringify({ service: 'turnpoint-backend', ok: true, model: ASSISTANT_MODEL, anthropic: Boolean(process.env.ANTHROPIC_API_KEY), sap: Boolean(process.env.SAP_API_KEY) }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });
});

server.listen(PORT, HOST, () => console.log(`turnpoint backend listening on http://${HOST}:${PORT}`));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
