// Control de ovalamiento de sideport.
//
// Usa el mismo plano de vasijas que el retiro de tapas —semi rack A y semi rack
// B— y arriba se elige el lado: alimentación o descarga. La vasija se pinta con
// el peor estado de sus dos sideport, así el plano muestra de una dónde está el
// problema.
//
// Al tocar una vasija se abre su detalle: el número al medio y sus dos
// sideport a los costados. Tocando una sideport se le pone el estado —buena,
// pendiente de retiro o crítica para cambio—, su nota y su foto.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { encolar } from './sync'
import { quienSoy } from './identidad'
import { fileToJpeg } from './util'
import { ordenSemiRacks, TOTAL_VASIJAS, type Vista } from './rackLayout'
import { LADOS, type LadoRack } from './types'
import { usePuedeRegistrar, useRack } from './rackOutage'
import { useModal } from './useModal'
import PlanoRack from './PlanoRack'
import {
  ESTADOS_SIDEPORT, colorSideport, enlaceFoto, filaOvalamiento, nombreSideport,
  ovalId, resumirOval, subirFotoSideport,
  type EstadoSideport, type Ovalamiento as Oval, type Sideport,
} from './sideports'

/** El peor de los dos: si una está crítica, la vasija se ve crítica. */
function peor(estados: EstadoSideport[]): EstadoSideport {
  if (estados.includes('critica')) return 'critica'
  if (estados.includes('pendiente')) return 'pendiente'
  return 'ok'
}

