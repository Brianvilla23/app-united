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
import { ESTADOS_TAPA, estadoTapaDe, PERNOS_POR_TAPA, type TapaEstado } from './types'

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

// posición del cople victaulic de una vasija hacia un lado (N = derecha, S = izquierda)
function copleX(fila: string, col: number, lado: 'N' | 'S'): number {
  const run = runsPara(fila).find((r) => r.includes(col))!
  const i = run.indexOf(col)
  if (lado === 'N') {
    const next = run[i + 1]
    return next !== undefined ? (cx(col) + cx(next)) / 2 : cx(col) + R + 9
  }
  const prev = run[i - 1]
  return prev !== undefined ? (cx(col) + cx(prev)) / 2 : cx(col) - R - 9
}

export default function Fugas({ modoInicial = 'fugas' }: { modoInicial?: 'fugas' | 'tapas' }) {
  const [modo, setModo] = useState<'fugas' | 'tapas'>(modoInicial)
  const [rack, setRack] = useState(modoInicial === 'tapas' ? 12 : 1)
  const [vista, setVista] = useState<Vista>('A')
  const [sel, setSel] = useState<string | null>(null)
  const [selTapa, setSelTapa] = useState<string | null>(null)
  const todas = useLiveQuery(() => db.marcas.toArray(), []) ?? []
  const todasTapas = useLiveQuery(() => db.tapas.toArray(), []) ?? []

  const marcas = todas.filter((m) => m.rack === rack)
  const porVasija = new Map<string, Set<ComponenteFuga>>()
  for (const m of marcas) {
    if (!porVasija.has(m.vasija)) porVasija.set(m.vasija, new Set())
    porVasija.get(m.vasija)!.add(m.componente)
  }
  const racksConMarcas = new Set(todas.map((m) => m.rack))

  const tapaRec = new Map<string, TapaEstado>()
  for (const t of todasTapas) if (t.rack === rack) tapaRec.set(t.vasija, t)
  const racksConTapas = new Set(todasTapas.map((t) => t.rack))

  const updateTapa = async (vasija: string, patch: Partial<TapaEstado>) => {
    const id = `${rack}-${vasija}`
    const cur = todasTapas.find((t) => t.id === id)
    const base: TapaEstado = cur ?? { id, rack, vasija, tapaAgripada: false, segurosAgripados: false, pernosRodados: [], marca: '', creadoPor: CREADO_POR, createdAt: Date.now(), sincronizado: false }
    const next: TapaEstado = { ...base, ...patch, id, rack, vasija, sincronizado: false }
    await db.tapas.put(next)
    await encolar('tapas_upsert', { rack, vasija, tapa_agripada: next.tapaAgripada, seguros_agripados: next.segurosAgripados, pernos_rodados: next.pernosRodados, marca: next.marca, creado_por: CREADO_POR })
  }

  const togglePerno = (vasija: string, i: number) => {
    const cur = tapaRec.get(vasija)?.pernosRodados ?? []
    const next = cur.includes(i) ? cur.filter((p) => p !== i) : [...cur, i]
    void updateTapa(vasija, { pernosRodados: next })
  }

  const limpiarTapa = async (vasija: string) => {
    await db.tapas.delete(`${rack}-${vasija}`)
    await encolar('tapas_delete', { rack, vasija })
  }

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
      <div className="vista-seg" style={{ marginBottom: 10 }}>
        <button className={modo === 'fugas' ? 'on' : ''} onClick={() => setModo('fugas')}>Fugas</button>
        <button className={modo === 'tapas' ? 'on' : ''} onClick={() => setModo('tapas')}>Estado de tapas</button>
      </div>

      <div className="rack-tabs">
        {RACKS.map((r) => (
          <button key={r} className={'rack-tab' + (r === rack ? ' on' : '')} onClick={() => setRack(r)}>
            R{r}{(modo === 'fugas' ? racksConMarcas : racksConTapas).has(r) && <span className="rack-dot" />}
          </button>
        ))}
      </div>

      <div className="vista-seg">
        <button className={vista === 'A' ? 'on' : ''} onClick={() => setVista('A')}>Semi Rack A</button>
        <button className={vista === 'B' ? 'on' : ''} onClick={() => setVista('B')}>Semi Rack B</button>
        <button className={vista === 'todo' ? 'on' : ''} onClick={() => setVista('todo')}>Todo</button>
      </div>

      <div className="leyenda">
        {modo === 'fugas' ? (
          <>
            <span className="leg-item" style={{ fontWeight: 800, color: '#8a6d03' }}>
              <span className="leg-dot" style={{ background: MARCA }} /> Amarillo = fuga
            </span>
            <span className="leg-item">Rack {rack} · {marcas.length} marcas</span>
          </>
        ) : (
          <>
            {ESTADOS_TAPA.map((e) => (
              <span key={e.codigo} className="leg-item"><span className="leg-dot" style={{ background: e.color }} /> {e.nombre}</span>
            ))}
            <span className="leg-item">Rack {rack} · {tapaRec.size} tapas</span>
          </>
        )}
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

          {/* cañería + coples victaulic + SPOOL contra el manifold (nada cruza el poste) */}
          {FILAS.map((f, i) =>
            runsPara(f).filter((run) => enVista(vista, run[0])).map((run) => {
              const y = cy(i)
              const first = run[0], last = run[run.length - 1]
              const manifoldDer = last === 4 || last === 12
              const posteX = first <= 8 ? POSTE1_X : POSTE2_X
              const x0 = manifoldDer ? cx(first) - R - 12 : posteX + POSTE_W
              const x1 = manifoldDer ? posteX : cx(last) + R + 12
              return (
                <g key={'run' + f + first}>
                  {/* cañería del tramo: se corta contra el manifold */}
                  <rect x={x0} y={y - 3.5} width={x1 - x0} height={7} rx={3.5} fill={AZUL} />
                  {/* una victaulic entre vasijas contiguas */}
                  {run.slice(0, -1).map((c, k) => cpl(`m${f}${c}`, (cx(c) + cx(run[k + 1])) / 2 - 3, y, false))}
                  {/* victaulic del extremo exterior */}
                  {cpl(`ext${f}${first}`, manifoldDer ? cx(first) - R - 12 : cx(last) + R + 6, y, false)}
                  {/* SPOOL al manifold: victaulic en AMBOS extremos, con tubo entremedio */}
                  {manifoldDer
                    ? [cpl(`spa${f}${first}`, cx(last) + R + 6, y, false), cpl(`spb${f}${first}`, posteX - 10, y, false)]
                    : [cpl(`spa${f}${first}`, posteX + POSTE_W + 4, y, false), cpl(`spb${f}${first}`, cx(first) - R - 12, y, false)]}
                </g>
              )
            }),
          )}

          {/* vasijas */}
          {celdasVista.map((celda) => {
            const i = FILAS.indexOf(celda.fila as typeof FILAS[number])
            const x = cx(celda.col), y = cy(i)
            const set = porVasija.get(celda.id)
            const rec = tapaRec.get(celda.id)
            const tc = modo === 'tapas' && rec ? ESTADOS_TAPA.find((e) => e.codigo === estadoTapaDe(rec)) : undefined
            return (
              <g key={celda.id} onClick={() => (modo === 'fugas' ? setSel(celda.id) : setSelTapa(celda.id))} style={{ cursor: 'pointer' }}>
                <circle cx={x} cy={y} r={R} fill={tc ? tc.color : '#fff'} stroke={VERDE} strokeWidth={4.2} />
                {modo === 'fugas' && set?.has('C') && <circle cx={x} cy={y} r={13} fill="none" stroke={MARCA} strokeWidth={4} />}
                {modo === 'fugas' && set?.has('T') && <circle cx={x} cy={y} r={9.5} fill={MARCA} stroke={MARCA_BORDE} strokeWidth={1} />}
                <text x={x} y={y + 4} textAnchor="middle" fontSize={10.5} fontWeight={700} fill={tc ? tc.texto : '#0f172a'}>{celda.id}</text>
                {modo === 'fugas' && set?.has('UN') && cpl(`un${celda.id}`, copleX(celda.fila, celda.col, 'N') - 3, y, true)}
                {modo === 'fugas' && set?.has('US') && cpl(`us${celda.id}`, copleX(celda.fila, celda.col, 'S') - 3, y, true)}
                {modo === 'fugas' && set?.has('SN') && <circle cx={x + R} cy={y} r={4.6} fill={MARCA} stroke={MARCA_BORDE} strokeWidth={1} />}
                {modo === 'fugas' && set?.has('SS') && <circle cx={x - R} cy={y} r={4.6} fill={MARCA} stroke={MARCA_BORDE} strokeWidth={1} />}
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

      {selTapa && (() => {
        const rec = tapaRec.get(selTapa)
        const tapaAgr = rec?.tapaAgripada ?? false
        const seg = rec?.segurosAgripados ?? false
        const pernos = rec?.pernosRodados ?? []
        const C = 130
        return (
          <div className="modal-overlay" onClick={() => setSelTapa(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <b>Rack {rack} · Tapa {selTapa}</b>
                <button className="modal-x" onClick={() => setSelTapa(null)}>✕</button>
              </div>
              <p className="hint" style={{ margin: '0 0 8px' }}>Tocá los pernos rodados · marcá seguros y tapa abajo</p>

              <svg viewBox="0 0 260 268" style={{ width: '100%', maxWidth: 320, display: 'block', margin: '0 auto' }}>
                <circle cx={C} cy={C} r={104} fill={tapaAgr ? 'rgba(225,29,29,.13)' : '#eef1f4'} stroke={tapaAgr ? '#e11d1d' : '#b8bec4'} strokeWidth={tapaAgr ? 5 : 3} />
                <circle cx={C} cy={C} r={95} fill="#f7f9fb" stroke="#cbd2d8" strokeWidth={1} />
                {/* seguros triples: anillo interior */}
                <circle cx={C} cy={C} r={56} fill="none" stroke={seg ? '#9a9a4e' : '#e5e9ee'} strokeWidth={13} onClick={() => void updateTapa(selTapa, { segurosAgripados: !seg })} style={{ cursor: 'pointer' }} />
                {/* puerto de permeado (centro) */}
                <circle cx={C} cy={C} r={26} fill="#2b2f33" />
                <circle cx={C} cy={C} r={19} fill="none" stroke="#dc2626" strokeWidth={6} />
                <circle cx={C} cy={C} r={9} fill="#0f172a" />
                {/* pernos */}
                {Array.from({ length: PERNOS_POR_TAPA }).map((_, i) => {
                  const ang = ((i * 360) / PERNOS_POR_TAPA - 90) * Math.PI / 180
                  const px = C + 80 * Math.cos(ang), py = C + 80 * Math.sin(ang)
                  const on = pernos.includes(i)
                  return (
                    <g key={i} onClick={() => togglePerno(selTapa, i)} style={{ cursor: 'pointer' }}>
                      <circle cx={px} cy={py} r={13} fill={on ? '#e11d1d' : '#c3c9cf'} stroke={on ? '#7f1010' : '#8a9199'} strokeWidth={2} />
                      <text x={px} y={py + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill={on ? '#fff' : '#4b5563'}>{i + 1}</text>
                    </g>
                  )
                })}
              </svg>
              <p className="hint" style={{ textAlign: 'center', margin: '2px 0 6px' }}>Pernos rodados marcados: <b>{pernos.length}</b></p>

              <label className="lab">Seguros triples agripados</label>
              <div className="seg">
                <button className={seg ? 'on' : ''} style={seg ? { borderColor: '#9a9a4e', color: '#5c5c22', background: 'rgba(154,154,78,.12)' } : undefined} onClick={() => void updateTapa(selTapa, { segurosAgripados: true })}>Sí</button>
                <button className={!seg ? 'on' : ''} onClick={() => void updateTapa(selTapa, { segurosAgripados: false })}>No</button>
              </div>
              <label className="lab">Tapa completa agripada</label>
              <div className="seg">
                <button className={tapaAgr ? 'on' : ''} style={tapaAgr ? { borderColor: '#e11d1d', color: '#e11d1d', background: 'rgba(225,29,29,.08)' } : undefined} onClick={() => void updateTapa(selTapa, { tapaAgripada: true })}>Sí</button>
                <button className={!tapaAgr ? 'on' : ''} onClick={() => void updateTapa(selTapa, { tapaAgripada: false })}>No</button>
              </div>

              <div className="row" style={{ marginTop: 14, gap: 8 }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => void updateTapa(selTapa, { tapaAgripada: false, segurosAgripados: false, pernosRodados: [], marca: 'normalizada' })}>Normalizada</button>
                <button className="btn" style={{ flex: 1 }} onClick={() => void updateTapa(selTapa, { tapaAgripada: false, segurosAgripados: false, pernosRodados: [], marca: '' })}>Sin problema</button>
                <button className="btn ghost" onClick={() => { void limpiarTapa(selTapa); setSelTapa(null) }}>Limpiar</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
