// Pestaña "Outage Rack 12": la secuencia completa de actividades del outage.
// Cada actividad tiene su propio diagrama; acá se ve el orden, el avance y qué
// está bloqueado por lo que falta terminar antes.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { RACK_TAPAS, estaExtraida, type DatosManifold } from './types'
import { TOTAL_VASIJAS } from './rackLayout'
import {
  ACTIVIDADES, TIPOS_LISTOS, estaBloqueada, itemsDe, resumirManifold,
  type Actividad, type TipoDiagrama,
} from './actividades'

const ETIQUETA_TIPO: Record<TipoDiagrama, string> = {
  tapa: 'Plano de tapas',
  simple: 'Plano simple',
  manifold: 'Manifold (40)',
  fugas: 'Plano de fugas',
  venteo: 'Venteos (6)',
}

export default function Outage({ onAbrir }: { onAbrir: (act: Actividad) => void }) {
  const tapas = useLiveQuery(() => db.tapas.toArray(), []) ?? []
  const itemsAv = useLiveQuery(() => db.items.toArray(), []) ?? []

  // Avance por actividad. Hoy solo el retiro de tapas de alimentación tiene
  // datos reales; el resto queda en 0 hasta que se construya su diagrama.
  const avanceDe = (id: string): number => {
    if (id === 'retiro_tapas_alim') {
      const hechas = tapas.filter(
        (t) => t.rack === RACK_TAPAS && t.lado === 'alimentacion' && estaExtraida(t),
      ).length
      return Math.round((hechas / TOTAL_VASIJAS) * 1000) / 10
    }
    const act = ACTIVIDADES.find((a) => a.id === id)
    if (act?.partes) {
      // acá el avance son las piezas puestas, no los manifolds terminados
      const propios = itemsAv.filter((i) => i.actividad === id)
      const hechas = propios.reduce(
        (n, i) => n + resumirManifold(i.item, act.partes!, i.datos as DatosManifold).hechas, 0,
      )
      const total = itemsDe(act)
      return total > 0 ? Math.round((hechas / total) * 1000) / 10 : 0
    }
    if (act) {
      const hechos = itemsAv.filter((i) => i.actividad === id && i.hecho).length
      const total = itemsDe(act)
      if (total > 0 && hechos > 0) return Math.round((hechos / total) * 1000) / 10
    }
    return 0
  }

  const total = ACTIVIDADES.reduce((n, a) => n + itemsDe(a), 0)
  const hecho = ACTIVIDADES.reduce((n, a) => n + (avanceDe(a.id) / 100) * itemsDe(a), 0)
  const global = Math.round((hecho / total) * 1000) / 10

  return (
    <div>
      <div className="plano-titulo">
        <b>OUTAGE · RACK {RACK_TAPAS}</b>
        <span>{ACTIVIDADES.length} ACTIVIDADES</span>
      </div>

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
        {ACTIVIDADES.map((a, i) => {
          const pct = avanceDe(a.id)
          const bloqueada = estaBloqueada(i, avanceDe)
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
