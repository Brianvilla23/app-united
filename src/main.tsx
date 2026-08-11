import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Auto-actualización: registra el service worker y busca versión nueva. Al
// encontrarla, `autoUpdate` la aplica sola y recarga la página.
//
// El chequeo NO puede colgar solo de un temporizador. En el celular la app vive
// en segundo plano y Android congela los `setInterval`, así que al volver a
// abrirla desde recientes el intervalo nunca corrió y seguía con el JavaScript
// viejo en memoria — se veía la versión anterior aunque el servidor ya tuviera
// la nueva. Por eso se revisa también cada vez que la app vuelve a primer plano,
// que es justo cuando el usuario la va a mirar.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    const revisar = () => { void registration.update() }
    setInterval(revisar, 60_000)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') revisar()
    })
    window.addEventListener('focus', revisar)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
