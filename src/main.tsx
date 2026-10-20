import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Fonts are bundled (no CDN), so the demo looks identical offline.
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/astrikos.css'
import './styles/login.css'

// Theme is applied before first paint so there is no flash; dark is the default.
try {
  document.documentElement.setAttribute('data-theme', localStorage.getItem('turnpoint-theme') === 'light' ? 'light' : 'dark')
} catch {
  document.documentElement.setAttribute('data-theme', 'dark')
}
import App from './App.tsx'
import { AuthProvider } from './app/AuthContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
