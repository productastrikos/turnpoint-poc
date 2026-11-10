# OQ: deployment (astrikos.xyz; internal project / host name stays `turnpoint`)

Follows `deployment_context.md` (two ports, two nginx files). Ports are the pair assigned to this POC (frontend 3339,
backend 4339; same last two digits, as the convention requires). **Check the registry before deploying, then add the row `turnpoint | 3339 | 4339 | live`.**

| Thing | Value |
| --- | --- |
| Frontend | static SPA (`dist/`), port **3339**, `https://turnpoint.astrikos.xyz:8443`, pm2 `turnpoint_3339` |
| Backend | `server/index.mjs` (Node, no extra deps), port **4339**, `https://turnpoint-api.astrikos.xyz:8443`, pm2 `turnpoint_be_4339` |

The backend is only the key-holding relay for the AI assistant (`/api/anthropic/v1/messages`) and the SAP sandbox
tab (`/api/sap/...`), plus `/api/relay/status`. REST and any websocket upgrade share the one port. There is no socket
server (the SAP / P6 stand-ins talk over a browser-side bus). Without API keys everything still works: the assistant
answers on-device and the SAP tab stays in demo mode.

## Env
- Frontend, `.env.production` (committed, no secrets): `VITE_API_URL` and `VITE_SOCKET_URL` = `https://turnpoint-api.astrikos.xyz:8443`.
  Baked in at build time, so rebuild after changing it.
- Backend, `turnpoint-poc/.env.local` on the server (git-ignored): `ANTHROPIC_API_KEY`, `SAP_API_KEY` (both optional),
  `CORS_ORIGIN=https://turnpoint.astrikos.xyz:8443` (recommended; default is `*`), `RATE_LIMIT_PER_MIN` (default 60).
  `PORT` is passed on the pm2 command. The server listens on 127.0.0.1 only; nginx is the public face.
- Anyone who can reach the API URL can spend the Anthropic key (rate limited per IP, not authenticated). Leave
  `ANTHROPIC_API_KEY` unset on the server if that is not acceptable; the demo then runs on the on-device assistant.

## Login
Sign-in is switched off: the app opens straight away as the TA Event Manager (see `src/App.tsx`). The login screen
(`src/app/LoginPage.tsx`, demo password in `src/app/auth.ts`) is kept for when it is needed again. Use the "View as" switch in
the top bar to see the other roles. The role gate is a demo, **not security**: do not put real data behind it.
The UI has an English / Arabic switch (shell only, see README > Language); the Arabic font is bundled, no CDN.
The SAP and P6 stand-ins (`/ext/sap`, `/ext/p6`, `/ext/split`) and the SAP side-by-side dock are routes of the same SPA, so the
`-s` (single-page fallback) flag on `serve` is required.

## Commands
Prerequisites on the server: Node 20.12+, and `npm i -g pm2 serve` once.
```bash
git clone https://github.com/productastrikos/turnpoint-poc.git turnpoint && cd turnpoint

# Frontend
npm install && npm run build                       # tsc -b + vite build -> dist/
pm2 start serve --name "turnpoint_3339" -- ./dist -s -p 3339

# Backend (needs Node 20.12+; create .env.local first if you want the keys)
PORT=4339 pm2 start server/index.mjs --name "turnpoint_be_4339"

pm2 save
```
Update: `git pull && npm install && npm run build && pm2 restart turnpoint_3339 turnpoint_be_4339`.

## nginx
`/etc/nginx/conf/astrikos.conf` (frontend):
```nginx
server {
    listen 8443 ssl;
    ssl_certificate     /etc/certs/astrikos.xyz/fullchain.pem;
    ssl_certificate_key /etc/certs/astrikos.xyz/privkey.pem;
    server_name turnpoint.astrikos.xyz;
    location / {
        add_header 'Access-Control-Allow-Origin' '*' always;
        proxy_pass http://127.0.0.1:3339;
    }
}
```

`/etc/nginx/conf/astriverse.conf` (backend; the `map $http_upgrade $connection_upgrade {...}` is already at the top of that file):
```nginx
server {
    listen 8443 ssl;
    ssl_certificate     /etc/certs/astrikos.xyz/fullchain.pem;
    ssl_certificate_key /etc/certs/astrikos.xyz/privkey.pem;
    server_name turnpoint-api.astrikos.xyz;
    location / {
        proxy_pass http://127.0.0.1:4339;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
        proxy_buffering off;
    }
}
```
The assistant streams (SSE), which is why `proxy_buffering off` matters. Apply: `sudo nginx -t && sudo systemctl reload nginx`.

## Cloudflare DNS
- `turnpoint.astrikos.xyz` -> **Orange**
- `turnpoint-api.astrikos.xyz` -> **Gray** (DNS-only)

## Verify
```bash
curl -k https://turnpoint.astrikos.xyz:8443                       # SPA HTML
curl -k https://turnpoint-api.astrikos.xyz:8443/                  # {"service":"turnpoint-backend","ok":true,...}
curl -k https://turnpoint-api.astrikos.xyz:8443/api/relay/status  # {"anthropic":false|true,...}
```
Then open the frontend (it opens straight into the app), click **SAP side by side**, and ask the assistant a question (badge shows Live AI or On-device AI).
