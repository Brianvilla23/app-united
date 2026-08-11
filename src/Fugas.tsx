import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { encolar, registrar } from './sync'
import { quienSoy } from './identidad'
import {
  COMPONENTES, TOTAL_VASIJAS, RACKS,
  MARCA, MARCA_BORDE, PLOMO, PLOMO_BORDE,
  type ComponenteFuga, type Vista,
} from './rackLayout'
import {
  ESTADOS_TAPA, LADOS, RACK_TAPAS, defEstadoTapa, estadoTapaDe, esInstalacion, resumirTapas, tapaId,
  PERNOS_POR_TAPA, SEGUROS_POR_TAPA,
  type TapaEstado, type LadoRack,
} from './types'
import { generarPDFTapas, nombreArchivoTapas } from './pdfTapas'
import { fechaHistorial } from './fecha'
import PlanoRack, { AZUL, VERDE } from './PlanoRack'
import FugasManifold from './FugasManifold'
import ComentarioRack from './ComentarioRack'

// texto corto del estado de una tapa, para el historial
function describirTapa(t: Pick<TapaEstado, 'tapaAgripada' | 'segurosAgripados' | 'pernosRodados' | 'aislada'>): string {
  const p: string[] = []
  if (t.aislada) p.push('aislada')
  if (t.tapaAgripada) p.push('tapa agripada')
  if (t.segurosAgripados.length) p.push(`seguros ${t.segurosAgripados.map((i) => i + 1).sort().join(', ')}`)
  if (t.pernosRodados.length) p.push(`pernos ${t.pernosRodados.map((i) => i + 1).sort().join(', ')}`)
  return p.length ? p.join(' · ') : 'sin fallas'
}

