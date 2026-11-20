// Levantamiento Hidrolatina: la pantalla del link (ver `levantamientoHidro.ts`).
//
// Se trabaja "con pincel": se elige arriba qué se marca y después se tocan las
// piezas del plano, una tras otra. Son 40 manifolds y 295 vasijas por rack, así
// que abrir un detalle por cada toque haría el recorrido eterno.
//
// Esta pantalla NO muestra el resumen de los 12 racks: eso lo saca Planificación
// en el Excel (Brayan, 20-11). Acá solo va lo que necesita quien está marcando.
import { useState } from 'react'
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
type Pincel = ColorManifold | 'borrar'

/** El canastillo con tapón a cambiar se dibuja con el anillo amarillo que el
    diagrama de fugas usa para el canastillo. */
const CANASTILLO: ReadonlySet<ComponenteFuga> = new Set<ComponenteFuga>(['C'])

export default function Hidrolatina() {
  const [rack, setRack] = useState(1)
  const [lado, setLado] = useState<Lado>('descarga')
  const [pincel, setPincel] = useState<Pincel>('blanco')
  const [marca, setMarca] = useState<MarcaVasija>('aislada')
  const [vista, setVista] = useState<Vista>('A')
  const [ultimo, setUltimo] = useState('')
  const [copiado, setCopiado] = useState('')
  const lev = useLevantamiento(rack)

  const hora = () => new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })

  const tocarManifold = (id: string) => {
    if (pincel === 'borrar') {
      if (!lev.manifolds.has(id)) return
      void marcarManifold(rack, id, null)
      setUltimo(`Rack ${rack} · ${id}: sin marcar`)
      return
    }
    if (lev.manifolds.get(id) === pincel) return
    void marcarManifold(rack, id, pincel)
    const t = tipoManifold(pincel)
    setUltimo(`Rack ${rack} · ${id} → ${t.nombre.toLowerCase()}, ${t.tipo.toLowerCase()} (${hora()})`)
  }

  const tocarVasija = (id: string) => {
    const set = marca === 'aislada' ? lev.aisladas : lev.tapones
    const si = !set.has(id)
    void marcarVasija(rack, id, marca, si)
    setUltimo(si
      ? `Rack ${rack} · ${id}: ${NOMBRE_MARCA[marca].toLowerCase()} (${hora()})`
      : `Rack ${rack} · ${id}: se quitó «${NOMBRE_MARCA[marca].toLowerCase()}»`)
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
          <p className="hidro-lab">Elige el color y toca los manifolds: <b>blanco es Hidrolatina</b>, <b>gris es manifold de comando</b>.</p>
          <div className="seg">
            {TIPOS_MANIFOLD.map((t) => (
              <button key={t.color} className={pincel === t.color ? 'on' : ''} onClick={() => setPincel(t.color)}>
                <span className={'hidro-mues ' + t.color} /> {t.nombre} · {t.tipo}
              </button>
            ))}
            <button className={pincel === 'borrar' ? 'on' : ''} onClick={() => setPincel('borrar')}>Borrar</button>
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
          <PlanoManifolds estado={estadoManifold} onTocar={tocarManifold} />
          <p className="hidro-ultimo" role="status">{ultimo}</p>
          <p className="hint">
            Los manifolds sin marcar van con borde punteado. Para corregir uno, elige el
            otro color o «Borrar» y vuelve a tocarlo.
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
          {/* más grande que la pantalla para tocar con guantes: se desliza */}
          <div className="hidro-desliza">
            <div style={{ minWidth: vista === 'todo' ? 1150 : 560 }}>
              <PlanoRack
                modo="fugas"
                vista={vista}
                espejo={false}
                tapaRec={new Map()}
                porVasija={porVasija}
                colores={colores}
                onVasija={tocarVasija}
              />
            </div>
          </div>
          <p className="hidro-ultimo" role="status">{ultimo}</p>
          <p className="hint">
            <b style={{ color: COLOR_AISLADA.color }}>Azul</b>: vasija aislada.{' '}
            <b style={{ color: '#8a6d03' }}>Anillo amarillo</b>: tapón interno del canastillo que hay
            que cambiar. Una vasija puede tener las dos marcas. Desliza el plano hacia el lado
            para ver la fila completa.
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
