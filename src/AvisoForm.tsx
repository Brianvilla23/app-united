import { hoyISO as hoyChile } from './util'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { db, generarFolio } from './db'
import { compartirPDFAviso, enlaceMapa } from './pdf'
import { encolar, avisoARow } from './sync'
import { quienSoy } from './identidad'
import { ZONAS, TIPOS_AVISO, PRIORIDADES } from './types'
import type { Aviso, MaterialItem, Prioridad, Ubicacion } from './types'
import { CATALOGO, MAESTRO, MODOS_FALLA, PLANTAS_RO } from './catalogo'

// el mapa (Leaflet) se carga recién al abrirlo
const MapaUbicacion = lazy(() => import('./MapaUbicacion'))

// --- zonas que no están en la lista (24-10-2026) ---
// Se escriben una vez y quedan guardadas en el celular para la próxima.
const CLAVE_ZONAS = 'united_zonas_extra'
const OTRA = '__otra__'
function zonasExtra(): string[] {
  try { return JSON.parse(localStorage.getItem(CLAVE_ZONAS) ?? '[]') as string[] } catch { return [] }
}
function recordarZona(z: string) {
  const limpia = z.trim()
  if (!limpia || ZONAS.includes(limpia)) return
  const extra = zonasExtra()
  if (extra.some((x) => x.toLowerCase() === limpia.toLowerCase())) return
  try { localStorage.setItem(CLAVE_ZONAS, JSON.stringify([...extra, limpia].slice(-30))) } catch { /* sin espacio */ }
}

const sinTildes = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** La planta del catálogo de repuestos que corresponde a la zona, si se puede saber. */
function plantaDeZona(zona: string): string {
  return /planta 0|p0/i.test(zona) ? 'Planta 0' : /ewse|planta 4/i.test(zona) ? 'EWSE' : 'EWS'
}

// El dictado del navegador (Chrome) funciona por internet y, si nadie lo
// cierra, puede quedar escuchando para siempre: se corta solo a los 60 s.
const TOPE_DICTADO_MS = 60_000
type Reconocedor = {
  lang: string; interimResults: boolean; continuous: boolean
  start: () => void; stop: () => void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
const MENSAJE_DICTADO: Record<string, string> = {
  'not-allowed': 'Permite el micrófono para esta página (toca el candado de la barra de direcciones → Micrófono).',
  'service-not-allowed': 'Permite el micrófono para esta página (toca el candado de la barra de direcciones → Micrófono).',
  network: 'El dictado necesita señal: el reconocimiento de voz de Chrome funciona por internet. Sin señal, usa el micrófono del teclado.',
  'no-speech': 'No se escuchó nada. Toca «Dictar» y habla cerca del teléfono.',
  'audio-capture': 'No se encontró el micrófono del teléfono.',
}

const hoyISO = () => hoyChile()

function uuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c && typeof c.randomUUID === 'function') {
    try { return c.randomUUID() } catch { /* contexto no seguro (http en celular) */ }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    const v = ch === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function mejorarRedaccion(t: string): string {
  let s = t.trim().replace(/\s+/g, ' ')
  if (!s) return s
  s = s.replace(/(^|[.!?]\s+)([a-záéíóúñü])/g, (_, p, c) => p + c.toUpperCase())
  if (!/[.!?]$/.test(s)) s += '.'
  return s
}

function fileToJpeg(file: File, maxSize = 1200, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let { width, height } = img
      if (width > height && width > maxSize) { height = (height * maxSize) / width; width = maxSize }
      else if (height > maxSize) { width = (width * maxSize) / height; height = maxSize }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = url
  })
}

const vacio = {
  titulo: '', tipo: TIPOS_AVISO[0], prioridad: 'Media' as Prioridad, zona: '', equipo: '',
  descripcion: '', modoFalla: '', dotacion: 1, horas: 1, detencion: false,
  fechaTrabajo: hoyISO(), hse: '', correoRespaldo: '',
}

