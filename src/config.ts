// Backend base URL for the relay (assistant + SAP sandbox). Empty in local dev: the Vite dev/preview server mounts the
// relay on the same origin. In the deployed build it comes from .env.production (VITE_API_URL), never hardcoded.
export const API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
