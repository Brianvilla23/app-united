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
import { MANIFOLDS, FILAS_MANIFOLD, type Actividad } from './actividades'
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

// --- los 40 manifolds: 10 filas × 4 columnas, 1 y 4 en los extremos ---
const MW = 360, COL_X = [30, 140, 200, 310], FILA_H = 30, MY0 = 34

function Manifolds({
  hechos, onTocar, espejo,
}: { hechos: Set<string>; onTocar: (id: string) => void; espejo: boolean }) {
  const alto = MY0 + FILAS_MANIFOLD.length * FILA_H + 14
  const x = (col: number) => COL_X[espejo ? 4 - col : col - 1]

  return (
    <div className="fugas-scroll">
      <svg viewBox={`0 0 ${MW} ${alto}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
        <text x={(x(1) + x(2)) / 2} y={20} textAnchor="middle" fontSize={11} fontWeight={800} fill="#0f172a">
          SEMI RACK {espejo ? 'A' : 'B'}
        </text>
        <text x={(x(3) + x(4)) / 2} y={20} textAnchor="middle" fontSize={11} fontWeight={800} fill="#0f172a">
          SEMI RACK {espejo ? 'B' : 'A'}
        </text>

        {FILAS_MANIFOLD.map((f, i) => (
          <text key={'f' + f} x={10} y={MY0 + i * FILA_H + 18} fontSize={9} fontWeight={700} fill="#64748b">{f}</text>
        ))}

        {MANIFOLDS.map((m) => {
          const i = FILAS_MANIFOLD.indexOf(m.fila as typeof FILAS_MANIFOLD[number])
          const cx = x(m.col), cy = MY0 + i * FILA_H + 13
          const on = hechos.has(m.id)
          return (
            <g key={m.id} onClick={() => onTocar(m.id)} style={{ cursor: 'pointer' }}>
              <rect x={cx - 24} y={cy - 10} width={48} height={20} rx={5}
                fill={on ? HECHO : '#fff'} stroke={on ? '#15803d' : '#b9c2cd'} strokeWidth={1.6} />
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize={9.5} fontWeight={700}
                fill={on ? '#052e16' : '#0f172a'}>{m.id}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