export default function AvisoForm({ onSaved }: { onSaved: () => void }) {
  const [f, setF] = useState({ ...vacio })
  const [materiales, setMateriales] = useState<MaterialItem[]>([])
  const [fotos, setFotos] = useState<string[]>([])
  const [folio, setFolio] = useState('…')
  const [errores, setErrores] = useState<string[]>([])
  const [zonaOtra, setZonaOtra] = useState(false)
  const [extras, setExtras] = useState<string[]>(zonasExtra)
  const [ubicacion, setUbicacion] = useState<Ubicacion | null>(null)
  const [buscandoGps, setBuscandoGps] = useState(false)
  const [avisoUbic, setAvisoUbic] = useState('')
  const [mapaAbierto, setMapaAbierto] = useState(false)
  const [escuchando, setEscuchando] = useState(false)
  const [avisoDictado, setAvisoDictado] = useState('')
  const reconocedor = useRef<Reconocedor | null>(null)
  const topeDictado = useRef<number | undefined>(undefined)
  const [planta, setPlanta] = useState('EWS')
  const [buscaMat, setBuscaMat] = useState('')
  const [enviando, setEnviando] = useState(false)

  // al salir de la pantalla, el micrófono no queda abierto
  useEffect(() => () => { reconocedor.current?.stop(); window.clearTimeout(topeDictado.current) }, [])

  useEffect(() => { generarFolio().then(setFolio) }, [])

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  /** Repuestos del modo de falla para la planta, desde el catálogo SAP real. */
  const repuestosDe = (codigo: string, pl: string): MaterialItem[] =>
    MAESTRO.filter((r) => r.mf === codigo && r.planta === pl)
      .map((r) => ({ nombre: r.componente, codigoSap: r.sap, cantidad: r.cantidad || 1 }))

  const onModoFalla = (codigo: string) => {
    set('modoFalla', codigo)
    if (codigo) setMateriales(repuestosDe(codigo, planta))
  }

  const onPlanta = (pl: string) => {
    setPlanta(pl)
    // si los materiales vienen del modo de falla, se cambian a los de la planta
    if (f.modoFalla) setMateriales(repuestosDe(f.modoFalla, pl))
  }

  const agregarDelCatalogo = (sap: string) => {
    const c = CATALOGO.find((x) => x.sap === sap)
    if (!c) return
    setMateriales((p) => {
      const i = p.findIndex((m) => m.codigoSap === c.sap)
      if (i >= 0) return p.map((m, j) => (j === i ? { ...m, cantidad: m.cantidad + 1 } : m))
      return [...p, { nombre: c.nombre.replace(/\s+/g, ' ').trim(), codigoSap: c.sap, cantidad: 1 }]
    })
    setBuscaMat('')
  }

  const resultadosMat = buscaMat.trim().length < 2 ? [] : (() => {
    const palabras = sinTildes(buscaMat).split(/\s+/).filter(Boolean)
    return CATALOGO
      .filter((c) => palabras.every((w) => sinTildes(`${c.nombre} ${c.sap} ${c.conjunto}`).includes(w)))
      .sort((a, b) => Number(b.planta === planta) - Number(a.planta === planta))
      .slice(0, 8)
  })()

  const addMaterial = () => setMateriales((p) => [...p, { nombre: '', codigoSap: '', cantidad: 1 }])
  const setMaterial = (i: number, patch: Partial<MaterialItem>) =>
    setMateriales((p) => p.map((m, j) => (j === i ? { ...m, ...patch } : m)))
  const delMaterial = (i: number) => setMateriales((p) => p.filter((_, j) => j !== i))

  const onFotos = async (files: FileList | null) => {
    if (!files) return
    const nuevas: string[] = []
    for (const file of Array.from(files)) nuevas.push(await fileToJpeg(file))
    setFotos((p) => [...p, ...nuevas])
  }

  const dictar = () => {
    // un segundo toque detiene: antes el botón llamaba start() de nuevo, eso
    // fallaba en silencio y el dictado quedaba "pegado"
    if (escuchando) { reconocedor.current?.stop(); return }
    setAvisoDictado('')
    const SR = window as unknown as { SpeechRecognition?: new () => Reconocedor; webkitSpeechRecognition?: new () => Reconocedor }
    const Rec = SR.SpeechRecognition || SR.webkitSpeechRecognition
    if (!Rec) { setAvisoDictado('Este navegador no tiene dictado por voz. Usa Chrome, o el micrófono del teclado del teléfono.'); return }
    if (!navigator.onLine) { setAvisoDictado(MENSAJE_DICTADO.network); return }
    const antes = f.descripcion.trim()
    const r = new Rec()
    r.lang = 'es-CL'; r.interimResults = true; r.continuous = true
    r.onresult = (e) => {
      let texto = ''
      for (let k = 0; k < e.results.length; k++) texto += e.results[k][0].transcript
      setF((p) => ({ ...p, descripcion: `${antes} ${texto}`.replace(/\s+/g, ' ').trim() }))
    }
    r.onerror = (e) => { if (e.error !== 'aborted') setAvisoDictado(MENSAJE_DICTADO[e.error] ?? `El dictado se cortó (${e.error}). Vuelve a intentarlo.`) }
    r.onend = () => {
      setEscuchando(false)
      reconocedor.current = null
      window.clearTimeout(topeDictado.current)
    }
    try {
      r.start()
      reconocedor.current = r
      setEscuchando(true)
      topeDictado.current = window.setTimeout(() => r.stop(), TOPE_DICTADO_MS)
    } catch {
      setAvisoDictado('No se pudo abrir el micrófono. Cierra el dictado del teclado si está abierto y vuelve a intentarlo.')
    }
  }

  const tomarGps = () => {
    if (!navigator.geolocation) { setAvisoUbic('Este teléfono no entrega el GPS al navegador.'); return }
    setBuscandoGps(true); setAvisoUbic('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBuscandoGps(false)
        setUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: pos.coords.accuracy, fuente: 'gps' })
      },
      (e) => {
        setBuscandoGps(false)
        setAvisoUbic(e.code === e.PERMISSION_DENIED
          ? 'Permite la ubicación para esta página en los ajustes del navegador.'
          : 'No se pudo obtener el GPS. Sal a un lugar abierto y vuelve a intentarlo, o márcalo en el mapa.')
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    )
  }

  const modoFallaLabel = (codigo: string) => {
    const mf = MODOS_FALLA.find((m) => m.codigo === codigo)
    return mf ? `${mf.codigo} · ${mf.nombre} (${planta})` : codigo
  }

  const validar = (): boolean => {
    const e: string[] = []
    if (!f.titulo.trim()) e.push('Título')
    if (!f.zona.trim()) e.push('Zona')
    if (!f.equipo.trim()) e.push('Equipo')
    if (!f.descripcion.trim()) e.push('Descripción')
    setErrores(e)
    return e.length === 0
  }

  const guardar = async (generar: boolean) => {
    if (!validar()) return
    const aviso: Aviso = {
      ...f,
      id: uuid(),
      folio,
      materiales,
      fotos,
      zona: f.zona.trim(),
      modoFalla: f.modoFalla ? modoFallaLabel(f.modoFalla) : '',
      ...(ubicacion ? { ubicacion } : {}),
      estado: 'completo',
      creadoPor: quienSoy(),
      createdAt: Date.now(),
      sincronizado: false,
    }
    setEnviando(true)
    await db.avisos.add(aviso)
    await encolar('avisos', avisoARow(aviso))
    recordarZona(aviso.zona); setExtras(zonasExtra())
    if (generar) await compartirPDFAviso(aviso)
    setEnviando(false)
    setF({ ...vacio, fechaTrabajo: hoyISO() })
    setMateriales([]); setFotos([]); setErrores([])
    setUbicacion(null); setZonaOtra(false); setAvisoUbic(''); setAvisoDictado('')
    setFolio(await generarFolio())
    onSaved()
  }

  return (
    <div className="form">
      <div className="folio-bar">
        <span>Folio <b>{folio}</b></span>
        <span className="off-mini">borrador local</span>
      </div>

      {errores.length > 0 && (
        <div className="banner err">Faltan campos obligatorios: {errores.join(', ')}</div>
      )}

      <div className="sec">Identificación</div>
      <label className="lab">Título de la actividad <span className="req">*</span></label>
      <input value={f.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Ej: Cambio de membranas — Rack 12" />

      <label className="lab">Tipo de aviso <span className="req">*</span></label>
      <select value={f.tipo} onChange={(e) => set('tipo', e.target.value)}>
        {TIPOS_AVISO.map((t) => <option key={t}>{t}</option>)}
      </select>

      <label className="lab">Prioridad <span className="req">*</span></label>
      <div className={'seg p-' + f.prioridad.toLowerCase()}>
        {PRIORIDADES.map((p) => (
          <button key={p} type="button" className={f.prioridad === p ? 'on' : ''} onClick={() => set('prioridad', p)}>{p}</button>
        ))}
      </div>

      <label className="lab">Zona <span className="req">*</span></label>
      <select
        value={zonaOtra ? OTRA : f.zona}
        onChange={(e) => {
          if (e.target.value === OTRA) { setZonaOtra(true); set('zona', '') }
          else { setZonaOtra(false); set('zona', e.target.value); onPlanta(plantaDeZona(e.target.value)) }
        }}
      >
        <option value="">Seleccionar zona…</option>
        {ZONAS.map((z) => <option key={z}>{z}</option>)}
        {extras.length > 0 && (
          <optgroup label="Agregadas en este celular">
            {extras.map((z) => <option key={z}>{z}</option>)}
          </optgroup>
        )}
        <option value={OTRA}>➕ Otra zona (escribir)</option>
      </select>
      {zonaOtra && (
        <input
          autoFocus
          value={f.zona}
          onChange={(e) => set('zona', e.target.value)}
          placeholder="Escribe la zona. Ej: Patio Energy, Bodega 3…"
          style={{ marginTop: 8 }}
        />
      )}

      <label className="lab">Ubicación del trabajo</label>
      <div className="ubic-botones">
        <button type="button" className="btn tool" disabled={buscandoGps} onClick={tomarGps}>
          {buscandoGps ? 'Buscando GPS…' : '📍 Mi ubicación (GPS)'}
        </button>
        <button type="button" className="btn tool" onClick={() => setMapaAbierto(true)}>🗺️ Elegir en el mapa</button>
      </div>
      {ubicacion && (
        <div className="ubic-chip">
          <span>
            📍 {ubicacion.lat.toFixed(5)}, {ubicacion.lng.toFixed(5)}
            {ubicacion.precision ? ` · ±${Math.round(ubicacion.precision)} m` : ' · marcado en el mapa'}
          </span>
          <a href={enlaceMapa(ubicacion.lat, ubicacion.lng)} target="_blank" rel="noopener">Ver</a>
          <button type="button" onClick={() => setUbicacion(null)} aria-label="Quitar ubicación">✕</button>
        </div>
      )}
      {avisoUbic && <div className="hint aviso-ubic">{avisoUbic}</div>}
      {mapaAbierto && (
        <Suspense fallback={<div className="mapa-overlay"><p className="mapa-aviso">Cargando el mapa…</p></div>}>
          <MapaUbicacion
            inicial={ubicacion ?? undefined}
            onListo={(u) => { setUbicacion(u); setMapaAbierto(false); setAvisoUbic('') }}
            onCerrar={() => setMapaAbierto(false)}
          />
        </Suspense>
      )}

      <label className="lab">Equipo / activo <span className="req">*</span></label>
      <input value={f.equipo} onChange={(e) => set('equipo', e.target.value)} placeholder="Ej: Vasija Protec BPV 8-1200" />

      <div className="sec">Descripción del aviso</div>
      <textarea rows={4} value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} placeholder="Describe el trabajo… o usa el dictado." />
      <div className="desc-tools">
        <button type="button" className="btn tool" onClick={() => set('descripcion', mejorarRedaccion(f.descripcion))}>✦ Mejorar redacción</button>
        <button type="button" className={'btn tool' + (escuchando ? ' escuchando' : '')} onClick={dictar}>
          {escuchando ? '⏹ Detener' : '🎤 Dictar'}
        </button>
      </div>
      {escuchando && <div className="hint dictado-vivo">🔴 Escuchando… habla y toca «Detener» al terminar.</div>}
      {avisoDictado && <div className="hint aviso-ubic">{avisoDictado}</div>}

      <div className="sec">Materiales</div>
      <div className="row2">
        <div>
          <label className="lab">Planta</label>
          <select value={planta} onChange={(e) => onPlanta(e.target.value)}>
            {PLANTAS_RO.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="lab">Modo de falla</label>
          <select value={f.modoFalla} onChange={(e) => onModoFalla(e.target.value)}>
            <option value="">Sin especificar</option>
            {MODOS_FALLA.map((m) => <option key={m.codigo} value={m.codigo}>{m.codigo} · {m.nombre}</option>)}
          </select>
        </div>
      </div>
      {f.modoFalla && (
        <div className="hint">
          {materiales.length
            ? `Repuestos SAP de ${f.modoFalla} para ${planta}. Ajusta las cantidades o quita lo que no va.`
            : `El catálogo no trae repuestos de ${f.modoFalla} para ${planta}: búscalos abajo.`}
        </div>
      )}

      <label className="lab">Buscar en el catálogo SAP ({CATALOGO.length} materiales)</label>
      <input
        value={buscaMat}
        onChange={(e) => setBuscaMat(e.target.value)}
        placeholder="Nombre o código SAP. Ej: tapón, o-ring, 11466642"
      />
      {resultadosMat.length > 0 && (
        <ul className="mat-resultados">
          {resultadosMat.map((c) => (
            <li key={c.sap}>
              <button type="button" onClick={() => agregarDelCatalogo(c.sap)}>
                <b>{c.nombre.replace(/\s+/g, ' ').trim()}</b>
                <small>SAP {c.sap} · {c.planta} · {c.conjunto}</small>
                <span>＋</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {buscaMat.trim().length >= 2 && resultadosMat.length === 0 && (
        <div className="hint">No está en el catálogo. Agrégalo a mano con «+ Material a mano».</div>
      )}

      {materiales.map((m, i) => (
        <div className="mat-tarjeta" key={i}>
          <input className="mat-nom" value={m.nombre} onChange={(e) => setMaterial(i, { nombre: e.target.value })} placeholder="Material" />
          <div className="mat-fila2">
            <input className="mat-sap" value={m.codigoSap} onChange={(e) => setMaterial(i, { codigoSap: e.target.value })} placeholder="Código SAP" inputMode="numeric" />
            <div className="mat-cant">
              <button type="button" onClick={() => setMaterial(i, { cantidad: Math.max(1, m.cantidad - 1) })} aria-label="Menos">−</button>
              <input type="number" min={1} value={m.cantidad} onChange={(e) => setMaterial(i, { cantidad: Math.max(1, Number(e.target.value) || 1) })} />
              <button type="button" onClick={() => setMaterial(i, { cantidad: m.cantidad + 1 })} aria-label="Más">+</button>
            </div>
            <button type="button" className="mat-del" onClick={() => delMaterial(i)} aria-label="Quitar">✕</button>
          </div>
        </div>
      ))}
      <button type="button" className="btn add" onClick={addMaterial}>+ Material a mano</button>

      <div className="sec">Recursos y operación</div>
      <div className="row2">
        <div>
          <label className="lab">Dotación (personas)</label>
          <input type="number" min={1} value={f.dotacion} onChange={(e) => set('dotacion', Number(e.target.value))} />
        </div>
        <div>
          <label className="lab">Horas requeridas</label>
          <input type="number" min={1} value={f.horas} onChange={(e) => set('horas', Number(e.target.value))} />
        </div>
      </div>

      <label className="lab">¿Requiere detención del equipo?</label>
      <div className="seg warn">
        <button type="button" className={f.detencion ? 'on' : ''} onClick={() => set('detencion', true)}>Sí</button>
        <button type="button" className={!f.detencion ? 'on' : ''} onClick={() => set('detencion', false)}>No</button>
      </div>

      <label className="lab">Fecha del trabajo</label>
      <input type="date" value={f.fechaTrabajo} onChange={(e) => set('fechaTrabajo', e.target.value)} />

      <div className="sec">Seguridad (HSE)</div>
      <textarea rows={2} value={f.hse} onChange={(e) => set('hse', e.target.value)} placeholder="Consideraciones de seguridad…" />

      <div className="sec">Evidencia</div>
      <label className="btn ev">
        📷 Agregar foto / video
        <input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => onFotos(e.target.files)} />
      </label>
      {fotos.length > 0 && (
        <div className="thumbs">
          {fotos.map((src, i) => (
            <div className="thumb" key={i}>
              <img src={src} alt={`foto ${i + 1}`} />
              <button type="button" onClick={() => setFotos((p) => p.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="sec">Cierre</div>
      <label className="lab">Correo de respaldo</label>
      <input type="email" value={f.correoRespaldo} onChange={(e) => set('correoRespaldo', e.target.value)} placeholder="correo@united.cl" />
      <div className="cc-note">✉️ Siempre con copia a brayan.villalobos.c@gmail.com</div>

      <div className="actions">
        <button type="button" className="btn secondary" disabled={enviando} onClick={() => guardar(false)}>Guardar</button>
        <button type="button" className="btn primary" disabled={enviando} onClick={() => guardar(true)}>
          {enviando ? 'Preparando PDF…' : 'Guardar y enviar PDF'}
        </button>
      </div>
    </div>
  )
}
