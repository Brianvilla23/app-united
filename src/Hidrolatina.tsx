// Levantamiento racks (nació como «Levantamiento Hidrolatina»): la pantalla del link (ver `levantamientoHidro.ts`).
//
// Se trabaja "con pincel": se elige arriba qué se marca y después se tocan las
// piezas del plano, una tras otra. Corregir tiene que ser fácil (Brayan, 20-11):
// tocar de nuevo una pieza ya marcada la desmarca, y «Deshacer» revierte lo
// último que se tocó, de a un paso. Son 40 manifolds y 295 vasijas por rack, así
// que abrir un detalle por cada toque haría el recorrido eterno.
//
// Esta pantalla NO muestra el resumen de los 12 racks: eso lo saca Planificación
// en el Excel (Brayan, 20-11). Acá solo va lo que necesita quien está marcando.
import { useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { RACKS, TOTAL_VASIJAS, type Vista } from './rackLayout'
import { MANIFOLDS } from './actividades'
import { COLOR_AISLADA } from './aisladas'
import PlanoManifolds, { type EstadoManifold } from './PlanoManifolds'
import PlanoRack from './PlanoRack'
import type { ComponenteFuga } from './rackLayout'
import {
  HASH_HIDROLATINA, NOMBRE_MARCA, TIPOS_MANIFOLD, marcarManifold, marcarVasija, tipoManifold,
  useLevantamiento, type ColorManifold, type MarcaVasija,
} from './levantamientoHidro'

type Lado = 'descarga' | 'alimentacion'

/** El canastillo con tapón a cambiar se dibuja con el anillo amarillo que el
    diagrama de fugas usa para el canastillo. */
const CANASTILLO: ReadonlySet<ComponenteFuga> = new Set<ComponenteFuga>(['C'])

const ZOOM_MIN = 1
const ZOOM_MAX = 4
const PASOS = [1, 1.5, 2, 3, 4]

/** Zoom del plano (Brayan, 20-11). La app bloquea el zoom de la página entera
    (`user-scalable=no`) para que se sienta como app, así que el zoom va DENTRO
    del plano: botones − / + y pellizco con dos dedos. Con un dedo se arrastra
    para moverse y se toca para marcar, igual que sin zoom.
    `ancho` es el ancho del plano sin zoom (CSS): el de manifolds calza en la
    pantalla; el de vasijas es más ancho, para tocar con guantes. */
function ZoomPlano({ ancho, children }: { ancho: string; children: ReactNode }) {
  const [zoom, setZoom] = useState(1)
  const caja = useRef<HTMLDivElement>(null)
  const pellizco = useRef<{ d: number; z: number } | null>(null)

  /** Cambia el zoom dejando quieto el centro de lo que se está mirando. */
  const aplicar = (nuevo: number) => {
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(nuevo * 100) / 100))
    const c = caja.current
    if (!c || z === zoom) { setZoom(z); return }
    const r = z / zoom
    const cx = c.scrollLeft + c.clientWidth / 2
    const cy = c.scrollTop + c.clientHeight / 2
    setZoom(z)
    requestAnimationFrame(() => {
      c.scrollLeft = cx * r - c.clientWidth / 2
      c.scrollTop = cy * r - c.clientHeight / 2
    })
  }
  const distancia = (e: TouchEvent) => {
    const [a, b] = [e.touches[0], e.touches[1]]
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  }

  return (
    <>
      <div className="hidro-zoom-bar">
        <button className="btn sm ghost" aria-label="Alejar" disabled={zoom <= ZOOM_MIN}
          onClick={() => aplicar([...PASOS].reverse().find((p) => p < zoom - 0.01) ?? ZOOM_MIN)}>−</button>
        <span>Zoom {Math.round(zoom * 100)} %</span>
        <button className="btn sm ghost" aria-label="Acercar" disabled={zoom >= ZOOM_MAX}
          onClick={() => aplicar(PASOS.find((p) => p > zoom + 0.01) ?? ZOOM_MAX)}>+</button>
        {zoom > 1 && <button className="btn sm ghost" onClick={() => aplicar(1)}>Ajustar</button>}
      </div>
      <div
        ref={caja}
        className={'hidro-zoom' + (zoom > 1 ? ' con-zoom' : '')}
        onTouchStart={(e) => { if (e.touches.length === 2) pellizco.current = { d: distancia(e), z: zoom } }}
        onTouchMove={(e) => {
          if (e.touches.length !== 2 || !pellizco.current) return
          aplicar(pellizco.current.z * (distancia(e) / pellizco.current.d))
        }}
        onTouchEnd={(e) => { if (e.touches.length < 2) pellizco.current = null }}
      >
        <div style={{ width: `calc(${ancho} * ${zoom})` }}>{children}</div>
      </div>
      <p className="hint" style={{ margin: '6px 0 0' }}>Pellizca con dos dedos o usa − / + para hacer zoom; arrastra con un dedo para moverte.</p>
    </>
  )
}

