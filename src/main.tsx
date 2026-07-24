import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Auto-actualización: registra el service worker y revisa si hay versión nueva
// cada 60 s. En modo autoUpdate, al detectarla la aplica sola y recarga la página.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (registration) setInterval(() => { void registration.update() }, 60_000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
