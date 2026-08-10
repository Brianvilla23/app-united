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

// --- los 40 manifolds, dibujados como en el plano ---
// Verificado contra "Manifold pvc lado descarga enumerados.pdf": columna verde
// central, y por fila una barra azul (el manifold PVC) con sus brazos y el
// tubing celeste con americana amarilla saliendo por detrás de cada brazo.
const MW = 460
const FILA_H = 58, MY0 = 46
const COL_VERDE_W = 26
const BARRA_H = 16
const BRAZOS = 4

const VERDE_MF = '#00b050'
const VERDE_BORDE = '#4d7c2a'
const AZUL_MF = '#1a71a8'
const CELESTE = '#29b6f6'
const AMARILLO = '#f5b301'
const MORADO = '#7b3fa0'
const ROJO_UNITED = '#e1251b'

function Manifolds({
  hechos, onTocar, espejo,
}: { hechos: Set<string>; onTocar: (id: string) => void; espejo: boolean }) {
  const alto = MY0 + FILAS_MANIFOLD.length * FILA_H + 16
  const cxVerde = MW / 2
  // columnas: 1 y 4 en los extremos, 2 y 3 pegadas a la columna verde
  const anchoBarra = 92
  const xIni = (col: number) => {
    const c = espejo ? 5 - col : col
    if (c === 1) return 26
    if (c === 2) return cxVerde - COL_VERDE_W / 2 - anchoBarra - 6
    if (c === 3) return cxVerde + COL_VERDE_W / 2 + 6
    return MW - 26 - anchoBarra
  }

  return (
    <div className="fugas-scroll">
      <svg viewBox={`0 0 ${MW} ${alto}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
        <text x={(xIni(1) + xIni(2) + anchoBarra) / 2} y={20} textAnchor="middle" fontSize={11} fontWeight={800} fill="#0f172a">
          SEMI RACK {espejo ? 'A' : 'B'}
        </text>
        <text x={(xIni(3) + xIni(4) + anchoBarra) / 2} y={20} textAnchor="middle" fontSize={11} fontWeight={800} fill="#0f172a">
          SEMI RACK {espejo ? 'B' : 'A'}
        </text>

        {/* columna verde central: el manifold principal */}
        <rect x={cxVerde - COL_VERDE_W / 2} y={MY0 - 12} width={COL_VERDE_W} height={alto - MY0 - 2}
          fill={VERDE_MF} stroke={VERDE_BORDE} strokeWidth={1.2} />
        <ellipse cx={cxVerde} cy={MY0 - 12} rx={COL_VERDE_W / 2} ry={4}
          fill="#7fd8a0" stroke={VERDE_BORDE} strokeWidth={1.2} />

        {FILAS_MANIFOLD.map((f, i) => {
          const y = MY0 + i * FILA_H + FILA_H / 2
          return (
            <g key={'fila' + f}>
              {/* tramo verde que une la columna con cada manifold interior */}
              <rect x={cxVerde - COL_VERDE_W / 2 - 8} y={y - BARRA_H / 2} width={8} height={BARRA_H} fill={VERDE_MF} />
              <rect x={cxVerde + COL_VERDE_W / 2} y={y - BARRA_H / 2} width={8} height={BARRA_H} fill={VERDE_MF} />

              {MANIFOLDS.filter((m) => m.fila === f).map((m) => {
                const x0 = xIni(m.col)
                const on = hechos.has(m.id)
                const relleno = on ? HECHO : AZUL_MF
                const borde = on ? '#15803d' : VERDE_BORDE
                return (
                  <g key={m.id} onClick={() => onTocar(m.id)} style={{ cursor: 'pointer' }}>
                    {/* barra del manifold */}
                    <rect x={x0} y={y - BARRA_H / 2} width={anchoBarra} height={BARRA_H}
                      fill={relleno} stroke={borde} strokeWidth={1.4} />
                    {/* brazos + tubing por detrás de cada brazo */}
                    {Array.from({ length: BRAZOS }).map((_, k) => {
                      const bx = x0 + 9 + k * ((anchoBarra - 18) / (BRAZOS - 1))
                      return (
                        <g key={k}>
                          <rect x={bx - 4} y={y - BARRA_H / 2 - 5} width={8} height={BARRA_H + 10}
                            fill={relleno} stroke={borde} strokeWidth={1.1} />
                          {/* tubing: sale por detrás del brazo */}
                          <rect x={bx - 1.6} y={y - BARRA_H / 2 - 15} width={3.2} height={10} fill={CELESTE} />
                          <rect x={bx - 9} y={y - BARRA_H / 2 - 18} width={9} height={3.2} fill={CELESTE} />
                          <circle cx={bx} cy={y - BARRA_H / 2 - 6} r={2.4} fill={MORADO} />
                          <circle cx={bx - 10} cy={y - BARRA_H / 2 - 16.4} r={2.6} fill={AMARILLO} />
                        </g>
                      )
                    })}
                    {/* código, bajo la barra */}
                    <text x={x0 + anchoBarra / 2} y={y + BARRA_H / 2 + 15} textAnchor="middle"
                      fontSize={12} fontWeight={800} fill={on ? '#15803d' : ROJO_UNITED}>{m.id}</text>
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