// arco de circunferencia (seguros triples del detalle de tapa)
function arco(cx0: number, cy0: number, r: number, a0: number, a1: number): string {
  const rad = (d: number) => (d * Math.PI) / 180
  const x0 = cx0 + r * Math.cos(rad(a0)), y0 = cy0 + r * Math.sin(rad(a0))
  const x1 = cx0 + r * Math.cos(rad(a1)), y1 = cy0 + r * Math.sin(rad(a1))
  const large = a1 - a0 > 180 ? 1 : 0
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`
}

/** El levantamiento tiene tres vistas: las vasijas, el estado de tapas y el
    manifold (que es donde aparecen las fugas de barra, stub end, brazo y
    tubing, y que no cabía en el plano de vasijas). */
export type ModoFugas = 'fugas' | 'tapas' | 'manifold'

export default function Fugas({
  modoInicial = 'fugas', actividad = 'retiro_tapas_alim', titulo, ladoFijo,
}: {
  modoInicial?: ModoFugas
  actividad?: string
  titulo?: string
  /** Cuando se entra desde una actividad del outage, el lado ya viene definido
      y no hay nada que elegir: se ocultan el conmutador Fugas/Tapas y el
      selector de lado, que ahí solo confunden. */
  ladoFijo?: LadoRack
}) {
  const [modo, setModo] = useState<ModoFugas>(modoInicial)
  const [rackFugas, setRackFugas] = useState(1)
  const [lado, setLado] = useState<LadoRack>(ladoFijo ?? 'alimentacion')
  const [vista, setVista] = useState<Vista>('A')
  const [sel, setSel] = useState<string | null>(null)
  const [selTapa, setSelTapa] = useState<string | null>(null)
  const todas = useLiveQuery(() => db.marcas.toArray(), []) ?? []
  const todasTapas = useLiveQuery(() => db.tapas.toArray(), []) ?? []

  // En tapas solo se interviene el Rack 12; en fugas siguen los 12 racks.
  const rack = modo === 'tapas' ? RACK_TAPAS : rackFugas
  const espejo = modo === 'tapas' && lado === 'descarga'

  const marcas = todas.filter((m) => m.rack === rack)
  const porVasija = new Map<string, Set<ComponenteFuga>>()
  for (const m of marcas) {
    if (!porVasija.has(m.vasija)) porVasija.set(m.vasija, new Set())
    porVasija.get(m.vasija)!.add(m.componente)
  }
  const racksConMarcas = new Set(todas.map((m) => m.rack))

  // tapas del rack Y del lado que se está viendo (son piezas distintas por lado)
  const tapaRec = new Map<string, TapaEstado>()
  for (const t of todasTapas) if (t.rack === rack && t.lado === lado && t.actividad === actividad) tapaRec.set(t.vasija, t)
  const resumen = resumirTapas([...tapaRec.values()], TOTAL_VASIJAS)
  const tapasPorLado = (l: LadoRack) => todasTapas.filter((t) => t.rack === RACK_TAPAS && t.lado === l && t.actividad === actividad).length

  const updateTapa = async (vasija: string, patch: Partial<TapaEstado>) => {
    const id = tapaId(actividad, lado, rack, vasija)
    const yo = quienSoy()
    const cur = todasTapas.find((t) => t.id === id)
    const base: TapaEstado = cur ?? {
      id, actividad, lado, rack, vasija,
      tapaAgripada: false, segurosAgripados: [], pernosRodados: [], aislada: false,
      tapon: false, shimMm: null,
      creadoPor: yo, createdAt: Date.now(), sincronizado: false,
    }
    const next: TapaEstado = { ...base, ...patch, id, actividad, lado, rack, vasija, creadoPor: yo, sincronizado: false }
    await db.tapas.put(next)
    await encolar('tapas_upsert', {
      actividad, lado, rack, vasija,
      tapa_agripada: next.tapaAgripada,
      seguros_agripados: next.segurosAgripados,
      pernos_rodados: next.pernosRodados,
      aislada: next.aislada,
      tapon: next.tapon ?? false,
      shim_mm: next.shimMm ?? null,
      creado_por: yo,
    })
    await registrar('tapa', lado, rack, vasija, 'actualizó tapa', describirTapa(next))
  }

  const togglePerno = (vasija: string, i: number) => {
    const cur = tapaRec.get(vasija)?.pernosRodados ?? []
    const next = cur.includes(i) ? cur.filter((p) => p !== i) : [...cur, i]
    void updateTapa(vasija, { pernosRodados: next })
  }

  const toggleSeguro = (vasija: string, i: number) => {
    const cur = tapaRec.get(vasija)?.segurosAgripados ?? []
    const next = cur.includes(i) ? cur.filter((s) => s !== i) : [...cur, i]
    void updateTapa(vasija, { segurosAgripados: next })
  }

  const toggleAislada = (vasija: string) => {
    void updateTapa(vasija, { aislada: !(tapaRec.get(vasija)?.aislada ?? false) })
  }

  const limpiarTapa = async (vasija: string) => {
    await db.tapas.delete(tapaId(actividad, lado, rack, vasija))
    await encolar('tapas_delete', { actividad, lado, rack, vasija })
    await registrar('tapa', lado, rack, vasija, 'borró el registro de la tapa')
  }

  const [generando, setGenerando] = useState(false)

  const exportarPDF = async () => {
    setGenerando(true)
    try {
      const doc = await generarPDFTapas({
        lado, rack,
        tapas: [...tapaRec.values()],
        totalVasijas: TOTAL_VASIJAS,
        generadoPor: quienSoy(),
      })
      doc.save(nombreArchivoTapas(lado, rack))
    } finally {
      setGenerando(false)
    }
  }

  const toggle = async (vasija: string, componente: ComponenteFuga) => {
    const id = `${rack}-${vasija}-${componente}`
    const yo = quienSoy()
    const existe = await db.marcas.get(id)
    if (existe) {
      await db.marcas.delete(id)
      await encolar('marcas_delete', { lado: 'alimentacion', rack, vasija, componente })
      await registrar('fuga', 'alimentacion', rack, vasija, 'quitó fuga', componente)
    } else {
      const creado = Date.now()
      await db.marcas.add({ id, rack, vasija, componente, creadoPor: yo, createdAt: creado, sincronizado: false })
      await encolar('marcas_upsert', { lado: 'alimentacion', rack, vasija, componente, creado_por: yo, created_at: new Date(creado).toISOString() })
      await registrar('fuga', 'alimentacion', rack, vasija, 'marcó fuga', componente)
    }
  }

  const selSet = sel ? porVasija.get(sel) ?? new Set<ComponenteFuga>() : new Set<ComponenteFuga>()
  const marcada = (c: ComponenteFuga) => selSet.has(c)


  return (
    <div>
      {!ladoFijo && (
        <div className="vista-seg" style={{ marginBottom: 10 }}>
          <button className={modo === 'fugas' ? 'on' : ''} onClick={() => setModo('fugas')}>Vasijas</button>
          <button className={modo === 'manifold' ? 'on' : ''} onClick={() => setModo('manifold')}>Manifold</button>
          <button className={modo === 'tapas' ? 'on' : ''} onClick={() => setModo('tapas')}>Tapas</button>
        </div>
      )}

      {modo !== 'tapas' ? (
        <div className="rack-tabs">
          {RACKS.map((r) => (
            <button key={r} className={'rack-tab' + (r === rack ? ' on' : '')} onClick={() => setRackFugas(r)}>
              R{r}{racksConMarcas.has(r) && <span className="rack-dot" />}
            </button>
          ))}
        </div>
      ) : (
        <>
          {!ladoFijo && <div className="lado-seg">
            {LADOS.map((l) => (
              <button
                key={l.codigo}
                className={lado === l.codigo ? 'on' : ''}
                onClick={() => setLado(l.codigo)}
              >
                {l.corto}
                <small>{tapasPorLado(l.codigo)} tapas</small>
              </button>
            ))}
          </div>}

          <div className="avance">
            <div className="avance-top">
              <b>{resumen.porcentaje}%</b>
              <span>{resumen.extraidas} de {resumen.total} tapas extraídas</span>
              <button className="btn sm ghost" disabled={generando} onClick={() => void exportarPDF()}>
                {generando ? 'Generando…' : 'PDF'}
              </button>
            </div>
            <div className="avance-bar">
              <span style={{ width: `${resumen.porcentaje}%`, background: defEstadoTapa('retirada').color }} />
            </div>
          </div>
        </>
      )}

      {modo === 'manifold' ? <FugasManifold rack={rack} /> : (<>

      <div className="vista-seg">
        <button className={vista === 'A' ? 'on' : ''} onClick={() => setVista('A')}>Semi Rack A</button>
        <button className={vista === 'B' ? 'on' : ''} onClick={() => setVista('B')}>Semi Rack B</button>
        <button className={vista === 'todo' ? 'on' : ''} onClick={() => setVista('todo')}>Todo</button>
      </div>

      <div className="plano-titulo">
        <b>{titulo ?? `RACK ${rack}`}</b>
        <span>{modo === 'tapas' ? LADOS.find((l) => l.codigo === lado)!.nombre.toUpperCase() : 'LADO ALIMENTACIÓN'}</span>
      </div>

      <div className="fugas-scroll">
        <PlanoRack
          modo={modo}
          vista={vista}
          espejo={espejo}
          tapaRec={tapaRec}
          porVasija={porVasija}
          onVasija={(id) => (modo === 'fugas' ? setSel(id) : setSelTapa(id))}
        />
      </div>

      <div className="leyenda abajo">
        {modo === 'fugas' ? (
          <>
            <span className="leg-item" style={{ fontWeight: 800, color: '#8a6d03' }}>
              <span className="leg-dot" style={{ background: MARCA }} /> Amarillo = fuga
            </span>
            <span className="leg-item">Rack {rack} · {marcas.length} marcas</span>
          </>
        ) : (
          <>
            <b className="leg-titulo">LEYENDA</b>
            {ESTADOS_TAPA.map((e) => (
              <span key={e.codigo} className="leg-item">
                <span className="leg-dot" style={{ background: e.color }} /> {e.nombre}
                <em>{e.descripcion}</em>
                <i>{resumen.porEstado[e.codigo]}</i>
              </span>
            ))}
            <span className="leg-item">
              <span className="leg-dot vacio" /> Sin registrar
              <em>Todavía no se revisa</em>
              <i>{resumen.total - resumen.registradas}</i>
            </span>
            <span className="leg-item total">
              <span className="leg-dot oculto" /> TOTAL
              <em>Vasijas del Rack {rack}</em>
              <i>{resumen.total}</i>
            </span>
            <span className="leg-item total avance-fila">
              <span className="leg-dot oculto" /> AVANCE
              <em>{resumen.extraidas} extraídas de {resumen.total}</em>
              <i>{resumen.porcentaje}%</i>
            </span>
          </>
        )}
      </div>

      </>)}

      {sel && (
        <div className="modal-overlay" onClick={() => setSel(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <b>Rack {rack} · Vasija {sel}</b>
              <button className="modal-x" onClick={() => setSel(null)}>✕</button>
            </div>
            <p className="hint" style={{ margin: '0 0 8px' }}>Toca el componente con fuga · se pinta amarillo</p>

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
        const segs = rec?.segurosAgripados ?? []
        const pernos = rec?.pernosRodados ?? []
        const aislada = rec?.aislada ?? false
        const est = rec ? estadoTapaDe(rec) : null
        const headFill = aislada
          ? defEstadoTapa('aislada').color
          : tapaAgr ? defEstadoTapa('agripada').color
          : est === 'retirada' ? defEstadoTapa('retirada').color
          : '#eef1f4'
        const C = 135
        return (
          <div className="modal-overlay" onClick={() => setSelTapa(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <b>Rack {rack} · Tapa {selTapa}</b>
                <button className="modal-x" onClick={() => setSelTapa(null)}>✕</button>
              </div>
              <p className="hint" style={{ margin: '0 0 8px' }}>
                {LADOS.find((l) => l.codigo === lado)!.nombre} · toca los seguros o pernos con falla. Toca el borde = tapa agripada.
              </p>

              <svg viewBox="0 0 270 330" style={{ width: '100%', maxWidth: 330, display: 'block', margin: '0 auto' }}>
                {/* cabeza (tocar el borde = tapa agripada) */}
                <circle cx={C} cy={C} r={110} fill={headFill} stroke={tapaAgr ? '#7f2f1c' : '#b8bec4'} strokeWidth={tapaAgr ? 4 : 3} onClick={() => void updateTapa(selTapa, { tapaAgripada: !tapaAgr })} style={{ cursor: 'pointer' }} />
                <circle cx={C} cy={C} r={100} fill={tapaAgr ? 'rgba(255,255,255,.14)' : '#f7f9fb'} stroke="#cbd2d8" strokeWidth={1} pointerEvents="none" />

                {/* 3 seguros triples (arcos) */}
                {Array.from({ length: SEGUROS_POR_TAPA }).map((_, i) => {
                  const a0 = -90 + i * 120 + 10, a1 = -90 + i * 120 + 110
                  const on = segs.includes(i)
                  return (
                    <g key={'sg' + i} onClick={() => toggleSeguro(selTapa, i)} style={{ cursor: 'pointer' }}>
                      <path d={arco(C, C, 62, a0, a1)} fill="none" stroke={on ? defEstadoTapa('seguros').color : '#cfd6dd'} strokeWidth={16} strokeLinecap="round" opacity={on ? 1 : 0.3} />
                    </g>
                  )
                })}

                {/* puerto de permeado (centro). En la instalación es el TAPÓN
                    y se toca para marcarlo puesto. */}
                {esInstalacion(actividad) ? (
                  <g onClick={() => void updateTapa(selTapa, { tapon: !(rec?.tapon ?? false) })} style={{ cursor: 'pointer' }}>
                    <circle cx={C} cy={C} r={27} fill={rec?.tapon ? '#15803d' : '#2b2f33'} />
                    <circle cx={C} cy={C} r={19} fill="none" stroke={rec?.tapon ? '#86efac' : '#dc2626'} strokeWidth={6} />
                    {rec?.tapon
                      ? <path d={`M ${C - 8} ${C} l 5 5.5 l 10.5 -11`} fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
                      : <circle cx={C} cy={C} r={9} fill="#0f172a" />}
                    <text x={C} y={C + 46} textAnchor="middle" fontSize={10} fontWeight={800} fill={rec?.tapon ? '#15803d' : '#64748b'}>TAPÓN</text>
                  </g>
                ) : (
                  <>
                    <circle cx={C} cy={C} r={26} fill="#2b2f33" pointerEvents="none" />
                    <circle cx={C} cy={C} r={19} fill="none" stroke="#dc2626" strokeWidth={6} pointerEvents="none" />
                    <circle cx={C} cy={C} r={9} fill="#0f172a" pointerEvents="none" />
                  </>
                )}

                {/* 3 pernos parker */}
                {Array.from({ length: PERNOS_POR_TAPA }).map((_, i) => {
                  const ang = ((-30 + i * 120) * Math.PI) / 180
                  const px = C + 86 * Math.cos(ang), py = C + 86 * Math.sin(ang)
                  const on = pernos.includes(i)
                  return (
                    <g key={'pk' + i} onClick={() => togglePerno(selTapa, i)} style={{ cursor: 'pointer' }} opacity={on ? 1 : 0.4}>
                      <circle cx={px} cy={py} r={14} fill={on ? defEstadoTapa('pernos').color : '#c3c9cf'} stroke={on ? '#92400e' : '#8a9199'} strokeWidth={2} />
                      <text x={px} y={py + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={on ? '#fff' : '#4b5563'}>{i + 1}</text>
                    </g>
                  )
                })}

                <text x={C} y={266} textAnchor="middle" fontSize={10} fill="#94a3b8">arcos = 3 seguros triples · círculos = 3 pernos parker</text>

                {/* Vasija aislada: parte del esquema, se toca igual que los seguros y pernos */}
                <g onClick={() => toggleAislada(selTapa)} style={{ cursor: 'pointer' }}>
                  <rect
                    x={45} y={282} width={180} height={34} rx={17}
                    fill={aislada ? defEstadoTapa('aislada').color : '#f1f5f9'}
                    stroke={aislada ? '#1d4ed8' : '#c3ccd6'}
                    strokeWidth={aislada ? 2.5 : 1.8}
                  />
                  <circle cx={68} cy={299} r={8} fill={aislada ? '#fff' : '#cfd6dd'} />
                  {aislada && <path d="M 63.5 299 l 3.2 3.4 l 6-6.6" fill="none" stroke={defEstadoTapa('aislada').color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />}
                  <text x={144} y={304} textAnchor="middle" fontSize={13} fontWeight={800} fill={aislada ? '#fff' : '#64748b'}>
                    VASIJA AISLADA
                  </text>
                </g>
              </svg>

              <div className="hint" style={{ textAlign: 'center', marginTop: 4 }}>
                Seguros agripados: <b>{segs.length}</b> · Pernos rodados: <b>{pernos.length}</b> · Tapa: <b>{tapaAgr ? 'agripada' : 'ok'}</b>
                {est && <> · Estado: <b style={{ color: defEstadoTapa(est).color }}>{defEstadoTapa(est).nombre}</b></>}
              </div>

              {esInstalacion(actividad) && (
                <div className="shim">
                  <label>Graduación de shim</label>
                  <div className="shim-campo">
                    <input
                      type="number" inputMode="decimal" step="0.5" min="0"
                      value={rec?.shimMm ?? ''}
                      placeholder="0"
                      onChange={(e) => void updateTapa(selTapa, {
                        shimMm: e.target.value === '' ? null : Number(e.target.value),
                      })}
                    />
                    <span>mm</span>
                  </div>
                </div>
              )}

              <div className="row" style={{ marginTop: 12, gap: 8 }}>
                <button className="btn" style={{ flex: 2, borderColor: '#16a34a', color: '#15803d' }} onClick={() => void updateTapa(selTapa, { tapaAgripada: false, segurosAgripados: [], pernosRodados: [], aislada: false })}>
                  {esInstalacion(actividad) ? 'Marcar instalada OK' : 'Marcar retirada OK'}
                </button>
                <button className="btn ghost" onClick={() => { void limpiarTapa(selTapa); setSelTapa(null) }}>Limpiar</button>
              </div>
            </div>
          </div>
        )
      })()}

      <ComentarioRack rack={rack} />

      <Historial rack={rack} lado={modo === 'tapas' ? lado : 'alimentacion'} />
    </div>
  )
}

function Historial({ rack, lado }: { rack: number; lado: LadoRack }) {
  const [abierto, setAbierto] = useState(false)
  const todos = useLiveQuery(
    () => db.historial.where('rack').equals(rack).reverse().sortBy('createdAt'),
    [rack],
  ) ?? []
  const items = todos.filter((h) => (h.lado ?? 'alimentacion') === lado)

  return (
    <div className="historial">
      <button className="historial-head" onClick={() => setAbierto((a) => !a)}>
        <span>Historial del Rack {rack}</span>
        <span className="historial-n">{items.length} · {abierto ? '▾' : '▸'}</span>
      </button>
      {abierto && (
        items.length === 0
          ? <p className="hint" style={{ padding: '8px 12px' }}>Todavía no hay movimientos en este rack.</p>
          : (
            <ul className="historial-lista">
              {items.slice(0, 60).map((h) => (
                <li key={h.id}>
                  <b>{h.vasija}</b> · {h.accion}
                  {h.detalle && <> — {h.detalle}</>}
                  <small>{h.quien} · {fechaHistorial(h.createdAt)}</small>
                </li>
              ))}
            </ul>
          )
      )}
    </div>
  )
}
