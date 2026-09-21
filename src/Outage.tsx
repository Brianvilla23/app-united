// Pestaña "Outage": la secuencia de actividades del rack que se esté
// interviniendo. Cada actividad tiene su propio diagrama; acá se ve el orden,
// el avance y qué está bloqueado por lo que falta terminar antes.
//
// El rack ya no está escrito a mano: viene del outage abierto (`racks.ts`) y
// baja a cada diagrama por prop. Con dos outages encima —el Rack 12, cerrado,
// y el Rack 3, en curso— el selector de arriba elige cuál se está mirando.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { estaExtraida, type DatosManifold } from './types'
import { TOTAL_VASIJAS } from './rackLayout'
import {
  TIPOS_LISTOS, estaBloqueada, itemsDe, resumirManifold,
  type Actividad, type TipoDiagrama,
} from './actividades'
import { OUTAGES, type Outage as OutageDef } from './racks'

const ETIQUETA_TIPO: Record<TipoDiagrama, string> = {
  tapa: 'Plano de tapas',
  simple: 'Plano simple',
  manifold: 'Manifold (40)',
  fugas: 'Plano de fugas',
  venteo: 'Venteos (6)',
  pasos: 'Lista de pasos',
}

export default function Outage({
  outage, onAbrir, onCambiarRack,
}: {
  outage: OutageDef
  onAbrir: (act: Actividad) => void
  onCambiarRack: (rack: number) => void
}) {
  const tapas = useLiveQuery(() => db.tapas.toArray(), []) ?? []
  const itemsAv = useLiveQuery(() => db.items.toArray(), []) ?? []

  const ACTS = outage.actividades
  // Solo el avance de ESTE rack. Antes no hacía falta filtrar porque todo lo
  // guardado era del 12; ahora los dos outages conviven en las mismas tablas.
  const tapasRack = tapas.filter((t) => t.rack === outage.rack)
  const itemsRack = itemsAv.filter((i) => i.rack === outage.rack)

  // Avance por actividad. Cada tipo guarda en su propia tabla, así que el
  // avance se lee de donde corresponda.
  const avanceDe = (id: string): number => {
    const act = ACTS.find((a) => a.id === id)
    // Las tapas NO viven en avance_item sino en su propia tabla, y cada
    // actividad lleva su registro por lado.
    if (act?.tipo === 'tapa') {
      const lado = act.lados[0]
      const hechas = tapasRack.filter(
        (t) => t.lado === lado && t.actividad === id && estaExtraida(t),
      ).length
      return Math.round((hechas / TOTAL_VASIJAS) * 1000) / 10
    }
    if (act?.partes) {
      // acá el avance son las piezas puestas, no los manifolds terminados
      const propios = itemsRack.filter((i) => i.actividad === id)
      const hechas = propios.reduce(
        (n, i) => n + resumirManifold(i.item, act.partes!, i.datos as DatosManifold).hechas, 0,
      )
      const total = itemsDe(act)
      return total > 0 ? Math.round((hechas / total) * 1000) / 10 : 0
    }
    if (act) {
      const hechos = itemsRack.filter((i) => i.actividad === id && i.hecho).length
      const total = itemsDe(act)
      if (total > 0 && hechos > 0) return Math.round((hechos / total) * 1000) / 10
    }
    return 0
  }

  const total = ACTS.reduce((n, a) => n + itemsDe(a), 0)
  const hecho = ACTS.reduce((n, a) => n + (avanceDe(a.id) / 100) * itemsDe(a), 0)
  const global = total > 0 ? Math.round((hecho / total) * 1000) / 10 : 0

  return (
    <div>
      {OUTAGES.length > 1 && (
        <div className="rack-sel">
          {OUTAGES.map((o) => (
            <button
              key={o.rack}
              className={o.rack === outage.rack ? 'on' : ''}
              onClick={() => onCambiarRack(o.rack)}
            >
              Rack {o.rack}
              <small>{o.abierto ? 'en curso' : 'cerrado'}</small>
            </button>
          ))}
        </div>
      )}

      <div className="plano-titulo">
        <b>OUTAGE · RACK {outage.rack}</b>
        <span>{ACTS.length} ACTIVIDADES</span>
      </div>

      <p className="outage-sub">
        {outage.planta} · {outage.alcance} · {outage.ventana}
      </p>

      <div className="avance">
        <div className="avance-top">
          <b>{global}%</b>
          <span>avance total del outage</span>
        </div>
        <div className="avance-bar">
          <span style={{ width: `${global}%`, background: '#22c55e' }} />
        </div>
      </div>

      <ol className="actividades">
        {ACTS.map((a, i) => {
          const pct = avanceDe(a.id)
          const bloqueada = estaBloqueada(ACTS, i, avanceDe)
          // El candado AVISA el orden, no lo impone: en terreno las cuadrillas
          // se traslapan y la app no puede impedir registrar lo que ya se hizo.
          const listo = TIPOS_LISTOS.includes(a.tipo)
          const abrible = listo
          return (
            <li
              key={a.id}
              className={'act' + (bloqueada ? ' bloqueada' : '') + (pct >= 100 ? ' completa' : '')}
            >
              <button disabled={!abrible} onClick={() => abrible && onAbrir(a)}>
                <span className="act-n">{i + 1}</span>
                <span className="act-cuerpo">
                  <b>{a.nombre}</b>
                  <span className="act-meta">
                    <em>{ETIQUETA_TIPO[a.tipo]}</em>
                    <em>{itemsDe(a)} ítems</em>
                    {a.ventana && <em className="ventana">{a.ventana}</em>}
                    {a.libre && <em className="libre">sin orden</em>}
                    {bloqueada && <em className="candado">⚠ falta lo anterior</em>}
                    {!listo && <em className="porhacer">diagrama por construir</em>}
                  </span>
                  {a.pasos && <span className="act-pasos">{a.pasos.join(' → ')}</span>}
                  {a.nota && <small className="act-nota">{a.nota}</small>}
                  <span className="act-bar"><span style={{ width: `${pct}%` }} /></span>
                </span>
                <span className="act-pct">{pct}%</span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
