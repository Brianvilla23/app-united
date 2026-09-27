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
import { celdasPara, ordenSemiRacks, TOTAL_VASIJAS, type Vista } from './rackLayout'
import { LADOS, type LadoRack } from './types'
import { usePuedeRegistrar, useRack } from './rackOutage'
import { useModal } from './useModal'
import PlanoRack from './PlanoRack'
import {
  ESTADOS_SIDEPORT, SIN_REVISAR, colorSideport, enlaceFoto, filaOvalamiento, nombreSideport,
  borrarFotoSideport, ovalId, resumirOval, subirFotoSideport,
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

  const revisada = (vasija: string, sideport: Sideport) =>
    filas.some((x) => x.id === ovalId(lado, rack, vasija, sideport))

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

  /** `mini` va aparte del resto porque la miniatura vive solo en este celular:
      `undefined` = déjala como está, `null` = bórrala. */
  const guardar = async (o: Oval, cambio: Partial<Oval>, mini?: string | null) => {
    if (!puedeRegistrar) return
    const nuevo: Oval = { ...o, ...cambio }
    setError('')
    try {
      await db.ovalamientos.put({
        id: nuevo.id, rack: nuevo.rack, lado: nuevo.lado, vasija: nuevo.vasija,
        sideport: nuevo.sideport, estado: nuevo.estado, nota: nuevo.nota, foto: nuevo.foto,
        miniatura: mini === null ? undefined : (mini ?? miniatura(nuevo.id)),
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
      await guardar(o, { foto: ruta ?? o.foto }, chica)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo usar la foto.')
    } finally {
      setSubiendo(false)
    }
  }

  const quitarFoto = async (o: Oval) => {
    setError('')
    try {
      if (o.foto) await borrarFotoSideport(o.foto)
    } catch { /* si ya no está en el servidor, igual la sacamos de acá */ }
    await guardar(o, { foto: null }, null)
  }

  const verFoto = async (ruta: string) => {
    try { window.open(await enlaceFoto(ruta), '_blank') } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir la foto.')
    }
  }

  // En el plano, cada vasija muestra sus DOS sideport a los costados con su
  // color: verde bien, amarillo pendiente, rojo para cambio. La vasija misma
  // se pinta con el peor de los dos, para verlo de lejos.
  const colores = new Map<string, { color: string; texto: string }>()
  const sideports = new Map<string, { norte: string; sur: string }>()
  for (const celda of celdasPara(false)) {
    const v = celda.id
    const n = filas.find((f) => f.vasija === v && f.sideport === 'norte')
    const s2 = filas.find((f) => f.vasija === v && f.sideport === 'sur')
    sideports.set(v, {
      norte: n ? colorSideport(n.estado as EstadoSideport) : SIN_REVISAR,
      sur: s2 ? colorSideport(s2.estado as EstadoSideport) : SIN_REVISAR,
    })
    const e = peor([(n?.estado as EstadoSideport) ?? 'ok', (s2?.estado as EstadoSideport) ?? 'ok'])
    if (e !== 'ok') colores.set(v, { color: colorSideport(e), texto: '#fff' })
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

          {/* La vasija al medio con su número, y las sideport como rectángulos
              a cada costado: es como se ven en terreno, no como círculos. */}
          <svg viewBox="0 0 320 190" className="oval-dibujo">
            <line x1={40} y1={95} x2={280} y2={95} stroke="#cbd5e1" strokeWidth={6} />
            <circle cx={160} cy={95} r={50} fill="#f8fafc" stroke="#94a3b8" strokeWidth={3} />
            <text x={160} y={103} textAnchor="middle" fontSize={25} fontWeight={800} fill="#0f172a">{sel}</text>
            {([['norte', 34, norte], ['sur', 218, sur]] as const).map(([cod, x, o]) => (
              <g key={cod} onClick={() => setSelPort(cod as Sideport)} style={{ cursor: 'pointer' }}>
                <rect
                  x={x} y={68} width={68} height={54} rx={7}
                  fill={revisada(sel, cod as Sideport) ? colorSideport(o.estado) : SIN_REVISAR} stroke="#0f172a"
                  strokeWidth={selPort === cod ? 3.5 : 1.4}
                />
                <text
                  x={x + 34} y={101} textAnchor="middle" fontSize={20} fontWeight={800}
                  fill="#fff"
                >
                  {revisada(sel, cod as Sideport) ? ESTADOS_SIDEPORT.find((e) => e.codigo === o.estado)?.corto : '?'}
                </text>
                <text x={x + 34} y={144} textAnchor="middle" fontSize={13} fontWeight={700} fill="#0f172a">
                  {nombreSideport(cod as Sideport)}
                </text>
                <text x={x + 34} y={161} textAnchor="middle" fontSize={11} fill="#64748b">
                  {revisada(sel, cod as Sideport)
                    ? ESTADOS_SIDEPORT.find((e) => e.codigo === o.estado)?.nombre
                    : 'Sin revisar'}
                </text>
                {o.foto && <text x={x + 34} y={177} textAnchor="middle" fontSize={11} fill="#64748b">con foto</text>}
                {/* zona de toque: cubre el rectángulo y sus rótulos, para que
                    se pueda tocar con guantes sin apuntar fino */}
                <rect x={x} y={60} width={68} height={122} fill="transparent" />
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
                      className={revisada(sel, abierto.sideport) && abierto.estado === e.codigo ? 'on' : ''}
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

                {(miniatura(abierto.id) || abierto.foto) && (
                  <div className="oval-foto">
                    <h4 className="sec">Foto</h4>
                    {miniatura(abierto.id) && <img src={miniatura(abierto.id)} alt="" />}
                    {!abierto.foto && miniatura(abierto.id) && (
                      <small className="hint">Solo en este celular: falta subirla.</small>
                    )}
                    <div className="row" style={{ gap: 8, marginTop: 4 }}>
                      {abierto.foto && (
                        <button className="btn sm ghost" onClick={() => void verFoto(abierto.foto!)}>
                          Ver grande
                        </button>
                      )}
                      {puedeRegistrar && (
                        <button className="btn sm ghost" onClick={() => void quitarFoto(abierto)}>
                          Borrar la foto
                        </button>
                      )}
                    </div>
                  </div>
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
          <span><b>{resumen.pendiente}</b> pendiente cambio</span>
          <span><b>{resumen.critica}</b> para cambio</span>
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
        sideports={sideports}
        onVasija={(id) => { abrirVasija(id); setSelPort(null) }}
      />

      <p className="hint" style={{ marginTop: 10 }}>
        Cada vasija muestra sus dos sideport a los costados: <b>gris</b> sin revisar,
        <b>verde</b> sin problema, <b>amarillo</b> pendiente cambio, <b>rojo</b> para
        cambio. La vasija se pinta con la peor de las dos, para verlo de lejos.
      </p>

      {sel && detalle()}
    </div>
  )
}
