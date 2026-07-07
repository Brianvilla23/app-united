import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { uuid } from './util'
import { encolar } from './sync'
import {
  CELDAS, FILAS, COMPONENTES, CELL, MX, MY, cx, cy, ANCHO, ALTO,
  runsPara, POSTE1_X, POSTE2_X, POSTE_W,
  MARCA, MARCA_BORDE, PLOMO, PLOMO_BORDE,
  type ComponenteFuga,
} from './rackLayout'

const CREADO_POR = 'B. Villalobos'

const VERDE = '#0e9f6e'
const AZUL = '#38bdf8'
const GRIS = '#c3cad3'
const GRIS_BORDE = '#9aa5b1'

// posición del cople victaulic de una vasija hacia un lado (N = derecha, S = izquierda)
function copleX(fila: string, col: number, lado: 'N' | 'S'): number {
  const run = runsPara(fila).find((r) => r.includes(col))!
  const i = run.indexOf(col)
  if (lado === 'N') {
    const next = run[i + 1]
    return next !== undefined ? (cx(col) + cx(next)) / 2 : cx(run[run.length - 1]) + CELL / 2 + 7
  }
  const prev = run[i - 1]
  return prev !== undefined ? (cx(col) + cx(prev)) / 2 : cx(run[0]) - CELL / 2 - 7
}

