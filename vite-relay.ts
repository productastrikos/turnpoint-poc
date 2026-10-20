// Mounts the shared relay (server/relay.mjs) on the Vite dev and preview servers, same origin as the app, so local
// runs (Run TURNPOINT.bat) need no separate backend. The deployed build uses server/index.mjs instead.
import type { Plugin } from 'vite';
import { relay } from './server/relay.mjs';

type Env = Record<string, string | undefined>;

export function turnpointRelay(env: Env): Plugin {
  return {
    name: 'turnpoint-relay',
    configureServer(server) {
      server.middlewares.use(relay(env));
    },
    configurePreviewServer(server) {
      server.middlewares.use(relay(env));
    },
  };
}