export default function Ovalamiento() {
  const rack = useRack()
  const puedeRegistrar = usePuedeRegistrar()
  const [lado, setLado] = useState<LadoRack>('alimentacion')
  const [vista, setVista] = useState<Vista>(ordenSemiRacks(false)[0])
  const [sel, abrirVasija, cerrarVasija] = useModal<string>()
  const [selPort, setSelPort] = useState<Sideport | null>(null)
  const [error, setError] = useState('')
  const [subiendo, setSubiendo] = useState(false)

  const filas = useLiveQuery(
    () => db.ovalamientos.where('[lado+rack]').equals([lado, rack]).toArray(),
    [lado, rack],
  ) ?? []

  const de = (vasija: string, sideport: Sideport): Oval => {
    const id = ovalId(lado, rack, vasija, sideport)
    const f = filas.find((x) => x.id === id)
    return {
      id, rack, lado, vasija, sideport,
      estado: ((f?.estado as EstadoSideport) ?? 'ok'),
      nota: f?.nota ?? '',
      foto: f?.foto ?? null,
    }
  }
  const miniatura = (id: string) => filas.find((x) => x.id === id)?.miniatura

  /** Solo cuenta lo REVISADO: lo que nadie tocó todavía no dice nada. */
  const revisadas = filas.filter((f) => f.estado !== 'ok' || f.nota || f.foto)
  const resumen = resumirOval(filas.map((f) => ({ ...f, estado: f.estado as EstadoSideport })) as Oval[])

  const guardar = async (o: Oval, cambio: Partial<Oval>) => {
    if (!puedeRegistrar) return
    const nuevo: Oval = { ...o, ...cambio }
    setError('')
    try {
      await db.ovalamientos.put({
        id: nuevo.id, rack: nuevo.rack, lado: nuevo.lado, vasija: nuevo.vasija,
        sideport: nuevo.sideport, estado: nuevo.estado, nota: nuevo.nota, foto: nuevo.foto,
        miniatura: (cambio as { miniatura?: string }).miniatura ?? miniatura(nuevo.id),
        sincronizado: false,
      })
      await encolar('oval_upsert', filaOvalamiento(nuevo, quienSoy()))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    }
  }

  /** La foto: se reduce, se guarda una copia chica en el celular para verla
      sin señal, y se sube al servidor para que la vea el resto. */
  const ponerFoto = async (o: Oval, archivo: File | undefined) => {
    if (!archivo) return
    setSubiendo(true); setError('')
    try {
      const chica = await fileToJpeg(archivo, 1280, 0.72)
      const blob = await (await fetch(chica)).blob()
      let ruta: string | null = null
      try {
        ruta = await subirFotoSideport(o.id, blob, archivo.name)
      } catch {
        setError('La foto quedó en el celular: sin señal no se pudo subir. Vuelve a tomarla con señal para compartirla.')
      }
      await guardar(o, { foto: ruta ?? o.foto, miniatura: chica } as Partial<Oval>)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo usar la foto.')
    } finally {
      setSubiendo(false)
    }
  }

  const verFoto = async (ruta: string) => {
    try { window.open(await enlaceFoto(ruta), '_blank') } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir la foto.')
    }
  }

  // el color de cada vasija en el plano: el peor de sus dos sideport
  const colores = new Map<string, { color: string; texto: string }>()
  for (const f of filas) {
    if (f.estado === 'ok') continue
    const otra = filas.find((x) => x.vasija === f.vasija && x.sideport !== f.sideport)
    const e = peor([f.estado as EstadoSideport, (otra?.estado as EstadoSideport) ?? 'ok'])
    colores.set(f.vasija, { color: colorSideport(e), texto: '#fff' })
  }

  const detalle = () => {
    if (!sel) return null
    const norte = de(sel, 'norte')
    const sur = de(sel, 'sur')
    const abierto = selPort ? de(sel, selPort) : null
    return (
      <div className="modal-overlay" onClick={() => { cerrarVasija(); setSelPort(null) }}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <b>Vasija {sel} · {LADOS.find((l) => l.codigo === lado)?.nombre}</b>
            <button className="modal-x" onClick={() => { cerrarVasija(); setSelPort(null) }}>✕</button>
          </div>

          {/* la vasija al medio y sus dos sideport a los costados */}
          <svg viewBox="0 0 320 200" className="oval-dibujo">
            <line x1={70} y1={100} x2={250} y2={100} stroke="#cbd5e1" strokeWidth={6} />
            <circle cx={160} cy={100} r={52} fill="#f8fafc" stroke="#94a3b8" strokeWidth={3} />
            <text x={160} y={108} textAnchor="middle" fontSize={26} fontWeight={800} fill="#0f172a">{sel}</text>
            {([['norte', 70, norte], ['sur', 250, sur]] as const).map(([cod, x, o]) => (
              <g key={cod} onClick={() => setSelPort(cod as Sideport)} style={{ cursor: 'pointer' }}>
                <circle
                  cx={x} cy={100} r={30}
                  fill={colorSideport(o.estado)} stroke="#0f172a" strokeWidth={selPort === cod ? 3.5 : 1.5}
                  opacity={o.estado === 'ok' ? 0.25 : 1}
                />
                <text x={x} y={106} textAnchor="middle" fontSize={16} fontWeight={800}
                  fill={o.estado === 'ok' ? '#0f172a' : '#fff'}>
                  {ESTADOS_SIDEPORT.find((e) => e.codigo === o.estado)?.corto}
                </text>
                <text x={x} y={156} textAnchor="middle" fontSize={13} fontWeight={700} fill="#0f172a">
                  {nombreSideport(cod as Sideport)}
                </text>
                {o.foto && <text x={x} y={172} textAnchor="middle" fontSize={11} fill="#64748b">con foto</text>}
              </g>
            ))}
          </svg>

          {!abierto
            ? <p className="hint">Toca una sideport para anotar cómo está.</p>
            : (
              <>
                <h3 className="sec">Sideport {nombreSideport(abierto.sideport)}</h3>
                {error && <p className="memb-aviso">{error}</p>}
                <div className="seg">
                  {ESTADOS_SIDEPORT.map((e) => (
                    <button
                      key={e.codigo}
                      className={abierto.estado === e.codigo ? 'on' : ''}
                      disabled={!puedeRegistrar}
                      onClick={() => void guardar(abierto, { estado: e.codigo })}
                    >
                      {e.nombre}
                    </button>
                  ))}
                </div>

                <label className="lab">Nota</label>
                <textarea
                  rows={2} defaultValue={abierto.nota} disabled={!puedeRegistrar}
                  placeholder="Qué se vio: medida, dónde está ovalada"
                  onBlur={(e) => { if (e.target.value !== abierto.nota) void guardar(abierto, { nota: e.target.value }) }}
                />

                {miniatura(abierto.id) && (
                  <div className="oval-foto">
                    <img src={miniatura(abierto.id)} alt="" />
                    {abierto.foto && (
                      <button className="btn sm ghost" onClick={() => void verFoto(abierto.foto!)}>Ver grande</button>
                    )}
                    {!abierto.foto && <small className="hint">Solo en este celular: falta subirla.</small>}
                  </div>
                )}
                {!miniatura(abierto.id) && abierto.foto && (
                  <button className="btn sm ghost" onClick={() => void verFoto(abierto.foto!)}>Ver la foto</button>
                )}

                {puedeRegistrar && (
                  <label className="btn add" style={{ marginTop: 8 }}>
                    {subiendo ? 'Guardando la foto…' : (abierto.foto || miniatura(abierto.id) ? '+ Cambiar la foto' : '+ Foto de la sideport')}
                    <input
                      type="file" accept="image/*" capture="environment" hidden
                      onChange={(e) => void ponerFoto(abierto, e.target.files?.[0])}
                    />
                  </label>
                )}
              </>
            )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="avance">
        <div className="avance-top">
          <b>{revisadas.length}</b>
          <span>de {TOTAL_VASIJAS * 2} sideport con algo anotado</span>
        </div>
        <div className="minuta-resumen" style={{ marginTop: 8 }}>
          <span className="ok"><b>{resumen.ok}</b> sin problema</span>
          <span><b>{resumen.pendiente}</b> pendientes de retiro</span>
          <span><b>{resumen.critica}</b> críticas para cambio</span>
        </div>
      </div>

      <div className="seg">
        {LADOS.map((l) => (
          <button key={l.codigo} className={lado === l.codigo ? 'on' : ''} onClick={() => setLado(l.codigo)}>
            {l.nombre}
          </button>
        ))}
      </div>

      <div className="seg" style={{ marginTop: 8 }}>
        {[...ordenSemiRacks(lado === 'descarga'), 'todo' as Vista].map((v) => (
          <button key={v} className={vista === v ? 'on' : ''} onClick={() => setVista(v)}>
            {v === 'todo' ? 'Todo' : `Semi Rack ${v}`}
          </button>
        ))}
      </div>

      <div className="plano-titulo" style={{ marginTop: 12 }}>
        <b>CONTROL DE OVALAMIENTO · SIDEPORT</b>
        <span>RACK {rack} · {LADOS.find((l) => l.codigo === lado)?.nombre.toUpperCase()}</span>
      </div>

      {error && !sel && <p className="memb-aviso">{error}</p>}

      <PlanoRack
        modo="simple"
        vista={vista}
        espejo={lado === 'descarga'}
        tapaRec={new Map()}
        porVasija={new Map()}
        hechos={new Set()}
        colores={colores}
        onVasija={(id) => { abrirVasija(id); setSelPort(null) }}
      />

      <p className="hint" style={{ marginTop: 10 }}>
        La vasija se pinta con el peor estado de sus dos sideport:
        naranjo si queda <b>pendiente de retiro</b>, rojo si está <b>crítica para cambio</b>.
      </p>

      {sel && detalle()}
    </div>
  )
}