export default function Fugas() {
  const [sel, setSel] = useState<string | null>(null)
  const marcas = useLiveQuery(() => db.marcas.toArray(), []) ?? []

  const porVasija = new Map<string, Set<ComponenteFuga>>()
  for (const m of marcas) {
    if (!porVasija.has(m.vasija)) porVasija.set(m.vasija, new Set())
    porVasija.get(m.vasija)!.add(m.componente)
  }

  const toggle = async (vasija: string, componente: ComponenteFuga) => {
    const existe = await db.marcas.where('[vasija+componente]').equals([vasija, componente]).first()
    if (existe) {
      await db.marcas.delete(existe.id)
      await encolar('marcas_delete', { vasija, componente })
    } else {
      const creado = Date.now()
      await db.marcas.add({ id: uuid(), vasija, componente, creadoPor: CREADO_POR, createdAt: creado, sincronizado: false })
      await encolar('marcas_upsert', { vasija, componente, creado_por: CREADO_POR, created_at: new Date(creado).toISOString() })
    }
  }

  const selSet = sel ? porVasija.get(sel) ?? new Set<ComponenteFuga>() : new Set<ComponenteFuga>()
  const marcada = (c: ComponenteFuga) => selSet.has(c)

  return (
    <div>
      <div className="leyenda">
        <span className="leg-item" style={{ fontWeight: 800, color: '#8a6d03' }}>
          <span className="leg-dot" style={{ background: MARCA }} /> Amarillo = fuga
        </span>
        {COMPONENTES.map((c) => {
          const n = marcas.filter((m) => m.componente === c.codigo).length
          return n > 0 ? (
            <span key={c.codigo} className="leg-item">{c.nombre} ({c.posicion}) · {n}</span>
          ) : null
        })}
      </div>
      <p className="hint" style={{ margin: '0 2px 10px' }}>
        Tocá una vasija para marcar el componente con fuga. {marcas.length} marcas en total.
      </p>

      <div className="fugas-scroll">
        <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} width={ANCHO} style={{ display: 'block' }}>
          <text x={ANCHO / 2} y={16} textAnchor="middle" fontSize={14} fontWeight={800} fill="#0f172a" letterSpacing={0.5}>LADO ALIMENTACIÓN</text>
          <text x={MX + (8 * CELL + 18) / 2} y={38} textAnchor="middle" fontSize={13} fontWeight={800} fill="#0f172a">SEMI RACK A</text>
          <text x={(cx(9) + cx(16)) / 2} y={38} textAnchor="middle" fontSize={13} fontWeight={800} fill="#0f172a">SEMI RACK B</text>

          {/* barra inferior del bastidor */}
          <rect x={POSTE1_X - 30} y={MY + FILAS.length * CELL + 8} width={POSTE2_X - POSTE1_X + POSTE_W + 60} height={15} rx={7.5} fill={GRIS} stroke={GRIS_BORDE} strokeWidth={0.8} />

          {/* postes cilíndricos */}
          {[POSTE1_X, POSTE2_X].map((px) => (
            <g key={px}>
              <rect x={px} y={MY - 14} width={POSTE_W} height={FILAS.length * CELL + 30} fill={GRIS} stroke={GRIS_BORDE} strokeWidth={0.8} />
              <ellipse cx={px + POSTE_W / 2} cy={MY - 14} rx={POSTE_W / 2} ry={4.5} fill="#dde3ea" stroke={GRIS_BORDE} strokeWidth={0.8} />
            </g>
          ))}

          {/* letras de fila */}
          {FILAS.map((f, i) => (
            <text key={f} x={9} y={cy(i) + 4} fontSize={11} fontWeight={700} fill="#64748b">{f}</text>
          ))}

          {/* cañerías azules + victaulic plomo */}
          {FILAS.map((f, i) =>
            runsPara(f).map((run) => {
              const y = cy(i)
              const x0 = cx(run[0]) - CELL / 2 - 7
              const x1 = cx(run[run.length - 1]) + CELL / 2 + 7
              return (
                <g key={f + run[0]}>
                  <rect x={x0} y={y - 3.5} width={x1 - x0} height={7} rx={3.5} fill={AZUL} />
                  <rect x={x0 - 2.5} y={y - 7} width={5.5} height={14} rx={2} fill={PLOMO} stroke={PLOMO_BORDE} strokeWidth={0.8} />
                  <rect x={x1 - 3} y={y - 7} width={5.5} height={14} rx={2} fill={PLOMO} stroke={PLOMO_BORDE} strokeWidth={0.8} />
                  {run.slice(0, -1).map((c, k) => {
                    const xm = (cx(c) + cx(run[k + 1])) / 2
                    return <rect key={c} x={xm - 2.75} y={y - 7} width={5.5} height={14} rx={2} fill={PLOMO} stroke={PLOMO_BORDE} strokeWidth={0.8} />
                  })}
                </g>
              )
            }),
          )}

          {/* vasijas — la marca amarilla pinta la pieza real, igual que en el detalle */}
          {CELDAS.map((celda) => {
            const i = FILAS.indexOf(celda.fila as typeof FILAS[number])
            const x = cx(celda.col), y = cy(i)
            const set = porVasija.get(celda.id)
            return (
              <g key={celda.id} onClick={() => setSel(celda.id)} style={{ cursor: 'pointer' }}>
                <circle cx={x} cy={y} r={19} fill="#fff" stroke={VERDE} strokeWidth={4.2} />
                {set?.has('C') && <circle cx={x} cy={y} r={13} fill="none" stroke={MARCA} strokeWidth={4} />}
                {set?.has('T') && <circle cx={x} cy={y} r={9.5} fill={MARCA} stroke={MARCA_BORDE} strokeWidth={1} />}
                <text x={x} y={y + 4} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#0f172a">{celda.id}</text>
                {set?.has('SN') && (
                  <rect x={x + 17} y={y - 10} width={5.5} height={20} rx={2} fill={MARCA} stroke={MARCA_BORDE} strokeWidth={1.2} />
                )}
                {set?.has('SS') && (
                  <rect x={x - 22.5} y={y - 10} width={5.5} height={20} rx={2} fill={MARCA} stroke={MARCA_BORDE} strokeWidth={1.2} />
                )}
                {set?.has('UN') && (
                  <rect x={copleX(celda.fila, celda.col, 'N') - 4} y={y - 9} width={8} height={18} rx={2} fill={MARCA} stroke={MARCA_BORDE} strokeWidth={1.2} />
                )}
                {set?.has('US') && (
                  <rect x={copleX(celda.fila, celda.col, 'S') - 4} y={y - 9} width={8} height={18} rx={2} fill={MARCA} stroke={MARCA_BORDE} strokeWidth={1.2} />
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {sel && (
        <div className="modal-overlay" onClick={() => setSel(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <b>Vasija {sel}</b>
              <button className="modal-x" onClick={() => setSel(null)}>✕</button>
            </div>
            <p className="hint" style={{ margin: '0 0 8px' }}>Tocá el componente con fuga · se pinta amarillo</p>

            <svg viewBox="0 0 320 235" style={{ width: '100%', display: 'block' }}>
              {/* cañería azul de alimentación */}
              <rect x={0} y={106} width={320} height={9} fill={AZUL} />

              {/* victaulic SUR (cople izquierdo) */}
              <g onClick={() => toggle(sel, 'US')} style={{ cursor: 'pointer' }}>
                <rect x={43} y={100} width={26} height={6} rx={2} fill={marcada('US') ? MARCA : PLOMO} stroke={marcada('US') ? MARCA_BORDE : PLOMO_BORDE} strokeWidth={1} />
                <rect x={43} y={116} width={26} height={6} rx={2} fill={marcada('US') ? MARCA : PLOMO} stroke={marcada('US') ? MARCA_BORDE : PLOMO_BORDE} strokeWidth={1} />
                <rect x={47} y={88} width={18} height={45} rx={4} fill={marcada('US') ? MARCA : PLOMO} stroke={marcada('US') ? MARCA_BORDE : PLOMO_BORDE} strokeWidth={2} />
                <text x={56} y={148} textAnchor="middle" fontSize={9} fontWeight={700} fill="#64748b">victaulic</text>
                <text x={56} y={161} textAnchor="middle" fontSize={11} fontWeight={800} fill="#334155">SUR</text>
              </g>

              {/* sideport SUR (barra izquierda) */}
              <g onClick={() => toggle(sel, 'SS')} style={{ cursor: 'pointer' }}>
                <rect x={85} y={88} width={10} height={46} rx={3}
                  fill={marcada('SS') ? MARCA : '#eef2f7'} stroke={marcada('SS') ? MARCA_BORDE : '#94a3b8'} strokeWidth={2} />
                <text x={90} y={148} textAnchor="middle" fontSize={9} fontWeight={700} fill="#64748b">sideport</text>
              </g>

              {/* victaulic NORTE (cople derecho) */}
              <g onClick={() => toggle(sel, 'UN')} style={{ cursor: 'pointer' }}>
                <rect x={251} y={100} width={26} height={6} rx={2} fill={marcada('UN') ? MARCA : PLOMO} stroke={marcada('UN') ? MARCA_BORDE : PLOMO_BORDE} strokeWidth={1} />
                <rect x={251} y={116} width={26} height={6} rx={2} fill={marcada('UN') ? MARCA : PLOMO} stroke={marcada('UN') ? MARCA_BORDE : PLOMO_BORDE} strokeWidth={1} />
                <rect x={255} y={88} width={18} height={45} rx={4} fill={marcada('UN') ? MARCA : PLOMO} stroke={marcada('UN') ? MARCA_BORDE : PLOMO_BORDE} strokeWidth={2} />
                <text x={264} y={148} textAnchor="middle" fontSize={9} fontWeight={700} fill="#64748b">victaulic</text>
                <text x={264} y={161} textAnchor="middle" fontSize={11} fontWeight={800} fill="#334155">NORTE</text>
              </g>

              {/* sideport NORTE (barra derecha) */}
              <g onClick={() => toggle(sel, 'SN')} style={{ cursor: 'pointer' }}>
                <rect x={225} y={88} width={10} height={46} rx={3}
                  fill={marcada('SN') ? MARCA : '#eef2f7'} stroke={marcada('SN') ? MARCA_BORDE : '#94a3b8'} strokeWidth={2} />
                <text x={230} y={148} textAnchor="middle" fontSize={9} fontWeight={700} fill="#64748b">sideport</text>
              </g>

              {/* vasija: anillo verde como el plano */}
              <circle cx={160} cy={110} r={64} fill="#fff" stroke="#2e6da4" strokeWidth={2.5} />
              <circle cx={160} cy={110} r={60} fill="#fff" stroke={VERDE} strokeWidth={9} />

              {/* canastillo (anillo interior) */}
              <g onClick={() => toggle(sel, 'C')} style={{ cursor: 'pointer' }}>
                <circle cx={160} cy={110} r={42} fill="#fff" stroke={marcada('C') ? MARCA : '#e8edf3'} strokeWidth={11} />
                <text x={160} y={62} textAnchor="middle" fontSize={11} fontWeight={800} fill={marcada('C') ? '#8a6d03' : '#94a3b8'}>canastillo</text>
              </g>

              {/* tapón: círculo al centro */}
              <g onClick={() => toggle(sel, 'T')} style={{ cursor: 'pointer' }}>
                <circle cx={160} cy={110} r={25}
                  fill={marcada('T') ? MARCA : '#f8fafc'} stroke={marcada('T') ? MARCA_BORDE : '#94a3b8'} strokeWidth={2.5} />
                <text x={160} y={107} textAnchor="middle" fontSize={13} fontWeight={800} fill="#334155">T</text>
                <text x={160} y={120} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#64748b">tapón</text>
              </g>

              <text x={160} y={218} textAnchor="middle" fontSize={11} fill="#64748b">Vista lado alimentación · {sel}</text>
            </svg>

            <div className="comp-list">
              {COMPONENTES.map((c) => {
                const on = marcada(c.codigo)
                return (
                  <button key={c.codigo} className={'comp-btn' + (on ? ' on' : '')}
                    style={on ? { borderColor: MARCA_BORDE, color: '#8a6d03', background: 'rgba(240,180,0,.08)' } : undefined}
                    onClick={() => toggle(sel, c.codigo)}>
                    <span className="leg-dot" style={{ background: on ? MARCA : '#d7dde4' }} />
                    {c.nombre}
                    <span className="comp-estado">{on ? 'con fuga ⚠' : '—'}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
