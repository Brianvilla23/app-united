import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { encolar } from './sync'
import {
  CELDAS, FILAS, COMPONENTES, CELL, MY, R, cx, cy, ALTO,
  runsPara, POSTE1_X, POSTE2_X, POSTE_W,
  RACKS, enVista, viewBoxPara,
  MARCA, MARCA_BORDE, PLOMO, PLOMO_BORDE,
  type ComponenteFuga, type Vista,
} from './rackLayout'

const CREADO_POR = 'B. Villalobos'

const VERDE = '#0e9f6e'
const AZUL = '#38bdf8'
const GRIS = '#c3cad3'
const GRIS_BORDE = '#9aa5b1'

// cople victaulic (banda con ranura). x = borde izquierdo, y = centro.
function cpl(key: string, x: number, y: number, on: boolean) {
  return (
    <g key={key}>
      <rect x={x} y={y - 8} width={6} height={16} rx={2} fill={on ? MARCA : PLOMO} stroke={on ? MARCA_BORDE : PLOMO_BORDE} strokeWidth={0.9} />
      <line x1={x + 3} y1={y - 6} x2={x + 3} y2={y + 6} stroke={on ? MARCA_BORDE : PLOMO_BORDE} strokeWidth={0.7} />
    </g>
  )
}

export default function Fugas() {
  const [rack, setRack] = useState(1)
  const [vista, setVista] = useState<Vista>('A')
  const [sel, setSel] = useState<string | null>(null)
  const todas = useLiveQuery(() => db.marcas.toArray(), []) ?? []

  const marcas = todas.filter((m) => m.rack === rack)
  const porVasija = new Map<string, Set<ComponenteFuga>>()
  for (const m of marcas) {
    if (!porVasija.has(m.vasija)) porVasija.set(m.vasija, new Set())
    porVasija.get(m.vasija)!.add(m.componente)
  }
  const racksConMarcas = new Set(todas.map((m) => m.rack))

  const toggle = async (vasija: string, componente: ComponenteFuga) => {
    const id = `${rack}-${vasija}-${componente}`
    const existe = await db.marcas.get(id)
    if (existe) {
      await db.marcas.delete(id)
      await encolar('marcas_delete', { rack, vasija, componente })
    } else {
      const creado = Date.now()
      await db.marcas.add({ id, rack, vasija, componente, creadoPor: CREADO_POR, createdAt: creado, sincronizado: false })
      await encolar('marcas_upsert', { rack, vasija, componente, creado_por: CREADO_POR, created_at: new Date(creado).toISOString() })
    }
  }

  const selSet = sel ? porVasija.get(sel) ?? new Set<ComponenteFuga>() : new Set<ComponenteFuga>()
  const marcada = (c: ComponenteFuga) => selSet.has(c)

  const vb = viewBoxPara(vista)
  const celdasVista = CELDAS.filter((c) => enVista(vista, c.col))

  return (
    <div>
      <div className="rack-tabs">
        {RACKS.map((r) => (
          <button key={r} className={'rack-tab' + (r === rack ? ' on' : '')} onClick={() => setRack(r)}>
            R{r}{racksConMarcas.has(r) && <span className="rack-dot" />}
          </button>
        ))}
      </div>

      <div className="vista-seg">
        <button className={vista === 'A' ? 'on' : ''} onClick={() => setVista('A')}>Semi Rack A</button>
        <button className={vista === 'B' ? 'on' : ''} onClick={() => setVista('B')}>Semi Rack B</button>
        <button className={vista === 'todo' ? 'on' : ''} onClick={() => setVista('todo')}>Todo</button>
      </div>

      <div className="leyenda">
        <span className="leg-item" style={{ fontWeight: 800, color: '#8a6d03' }}>
          <span className="leg-dot" style={{ background: MARCA }} /> Amarillo = fuga
        </span>
        <span className="leg-item">Rack {rack} · {marcas.length} marcas</span>
      </div>

      <div className={'fugas-scroll' + (vista === 'todo' ? ' scrollx' : '')}>
        <svg
          viewBox={`${vb.x} 0 ${vb.w} ${ALTO}`}
          style={{ display: 'block', width: vista === 'todo' ? vb.w : '100%', maxWidth: '100%', height: 'auto', margin: '0 auto' }}
        >
          {vista !== 'B' && <text x={(cx(1) + cx(8)) / 2} y={30} textAnchor="middle" fontSize={13} fontWeight={800} fill="#0f172a">SEMI RACK A</text>}
          {vista !== 'A' && <text x={(cx(9) + cx(16)) / 2} y={30} textAnchor="middle" fontSize={13} fontWeight={800} fill="#0f172a">SEMI RACK B</text>}

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
            <text key={f} x={vb.letrasX} y={cy(i) + 4} fontSize={11} fontWeight={700} fill="#64748b">{f}</text>
          ))}

          {/* SPOOLS: entre cada par de vasijas va tubo azul + cople victaulic a cada lado */}
          {FILAS.map((f, i) =>
            runsPara(f).filter((run) => enVista(vista, run[0])).map((run) => {
              const y = cy(i)
              return (
                <g key={f + run[0]}>
                  {/* stubs a los extremos del tramo (hacia manifold) */}
                  <rect x={cx(run[0]) - R - 16} y={y - 3.5} width={10} height={7} rx={2} fill={AZUL} />
                  <rect x={cx(run[run.length - 1]) + R + 6} y={y - 3.5} width={10} height={7} rx={2} fill={AZUL} />
                  {/* tubo del spool entre vasija y vasija */}
                  {run.slice(0, -1).map((c, k) => {
                    const c2 = run[k + 1]
                    return <rect key={c} x={cx(c) + R + 7} y={y - 3.5} width={cx(c2) - R - 7 - (cx(c) + R + 7)} height={7} rx={2} fill={AZUL} />
                  })}
                  {/* coples victaulic (norte y sur de cada vasija) */}
                  {run.map((c) => {
                    const set = porVasija.get(`${f}${c}`)
                    return (
                      <g key={'k' + c}>
                        {cpl(`s${c}`, cx(c) - R - 6, y, !!set?.has('US'))}
                        {cpl(`n${c}`, cx(c) + R, y, !!set?.has('UN'))}
                      </g>
                    )
                  })}
                </g>
              )
            }),
          )}

          {/* vasijas */}
          {celdasVista.map((celda) => {
            const i = FILAS.indexOf(celda.fila as typeof FILAS[number])
            const x = cx(celda.col), y = cy(i)
            const set = porVasija.get(celda.id)
            return (
              <g key={celda.id} onClick={() => setSel(celda.id)} style={{ cursor: 'pointer' }}>
                <circle cx={x} cy={y} r={R} fill="#fff" stroke={VERDE} strokeWidth={4.2} />
                {set?.has('C') && <circle cx={x} cy={y} r={13} fill="none" stroke={MARCA} strokeWidth={4} />}
                {set?.has('T') && <circle cx={x} cy={y} r={9.5} fill={MARCA} stroke={MARCA_BORDE} strokeWidth={1} />}
                <text x={x} y={y + 4} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#0f172a">{celda.id}</text>
                {/* sideport = punto amarillo sobre el anillo (norte=der, sur=izq) */}
                {set?.has('SN') && <circle cx={x + R} cy={y} r={4.6} fill={MARCA} stroke={MARCA_BORDE} strokeWidth={1} />}
                {set?.has('SS') && <circle cx={x - R} cy={y} r={4.6} fill={MARCA} stroke={MARCA_BORDE} strokeWidth={1} />}
              </g>
            )
          })}
        </svg>
      </div>

      {sel && (
        <div className="modal-overlay" onClick={() => setSel(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <b>Rack {rack} · Vasija {sel}</b>
              <button className="modal-x" onClick={() => setSel(null)}>✕</button>
            </div>
            <p className="hint" style={{ margin: '0 0 8px' }}>Tocá el componente con fuga · se pinta amarillo</p>

            <svg viewBox="0 0 320 250" style={{ width: '100%', maxWidth: 380, display: 'block', margin: '0 auto' }}>
              {/* spool (tubo entre vasijas) */}
              <rect x={0} y={106} width={320} height={9} fill={AZUL} />
              <text x={30} y={132} textAnchor="middle" fontSize={9} fontWeight={700} fill="#64748b">spool</text>
              <text x={292} y={132} textAnchor="middle" fontSize={9} fontWeight={700} fill="#64748b">spool</text>

              {/* victaulic SUR (cople izquierdo) */}
              <g onClick={() => toggle(sel, 'US')} style={{ cursor: 'pointer' }}>
                <rect x={52} y={100} width={26} height={6} rx={2} fill={marcada('US') ? MARCA : PLOMO} stroke={marcada('US') ? MARCA_BORDE : PLOMO_BORDE} strokeWidth={1} />
                <rect x={52} y={116} width={26} height={6} rx={2} fill={marcada('US') ? MARCA : PLOMO} stroke={marcada('US') ? MARCA_BORDE : PLOMO_BORDE} strokeWidth={1} />
                <rect x={56} y={90} width={18} height={41} rx={4} fill={marcada('US') ? MARCA : PLOMO} stroke={marcada('US') ? MARCA_BORDE : PLOMO_BORDE} strokeWidth={2} />
                <text x={65} y={150} textAnchor="middle" fontSize={9} fontWeight={700} fill="#64748b">victaulic</text>
                <text x={65} y={163} textAnchor="middle" fontSize={11} fontWeight={800} fill="#334155">SUR</text>
              </g>

              {/* victaulic NORTE (cople derecho) */}
              <g onClick={() => toggle(sel, 'UN')} style={{ cursor: 'pointer' }}>
                <rect x={242} y={100} width={26} height={6} rx={2} fill={marcada('UN') ? MARCA : PLOMO} stroke={marcada('UN') ? MARCA_BORDE : PLOMO_BORDE} strokeWidth={1} />
                <rect x={242} y={116} width={26} height={6} rx={2} fill={marcada('UN') ? MARCA : PLOMO} stroke={marcada('UN') ? MARCA_BORDE : PLOMO_BORDE} strokeWidth={1} />
                <rect x={246} y={90} width={18} height={41} rx={4} fill={marcada('UN') ? MARCA : PLOMO} stroke={marcada('UN') ? MARCA_BORDE : PLOMO_BORDE} strokeWidth={2} />
                <text x={255} y={150} textAnchor="middle" fontSize={9} fontWeight={700} fill="#64748b">victaulic</text>
                <text x={255} y={163} textAnchor="middle" fontSize={11} fontWeight={800} fill="#334155">NORTE</text>
              </g>

              {/* vasija: anillo verde */}
              <circle cx={160} cy={110} r={64} fill="#fff" stroke="#2e6da4" strokeWidth={2.5} />
              <circle cx={160} cy={110} r={60} fill="#fff" stroke={VERDE} strokeWidth={9} />

              {/* sideport SUR (puerto sobre la vasija, izquierda) */}
              <g onClick={() => toggle(sel, 'SS')} style={{ cursor: 'pointer' }}>
                <rect x={92} y={99} width={14} height={22} rx={3} fill={marcada('SS') ? MARCA : '#eef2f7'} stroke={marcada('SS') ? MARCA_BORDE : '#94a3b8'} strokeWidth={2} />
                <text x={99} y={88} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#64748b">sideport</text>
              </g>
              {/* sideport NORTE (puerto sobre la vasija, derecha) */}
              <g onClick={() => toggle(sel, 'SN')} style={{ cursor: 'pointer' }}>
                <rect x={214} y={99} width={14} height={22} rx={3} fill={marcada('SN') ? MARCA : '#eef2f7'} stroke={marcada('SN') ? MARCA_BORDE : '#94a3b8'} strokeWidth={2} />
                <text x={221} y={88} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#64748b">sideport</text>
              </g>

              {/* canastillo (anillo interior) */}
              <g onClick={() => toggle(sel, 'C')} style={{ cursor: 'pointer' }}>
                <circle cx={160} cy={110} r={42} fill="#fff" stroke={marcada('C') ? MARCA : '#e8edf3'} strokeWidth={11} />
                <text x={160} y={64} textAnchor="middle" fontSize={11} fontWeight={800} fill={marcada('C') ? '#8a6d03' : '#94a3b8'}>canastillo</text>
              </g>

              {/* tapón (centro) */}
              <g onClick={() => toggle(sel, 'T')} style={{ cursor: 'pointer' }}>
                <circle cx={160} cy={110} r={25} fill={marcada('T') ? MARCA : '#f8fafc'} stroke={marcada('T') ? MARCA_BORDE : '#94a3b8'} strokeWidth={2.5} />
                <text x={160} y={107} textAnchor="middle" fontSize={13} fontWeight={800} fill="#334155">T</text>
                <text x={160} y={120} textAnchor="middle" fontSize={8.5} fontWeight={700} fill="#64748b">tapón</text>
              </g>

              <text x={160} y={240} textAnchor="middle" fontSize={11} fill="#64748b">Lado alimentación · Rack {rack} · {sel}</text>
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
