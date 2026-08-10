// Diagrama de venteos del rack: 6 en total.
//  · Alimentación: 1 por semi rack, al medio.
//  · Descarga: 1 por semi rack (alta) + 1 por semi rack (baja presión).
// Se toca uno y queda cambiado. Mismo esquema visual que el plano: los dos
// semi racks separados por el hueco central.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { encolar } from './sync'
import { quienSoy } from './identidad'
import { itemId, LADOS, type LadoRack } from './types'
import { VENTEOS, type Venteo } from './actividades'

const HECHO = '#22c55e'
const PENDIENTE = '#e2e8f0'
const GRIS = '#c3cad3'
const GRIS_BORDE = '#9aa5b1'

const W = 340, H = 250
// Los bloques abarcan TODO el semi rack, no son cajas sueltas: juntos cubren
// el ancho completo del rack, con el hueco central que separa A de B.
const MARGEN = 12, HUECO = 14
const BLOQUE_W = (W - 2 * MARGEN - HUECO) / 2
const BLOQUE_H = 74
const X_A = MARGEN, X_B = MARGEN + BLOQUE_W + HUECO

export default function Venteos({ actividad }: { actividad: string }) {
  const items = useLiveQuery(() => db.items.where('actividad').equals(actividad).toArray(), [actividad]) ?? []
  const hechoDe = (v: Venteo) => items.find((i) => i.item === v.id && i.lado === v.lado)?.hecho ?? false
  const hechos = VENTEOS.filter(hechoDe).length

  const toggle = async (v: Venteo) => {
    const yo = quienSoy()
    const id = itemId(actividad, v.lado, v.id)
    const next = !hechoDe(v)
    await db.items.put({
      id, actividad, lado: v.lado, item: v.id, hecho: next,
      datos: { presion: v.presion, semiRack: v.semiRack },
      creadoPor: yo, createdAt: Date.now(), sincronizado: false,
    })
    await encolar('item_upsert', {
      actividad, lado: v.lado, item: v.id, hecho: next,
      datos: { presion: v.presion, semiRack: v.semiRack }, creado_por: yo,
    })
  }

  // Un panel por lado; dentro, un bloque por semi rack con sus venteos.
  const panel = (lado: LadoRack, y: number) => {
    const delLado = VENTEOS.filter((v) => v.lado === lado)
    return (
      <g key={lado}>
        <text x={W / 2} y={y - 8} textAnchor="middle" fontSize={11} fontWeight={800} fill="#0f172a">
          {LADOS.find((l) => l.codigo === lado)!.nombre.toUpperCase()}
        </text>
        {(['A', 'B'] as const).map((sr) => {
          const x = sr === 'A' ? X_A : X_B
          const propios = delLado.filter((v) => v.semiRack === sr)
          return (
            <g key={sr}>
              <rect x={x} y={y} width={BLOQUE_W} height={BLOQUE_H} rx={8}
                fill="#f8fafc" stroke={GRIS_BORDE} strokeWidth={1.2} />
              <text x={x + BLOQUE_W / 2} y={y + 16} textAnchor="middle" fontSize={9} fontWeight={700} fill="#64748b">
                SEMI RACK {sr}
              </text>
              {propios.map((v, k) => {
                const cx = x + BLOQUE_W / 2 + (propios.length === 1 ? 0 : k === 0 ? -30 : 30)
                const cy = y + 46
                const on = hechoDe(v)
                return (
                  <g key={v.id} onClick={() => void toggle(v)} style={{ cursor: 'pointer' }}>
                    {/* cuerpo del venteo: tubo vertical + válvula */}
                    <rect x={cx - 3.5} y={cy - 16} width={7} height={16} fill={GRIS} stroke={GRIS_BORDE} strokeWidth={0.8} />
                    <circle cx={cx} cy={cy} r={13} fill={on ? HECHO : PENDIENTE} stroke={on ? '#15803d' : GRIS_BORDE} strokeWidth={2} />
                    {on && <path d={`M ${cx - 5} ${cy} l 3.5 3.8 l 6.5 -7.5`} fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />}
                    <text x={cx} y={cy + 26} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#475569">
                      {v.presion}
                    </text>
                  </g>
                )
              })}
            </g>
          )
        })}
      </g>
    )
  }

  return (
    <div>
      <div className="plano-titulo">
        <b>CAMBIO DE VENTEOS</b>
        <span>{hechos} DE {VENTEOS.length} CAMBIADOS</span>
      </div>

      <div className="avance">
        <div className="avance-top">
          <b>{Math.round((hechos / VENTEOS.length) * 1000) / 10}%</b>
          <span>{hechos} de {VENTEOS.length} venteos</span>
        </div>
        <div className="avance-bar">
          <span style={{ width: `${(hechos / VENTEOS.length) * 100}%`, background: HECHO }} />
        </div>
      </div>

      <div className="fugas-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
          {panel('alimentacion', 26)}
          {panel('descarga', 150)}
        </svg>
      </div>

      <div className="leyenda abajo">
        <b className="leg-titulo">LEYENDA</b>
        <span className="leg-item">
          <span className="leg-dot" style={{ background: HECHO }} /> Cambiado
          <em>Venteo ya reemplazado</em>
          <i>{hechos}</i>
        </span>
        <span className="leg-item">
          <span className="leg-dot" style={{ background: PENDIENTE, border: '1.5px solid #b9c2cd' }} /> Pendiente
          <em>Todavía no se cambia</em>
          <i>{VENTEOS.length - hechos}</i>
        </span>
        <span className="leg-item total">
          <span className="leg-dot oculto" /> TOTAL
          <em>2 en alimentación · 4 en descarga (2 alta + 2 baja)</em>
          <i>{VENTEOS.length}</i>
        </span>
      </div>
    </div>
  )
}
