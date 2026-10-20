import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { turnpointRelay } from './vite-relay.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Server-side only: ANTHROPIC_API_KEY / SAP_API_KEY from .env.local reach the relay, never the client bundle.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), turnpointRelay(env)],
    // Pinned ports so several demos can run side by side (see workspace rules).
    server: { port: 5173, strictPort: true },
    preview: { port: 5173, strictPort: true },
  }
})
