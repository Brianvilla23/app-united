// Diagrama genérico de una actividad del outage.
//  · tipo 'simple'   → el plano de 295 vasijas, sin componentes: se toca y queda hecho.
//  · tipo 'manifold' → los 40 manifolds (10 filas × 4).
// Ambos guardan en la misma tabla `items`, así que agregar una actividad nueva
// es elegir el tipo en el catálogo, no programar una pantalla.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { encolar } from './sync'
import { quienSoy } from './identidad'
import { itemId, LADOS, type LadoRack } from './types'
import { MANIFOLDS, PLANO_MF, ZONAS_MANIFOLD, type Actividad } from './actividades'
import { TOTAL_VASIJAS, type Vista } from './rackLayout'
import PlanoRack from './PlanoRack'

const HECHO = '#22c55e'

export default function PlanoActividad({ actividad }: { actividad: Actividad }) {
  const [lado, setLado] = useState<LadoRack>(actividad.lados[0])
  const [vista, setVista] = useState<Vista>('A')
  const items = useLiveQuery(
    () => db.items.where('actividad').equals(actividad.id).toArray(),
    [actividad.id],
  ) ?? []

  const delLado = items.filter((i) => i.lado === lado)
  const hechos = new Set(delLado.filter((i) => i.hecho).map((i) => i.item))
  const totalLado = actividad.tipo === 'manifold' ? MANIFOLDS.length : TOTAL_VASIJAS
  const pct = Math.round((hechos.size / totalLado) * 1000) / 10

  const toggle = async (item: string) => {
    const yo = quienSoy()
    const next = !hechos.has(item)
    await db.items.put({
      id: itemId(actividad.id, lado, item),
      actividad: actividad.id, lado, item, hecho: next, datos: {},
      creadoPor: yo, createdAt: Date.now(), sincronizado: false,
    })
    await encolar('item_upsert', {
      actividad: actividad.id, lado, item, hecho: next, datos: {}, creado_por: yo,
    })
  }

  const marcarTodo = async (valor: boolean) => {
    const ids = actividad.tipo === 'manifold'
      ? MANIFOLDS.map((m) => m.id)
      : null
    if (!ids) return
    for (const item of ids) {
      if (hechos.has(item) === valor) continue
      await toggle(item)
    }
  }

  return (
    <div>
      <div className="plano-titulo">
        <b>{actividad.nombre.toUpperCase()}</b>
        <span>{actividad.sinLado ? 'RACK 12' : LADOS.find((l) => l.codigo === lado)!.nombre.toUpperCase()}</span>
      </div>

      {actividad.lados.length > 1 && !actividad.sinLado && (
        <div className="lado-seg">
          {actividad.lados.map((l) => (
            <button key={l} className={lado === l ? 'on' : ''} onClick={() => setLado(l)}>
              {LADOS.find((x) => x.codigo === l)!.corto}
              <small>{items.filter((i) => i.lado === l && i.hecho).length} hechos</small>
            </button>
          ))}
        </div>
      )}

      {actividad.pasos && (
        <p className="hint" style={{ margin: '0 0 10px' }}>
          Orden: {actividad.pasos.join(' → ')}
        </p>
      )}

      <div className="avance">
        <div className="avance-top">
          <b>{pct}%</b>
          <span>{hechos.size} de {totalLado} hechos</span>
        </div>
        <div className="avance-bar">
          <span style={{ width: `${pct}%`, background: HECHO }} />
        </div>
      </div>

      {actividad.tipo === 'simple' ? (
        <>
          <div className="vista-seg">
            <button className={vista === 'A' ? 'on' : ''} onClick={() => setVista('A')}>Semi Rack A</button>
            <button className={vista === 'B' ? 'on' : ''} onClick={() => setVista('B')}>Semi Rack B</button>
            <button className={vista === 'todo' ? 'on' : ''} onClick={() => setVista('todo')}>Todo</button>
          </div>
          <div className="fugas-scroll">
            <PlanoRack
              modo="simple"
              vista={vista}
              espejo={lado === 'descarga'}
              tapaRec={new Map()}
              porVasija={new Map()}
              hechos={hechos}
              onVasija={(id) => void toggle(id)}
            />
          </div>
        </>
      ) : (
        <Manifolds hechos={hechos} onTocar={(id) => void toggle(id)} espejo={lado === 'descarga'} />
      )}

      {actividad.tipo === 'manifold' && (
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button className="btn sm ghost" onClick={() => void marcarTodo(true)}>Marcar todos</button>
          <button className="btn sm ghost" onClick={() => void marcarTodo(false)}>Limpiar todos</button>
        </div>
      )}

      <div className="leyenda abajo">
        <b className="leg-titulo">LEYENDA</b>
        <span className="leg-item">
          <span className="leg-dot" style={{ background: HECHO }} /> Hecho
          <em>Ya ejecutado</em>
          <i>{hechos.size}</i>
        </span>
        <span className="leg-item">
          <span className="leg-dot vacio" /> Pendiente
          <em>{actividad.nombre} pendiente</em>
          <i>{totalLado - hechos.size}</i>
        </span>
        <span className="leg-item total">
          <span className="leg-dot oculto" /> TOTAL
          <em>{actividad.tipo === 'manifold' ? 'Manifolds del rack' : 'Vasijas del rack'}</em>
          <i>{totalLado}</i>
        </span>
      </div>
    </div>
  )
}

// --- manifolds: se usa EL PLANO REAL de Planificación ---
// El fondo es el PDF "Manifold pvc lado descarga enumerados" recortado y
// cuantizado a 16 colores (86 KB, sin pérdida visible porque son colores
// planos). Encima van las 40 zonas tocables. Así el diagrama de la app es
// idéntico al de planta, no una réplica dibujada a mano.
function Manifolds({
  hechos, onTocar,
}: { hechos: Set<string>; onTocar: (id: string) => void; espejo: boolean }) {
  const { ancho, alto } = PLANO_MF
  return (
    <div className="fugas-scroll">
      <svg viewBox={`0 0 ${ancho} ${alto}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
        <image href="./manifold_descarga.png" x={0} y={0} width={ancho} height={alto} />
        {ZONAS_MANIFOLD.map((z) => {
          const on = hechos.has(z.id)
          return (
            <g key={z.id} onClick={() => onTocar(z.id)} style={{ cursor: 'pointer' }}>
              <rect
                x={z.x} y={z.y} width={z.w} height={z.h} rx={5}
                fill={on ? 'rgba(34,197,94,.42)' : 'transparent'}
                stroke={on ? '#15803d' : 'rgba(120,130,145,.35)'}
                strokeWidth={on ? 2.2 : 1}
                strokeDasharray={on ? undefined : '3 3'}
              />
              {on && (
                <path
                  d={`M ${z.x + z.w - 26} ${z.y + z.h / 2} l 6 7 l 13 -15`}
                  fill="none" stroke="#15803d" strokeWidth={4}
                  strokeLinecap="round" strokeLinejoin="round"
                />
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
