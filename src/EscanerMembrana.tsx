// La cámara leyendo el código de barras de la etiqueta de la membrana.
//
// El lector NO se reescribió: es el mismo `lector.js` del escáner de membranas
// de United, que ya está afinado para estas etiquetas — decodifica cuadro a
// cuadro con BarcodeDetector nativo y con ZXing de respaldo, y prueba el canal
// rojo además del de luminancia, porque la "G2" naranja impresa sobre las
// barras borra la lectura normal. Se carga recién al abrir la cámara: son
// 350 KB que no tienen por qué pesar en cada arranque de la app.
import { useEffect, useRef, useState } from 'react'

interface OpcionesLector {
  video: HTMLVideoElement
  mira?: HTMLElement | null
  onCodigo: (texto: string, formato: string) => void
  onEstado?: (texto: string) => void
}

interface InfoLector {
  linterna: boolean
  zoom: { min: number; max: number; step: number; valor: number } | null
  camaras: number
  resolucion: string
  motor: string
}

interface ApiLector {
  iniciar: (o: OpcionesLector) => Promise<InfoLector>
  detener: () => void
  siguienteCamara: () => Promise<void>
  linterna: (on: boolean) => Promise<void>
  olvidarUltimo: () => void
  decodificarImagen: (archivo: File) => Promise<{ texto: string; formato: string } | null>
}

declare global {
  interface Window { LECTOR?: ApiLector }
}

const BASE = import.meta.env.BASE_URL

function cargarScript(src: string): Promise<void> {
  return new Promise((listo, falla) => {
    const ya = document.querySelector(`script[data-src="${src}"]`)
    if (ya) {
      if (ya.getAttribute('data-listo')) return listo()
      ya.addEventListener('load', () => listo())
      ya.addEventListener('error', () => falla(new Error(src)))
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.dataset.src = src
    s.onload = () => { s.dataset.listo = '1'; listo() }
    s.onerror = () => falla(new Error(src))
    document.head.appendChild(s)
  })
}

async function cargarLector(): Promise<ApiLector> {
  if (!window.LECTOR) {
    // ZXing primero: `lector.js` lo usa apenas arranca en los equipos sin
    // BarcodeDetector (iPhone, Windows, Firefox).
    await cargarScript(`${BASE}vendor/zxing.js`)
    await cargarScript(`${BASE}vendor/lector.js`)
  }
  if (!window.LECTOR) throw new Error('No se pudo cargar el lector de códigos.')
  return window.LECTOR
}

/** Lo que contesta el dueño del escáner después de cada lectura: si la tomó y
    qué mostrarle a quien está escaneando. */
export interface Respuesta {
  ok: boolean
  /** "Listo · posición 7 — sigue la 6", o el motivo del rechazo. */
  mensaje: string
}

export default function EscanerMembrana({
  titulo, onCodigo, onCerrar,
}: {
  titulo: string
  onCodigo: (texto: string, formato: string) => Respuesta
  onCerrar: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const miraRef = useRef<HTMLDivElement>(null)
  const [estado, setEstado] = useState('Preparando la cámara…')
  const [error, setError] = useState('')
  const [destello, setDestello] = useState(false)
  // el cartel grande que confirma la lectura y dice cuál viene
  const [cartel, setCartel] = useState<Respuesta | null>(null)
  const [info, setInfo] = useState<InfoLector | null>(null)
  const [luz, setLuz] = useState(false)
  // el callback vive en un ref: el lector se inicia una sola vez y no puede
  // quedarse con una versión vieja de la función
  const cb = useRef(onCodigo)
  cb.current = onCodigo

  // el temporizador del cartel, para poder cancelarlo: escaneando rápido, el
  // temporizador de la lectura anterior borraba el cartel de la siguiente
  const borrarCartel = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(borrarCartel.current), [])

  /** Una lectura, venga de la cámara o de una foto: avisa y deja el cartel. */
  const procesar = (texto: string, formato: string) => {
    const r = cb.current(texto, formato)
    setCartel(r)
    window.clearTimeout(borrarCartel.current)
    // el rechazo queda más rato: hay que alcanzar a leer por qué
    borrarCartel.current = window.setTimeout(() => setCartel(null), r.ok ? 1800 : 3000)
    if (navigator.vibrate) navigator.vibrate(r.ok ? 60 : [60, 70, 60])
    if (!r.ok) return
    setDestello(true)
    setTimeout(() => setDestello(false), 600)
  }
  const procesarRef = useRef(procesar)
  procesarRef.current = procesar

  useEffect(() => {
    let vivo = true
    let api: ApiLector | null = null
    void (async () => {
      try {
        api = await cargarLector()
        if (!vivo || !videoRef.current) return
        const i = await api.iniciar({
          video: videoRef.current,
          mira: miraRef.current,
          onEstado: (t) => { if (vivo) setEstado(t) },
          onCodigo: (texto, formato) => procesarRef.current(texto, formato),
        })
        if (vivo) setInfo(i)
      } catch (e) {
        if (vivo) setError(e instanceof Error ? e.message : 'No se pudo abrir la cámara.')
      }
    })()
    return () => { vivo = false; api?.detener() }
  }, [])

  const porFoto = async (archivo: File | undefined) => {
    if (!archivo || !window.LECTOR) return
    setEstado('Leyendo la foto…')
    const r = await window.LECTOR.decodificarImagen(archivo)
    if (r) { procesar(r.texto, r.formato); setEstado('Apunte al código de barras') }
    else setEstado('No se pudo leer el código en esa foto. Prueba con más luz o más cerca.')
  }

  return (
    <div className="escaner-overlay">
      <div className="escaner-top">
        <b>{titulo}</b>
        <button className="modal-x" onClick={onCerrar}>✕</button>
      </div>

      <div className={'escaner-cam' + (destello ? ' leido' : '')}>
        <video ref={videoRef} playsInline muted autoPlay />
        <div className="escaner-mira" ref={miraRef} />
        {cartel && (
          <div className={'escaner-cartel' + (cartel.ok ? '' : ' malo')}>
            <b>{cartel.ok ? '✔ LISTO' : '✕ NO SE TOMÓ'}</b>
            <span>{cartel.mensaje}</span>
          </div>
        )}
        <div className="escaner-msj">{error || estado}</div>
      </div>

      <div className="escaner-acciones">
        {info?.linterna && (
          <button className="btn sm ghost" onClick={() => { setLuz(!luz); void window.LECTOR?.linterna(!luz) }}>
            {luz ? '💡 Apagar luz' : '💡 Luz'}
          </button>
        )}
        {(info?.camaras ?? 0) > 1 && (
          <button className="btn sm ghost" onClick={() => void window.LECTOR?.siguienteCamara()}>
            🔄 Otra cámara
          </button>
        )}
        <label className="btn sm ghost">
          📷 Desde una foto
          <input
            type="file" accept="image/*" capture="environment" hidden
            onChange={(e) => void porFoto(e.target.files?.[0])}
          />
        </label>
      </div>

      <p className="hint escaner-pie">
        Apunta al código de barras de la etiqueta. Si no lee, acércate o enciende la luz.
        {info && <> · {info.resolucion} · {info.motor}</>}
      </p>
    </div>
  )
}
