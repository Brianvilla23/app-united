// Pestaña "Outage Rack N": la secuencia completa de actividades del outage.
// Cada actividad tiene su propio diagrama; acá se ve el orden, el avance y qué
// está bloqueado por lo que falta terminar antes.
//
// El rack sale del contexto (`useRack`), no de una constante: la misma pantalla
// sirve para el Rack 3 y para el 12.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { estaExtraida, type DatosManifold } from './types'
import { puestas as membranasPuestas, type DatosMembranas } from './membranas'
import { TOTAL_VASIJAS } from './rackLayout'
import { NOMBRE_MANIFOLD, cerrarOutage, rackDe, useCierre, useRack } from './rackOutage'
import { usePuedeEditar } from './permisos'
import { fechaCorta } from './fecha'
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
  const rack = useRack()
  const info = rackDe(rack)
  const cierre = useCierre(rack)
  const puedeEditar = usePuedeEditar()
  const [confirmando, setConfirmando] = useState(false)
  const tapas = useLiveQuery(() => db.tapas.toArray(), []) ?? []
  const itemsAv = useLiveQuery(() => db.items.toArray(), []) ?? []

  const delRack = itemsAv.filter((i) => i.rack === rack)

  // Avance por actividad. Cada tipo guarda en su propia tabla, así que el
  // avance se lee de donde corresponda.
  const avanceDe = (id: string): number => {
    const act = ACTIVIDADES.find((a) => a.id === id)
    // Las tapas NO viven en avance_item sino en su propia tabla, y cada
    // actividad lleva su registro por lado. Antes esto solo contemplaba el
    // retiro de alimentación: las otras tres caían al conteo de avance_item,
    // donde no hay ninguna tapa, y se veían siempre en 0% aunque el rack
    // estuviera medio desarmado.
    if (act?.tipo === 'tapa') {
      const lado = act.lados[0]
      const hechas = tapas.filter(
        (t) => t.rack === rack && t.lado === lado && t.actividad === id && estaExtraida(t),
      ).length
      return Math.round((hechas / TOTAL_VASIJAS) * 1000) / 10
    }
    // el carguío cuenta membranas puestas, no vasijas terminadas
    if (act?.membranas) {
      const puestas = delRack.filter((i) => i.actividad === id)
        .reduce((n, i) => n + membranasPuestas(i.datos as DatosMembranas), 0)
      const total = itemsDe(act)
      return total > 0 ? Math.round((puestas / total) * 1000) / 10 : 0
    }
    if (act?.partes) {
      // acá el avance son las piezas puestas, no los manifolds terminados
      const propios = delRack.filter((i) => i.actividad === id)
      const hechas = propios.reduce(
        (n, i) => n + resumirManifold(i.item, act.partes!, i.datos as DatosManifold).hechas, 0,
      )
      const total = itemsDe(act)
      return total > 0 ? Math.round((hechas / total) * 1000) / 10 : 0
    }
    if (act) {
      const hechos = delRack.filter((i) => i.actividad === id && i.hecho).length
      const total = itemsDe(act)
      if (total > 0 && hechos > 0) return Math.round((hechos / total) * 1000) / 10
    }
    return 0
  }

  const total = ACTIVIDADES.reduce((n, a) => n + itemsDe(a), 0)
  const hecho = ACTIVIDADES.reduce((n, a) => n + (avanceDe(a.id) / 100) * itemsDe(a), 0)
  const registrado = Math.round((hecho / total) * 1000) / 10
  // Un outage cerrado se muestra terminado aunque no todo haya quedado
  // registrado en la app: el trabajo se hizo, lo que faltó fue anotarlo.
  const global = cierre ? 100 : registrado

  const cerrar = async (valor: boolean) => {
    setConfirmando(false)
    await cerrarOutage(rack, valor)
  }

  return (
    <div>
      <div className="plano-titulo">
        <b>OUTAGE · RACK {rack}</b>
        <span>{info.planta} · {NOMBRE_MANIFOLD[info.manifold].toUpperCase()}</span>
      </div>

      {cierre && (
        <div className="cerrado-aviso">
          <b>✓ OUTAGE CERRADO</b>
          <span>
            Rack terminado{cierre.fecha ? ` el ${fechaCorta(cierre.fecha)}` : ''}
            {cierre.quien ? ` por ${cierre.quien}` : ''}. Queda de solo lectura.
          </span>
          <small>Lo que alcanzó a registrarse en la app fue el {registrado}%.</small>
        </div>
      )}

      <div className="avance">
        <div className="avance-top">
          <b>{global}%</b>
          <span>{cierre ? 'outage cerrado' : 'avance total del outage'}</span>
        </div>
        <div className="avance-bar">
          <span style={{ width: `${global}%`, background: cierre ? '#64748b' : '#22c55e' }} />
        </div>
      </div>

      <ol className="actividades">
        {ACTIVIDADES.map((a, i) => {
          const pct = avanceDe(a.id)
          const bloqueada = !cierre && estaBloqueada(i, avanceDe)
          // El candado AVISA el orden, no lo impone: en terreno las cuadrillas
          // se traslapan y la app no puede impedir registrar lo que ya se hizo.
          const listo = TIPOS_LISTOS.includes(a.tipo)
          const abrible = listo
          return (
            <li
              key={a.id}
              className={'act' + (bloqueada ? ' bloqueada' : '')
                + (pct >= 100 ? ' completa' : '') + (cierre ? ' cerrada' : '')}
            >
              <button disabled={!abrible} onClick={() => abrible && onAbrir(a)}>
                <span className="act-n">{i + 1}</span>
                <span className="act-cuerpo">
                  <b>{a.nombre}</b>
                  <span className="act-meta">
                    {/* con el outage cerrado el % que queda es lo que se
                        alcanzó a anotar, no lo que se hizo: el chip lo dice */}
                    {cierre && <em className="cerrada">✓ cerrada</em>}
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

      {puedeEditar && (
        <div className="cerrar-outage">
          {confirmando ? (
            <>
              <span>
                {cierre
                  ? `¿Reabrir el outage del Rack ${rack}? Vuelve a quedar editable.`
                  : `¿Cerrar el outage del Rack ${rack}? Queda como terminado y de solo lectura.`}
              </span>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn sm" onClick={() => void cerrar(!cierre)}>Sí</button>
                <button className="btn sm ghost" onClick={() => setConfirmando(false)}>No</button>
              </div>
            </>
          ) : (
            <button className="btn sm ghost" onClick={() => setConfirmando(true)}>
              {cierre ? 'Reabrir outage' : 'Cerrar outage'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