export default function Hidrolatina() {
  const [rack, setRack] = useState(1)
  const [lado, setLado] = useState<Lado>('descarga')
  const [pincel, setPincel] = useState<ColorManifold>('blanco')
  const [marca, setMarca] = useState<MarcaVasija>('aislada')
  const [vista, setVista] = useState<Vista>('A')
  const [ultimo, setUltimo] = useState('')
  /** Lo que se puede deshacer, el último arriba. Vive mientras la pantalla está abierta. */
  const [deshacer, setDeshacer] = useState<{ texto: string; revertir: () => Promise<void> }[]>([])
  const [copiado, setCopiado] = useState('')
  const lev = useLevantamiento(rack)

  const hora = () => new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })

  const anotar = (texto: string, revertir: () => Promise<void>) => {
    setUltimo(texto)
    setDeshacer((d) => [{ texto, revertir }, ...d].slice(0, 50))
  }

  const deshacerUltimo = () => {
    const [primero, ...resto] = deshacer
    if (!primero) return
    void primero.revertir()
    setDeshacer(resto)
    setUltimo(`Deshecho: ${primero.texto}`)
  }

  /** Tocar con el mismo color lo borra; con el otro color, lo cambia. */
  const tocarManifold = (id: string) => {
    const antes = lev.manifolds.get(id) ?? null
    const r = rack
    const nuevo = antes === pincel ? null : pincel
    void marcarManifold(r, id, nuevo)
    anotar(
      nuevo
        ? `Rack ${r} · ${id} → ${tipoManifold(nuevo).nombre.toLowerCase()}, ${tipoManifold(nuevo).tipo.toLowerCase()} (${hora()})`
        : `Rack ${r} · ${id}: borrado`,
      () => marcarManifold(r, id, antes),
    )
  }

  const tocarVasija = (id: string) => {
    const set = marca === 'aislada' ? lev.aisladas : lev.tapones
    const si = !set.has(id)
    const r = rack, m = marca
    void marcarVasija(r, id, m, si)
    anotar(
      si
        ? `Rack ${r} · ${id}: ${NOMBRE_MARCA[m].toLowerCase()} (${hora()})`
        : `Rack ${r} · ${id}: se quitó «${NOMBRE_MARCA[m].toLowerCase()}»`,
      () => marcarVasija(r, id, m, !si),
    )
  }

  const estadoManifold = (id: string): EstadoManifold | undefined => {
    const c = lev.manifolds.get(id)
    if (!c) return undefined
    const t = tipoManifold(c)
    return { color: t.relleno, borde: '#0f172a', rotulo: `${id} · ${t.tipo.toUpperCase()}`, rotuloColor: t.texto }
  }

  const colores = new Map<string, { color: string; texto: string }>()
  for (const v of lev.aisladas) colores.set(v, COLOR_AISLADA)
  const porVasija = new Map<string, Set<ComponenteFuga>>()
  for (const v of lev.tapones) porVasija.set(v, new Set(CANASTILLO))

  const nBlanco = [...lev.manifolds.values()].filter((c) => c === 'blanco').length
  const nGris = lev.manifolds.size - nBlanco

  const copiarLink = async () => {
    const link = `${location.origin}${location.pathname}${HASH_HIDROLATINA}`
    try {
      await navigator.clipboard.writeText(link)
      setCopiado('Link copiado. Pégalo en el grupo del personal.')
    } catch {
      setCopiado(link)
    }
  }

  const barraDeshacer = (
    <div className="hidro-deshacer">
      <p className="hidro-ultimo" role="status">{ultimo}</p>
      <button className="btn" disabled={deshacer.length === 0} onClick={deshacerUltimo}>↶ Deshacer</button>
    </div>
  )

  return (
    <div className="hidro">
      <p className="hint" style={{ margin: '0 0 10px' }}>
        Recorre los racks y marca lo que veas. Lo que marcas queda guardado con tu
        nombre y la hora, aunque no haya señal.
      </p>

      <div className="hidro-racks" role="group" aria-label="Rack">
        {RACKS.map((r) => (
          <button key={r} className={r === rack ? 'on' : ''} onClick={() => { setRack(r); setUltimo('') }}>
            {r}
          </button>
        ))}
      </div>

      <div className="seg" style={{ marginTop: 10 }}>
        <button className={lado === 'descarga' ? 'on' : ''} onClick={() => { setLado('descarga'); setUltimo('') }}>
          Descarga · manifolds
        </button>
        <button className={lado === 'alimentacion' ? 'on' : ''} onClick={() => { setLado('alimentacion'); setUltimo('') }}>
          Alimentación · vasijas
        </button>
      </div>

      {lado === 'descarga' ? (
        <>
          <p className="hidro-lab">Elige el color y toca los manifolds: <b>blanco es Hidrolatina</b>, <b>gris es manifold de comando</b>. Tocar de nuevo lo borra.</p>
          <div className="seg">
            {TIPOS_MANIFOLD.map((t) => (
              <button key={t.color} className={pincel === t.color ? 'on' : ''} onClick={() => setPincel(t.color)}>
                <span className={'hidro-mues ' + t.color} /> {t.nombre} · {t.tipo}
              </button>
            ))}
          </div>
          <div className="hidro-cuenta">
            <span><b>{nBlanco}</b> Hidrolatina</span>
            <span><b>{nGris}</b> comando</span>
            <span><b>{MANIFOLDS.length - lev.manifolds.size}</b> sin revisar de {MANIFOLDS.length}</span>
          </div>
          <div className="plano-titulo">
            <b>MANIFOLDS · LADO DESCARGA</b>
            <span>RACK {rack}</span>
          </div>
          <ZoomPlano ancho="100%">
            <PlanoManifolds estado={estadoManifold} onTocar={tocarManifold} />
          </ZoomPlano>
          {barraDeshacer}
          <p className="hint">
            Los manifolds sin marcar van con borde punteado. ¿Te equivocaste? Tócalo de
            nuevo y se borra, o usa «Deshacer». Para cambiarle el color, elige el otro y tócalo.
          </p>
        </>
      ) : (
        <>
          <p className="hidro-lab">Elige qué marcar y toca las vasijas. Tocar de nuevo la desmarca.</p>
          <div className="seg">
            <button className={marca === 'aislada' ? 'on' : ''} onClick={() => setMarca('aislada')}>
              <span className="hidro-mues aislada" /> Vasija aislada
            </button>
            <button className={marca === 'tapon' ? 'on' : ''} onClick={() => setMarca('tapon')}>
              <span className="hidro-mues tapon" /> Tapón interno a cambiar
            </button>
          </div>
          <div className="seg" style={{ marginTop: 8 }}>
            {(['A', 'B', 'todo'] as Vista[]).map((v) => (
              <button key={v} className={vista === v ? 'on' : ''} onClick={() => setVista(v)}>
                {v === 'todo' ? 'Todo' : `Semi Rack ${v}`}
              </button>
            ))}
          </div>
          <div className="hidro-cuenta">
            <span><b>{lev.aisladas.size}</b> aisladas</span>
            <span><b>{lev.tapones.size}</b> con tapón interno a cambiar</span>
            <span>de {TOTAL_VASIJAS} vasijas</span>
          </div>
          <div className="plano-titulo">
            <b>VASIJAS · CANASTILLO</b>
            <span>RACK {rack} · LADO ALIMENTACIÓN</span>
          </div>
          {/* sin zoom ya es más ancho que la pantalla, para tocar con guantes */}
          <ZoomPlano key={vista} ancho={vista === 'todo' ? 'max(100%, 1150px)' : 'max(100%, 560px)'}>
              <PlanoRack
                modo="fugas"
                vista={vista}
                espejo={false}
                tapaRec={new Map()}
                porVasija={porVasija}
                colores={colores}
                onVasija={tocarVasija}
              />
          </ZoomPlano>
          {barraDeshacer}
          <p className="hint">
            <b style={{ color: COLOR_AISLADA.color }}>Azul</b>: vasija aislada.{' '}
            <b style={{ color: '#8a6d03' }}>Anillo amarillo</b>: tapón interno del canastillo que hay
            que cambiar. Una vasija puede tener las dos marcas.
          </p>
        </>
      )}

      <div className="hidro-link">
        <button className="btn sm ghost" onClick={() => void copiarLink()}>Copiar el link de esta pantalla</button>
        {copiado && <small>{copiado}</small>}
      </div>
    </div>
  )
}
