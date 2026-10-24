// Elegir el punto del aviso en un mapa, como en Uber o inDriver: el pin queda
// fijo al centro de la pantalla y se mueve el mapa debajo hasta dejarlo sobre
// el lugar del trabajo (24-10-2026, pedido de Brayan).
//
// Leaflet se carga recién al abrir el mapa (no pesa en el arranque). Las
// imágenes del mapa necesitan señal: sin señal el mapa sale gris, pero el
// botón "Mi ubicación" (GPS) funciona igual.
import { useEffect, useRef, useState } from 'react'
import type { Map as MapaLeaflet, TileLayer } from 'leaflet'
import type { Ubicacion } from './types'

/** Si no hay GPS ni punto previo, el mapa parte en la desaladora de Coloso. */
const COLOSO = { lat: -23.7615, lng: -70.4655 }

const CAPAS = {
  // En Coloso Esri tiene imágenes hasta el nivel 17; del 18 en adelante solo
  // devuelve el cartel "Map data not yet available". Se pide el 17 y Leaflet
  // lo amplía al acercar más.
  satelite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    atribucion: 'Imágenes © Esri',
    nativo: 17,
  },
  mapa: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    atribucion: '© OpenStreetMap',
    nativo: 19,
  },
}

export default function MapaUbicacion({
  inicial, onListo, onCerrar,
}: {
  inicial?: Ubicacion
  onListo: (u: Ubicacion) => void
  onCerrar: () => void
}) {
  const caja = useRef<HTMLDivElement>(null)
  const mapa = useRef<MapaLeaflet | null>(null)
  const capa = useRef<TileLayer | null>(null)
  const [centro, setCentro] = useState(inicial ?? COLOSO)
  const [vista, setVista] = useState<keyof typeof CAPAS>('satelite')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    let vivo = true
    void (async () => {
      const L = await import('leaflet')
      await import('leaflet/dist/leaflet.css')
      if (!vivo || !caja.current) return
      const m = L.map(caja.current, { zoomControl: true, attributionControl: true })
        .setView([centro.lat, centro.lng], inicial ? 18 : 16)
      mapa.current = m
      m.attributionControl.setPrefix('Leaflet')
      capa.current = L.tileLayer(CAPAS.satelite.url, {
        maxZoom: 19, maxNativeZoom: CAPAS.satelite.nativo, attribution: CAPAS.satelite.atribucion,
      }).addTo(m)
      m.on('move', () => { const c = m.getCenter(); setCentro({ lat: c.lat, lng: c.lng }) })
      if (!navigator.onLine) setAviso('Sin señal el mapa no carga. Usa «Mi ubicación» (GPS) o vuelve a intentarlo con señal.')
    })()
    return () => { vivo = false; mapa.current?.remove(); mapa.current = null }
    // el mapa se crea una sola vez; el centro se sigue con el evento 'move'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cambiarVista = async (v: keyof typeof CAPAS) => {
    setVista(v)
    const L = await import('leaflet')
    if (!mapa.current) return
    capa.current?.remove()
    capa.current = L.tileLayer(CAPAS[v].url, {
      maxZoom: 19, maxNativeZoom: CAPAS[v].nativo, attribution: CAPAS[v].atribucion,
    }).addTo(mapa.current)
  }

  const irAMiUbicacion = () => {
    if (!navigator.geolocation) { setAviso('Este teléfono no entrega el GPS al navegador.'); return }
    setAviso('Buscando tu ubicación…')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setAviso('')
        mapa.current?.setView([p.coords.latitude, p.coords.longitude], 18)
      },
      (e) => setAviso(e.code === e.PERMISSION_DENIED
        ? 'Permite la ubicación para esta página en los ajustes del navegador.'
        : 'No se pudo obtener la ubicación. Sal a un lugar abierto y vuelve a intentarlo.'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  return (
    <div className="mapa-overlay">
      <div className="mapa-top">
        <b>Marca el lugar del trabajo</b>
        <button className="modal-x" onClick={onCerrar} aria-label="Cerrar">✕</button>
      </div>
      <div className="mapa-caja">
        <div ref={caja} className="mapa-leaflet" />
        {/* el pin fijo al centro: se mueve el mapa, no el pin */}
        <div className="mapa-pin" aria-hidden>
          <svg viewBox="0 0 24 36" width="34" height="50">
            <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#c00000" />
            <circle cx="12" cy="12" r="4.6" fill="#fff" />
          </svg>
        </div>
        <div className="mapa-vistas">
          <button className={vista === 'satelite' ? 'on' : ''} onClick={() => void cambiarVista('satelite')}>Satélite</button>
          <button className={vista === 'mapa' ? 'on' : ''} onClick={() => void cambiarVista('mapa')}>Mapa</button>
        </div>
      </div>
      {aviso && <p className="mapa-aviso">{aviso}</p>}
      <p className="mapa-coord">{centro.lat.toFixed(6)}, {centro.lng.toFixed(6)}</p>
      <div className="mapa-acciones">
        <button className="btn" onClick={irAMiUbicacion}>📍 Mi ubicación</button>
        <button className="btn primary" onClick={() => onListo({ lat: centro.lat, lng: centro.lng, fuente: 'mapa' })}>
          Confirmar este punto
        </button>
      </div>
    </div>
  )
}
