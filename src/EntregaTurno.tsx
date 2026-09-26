// La entrega de turno con el formato oficial de United: PYC-EG-MEL-6001-01.
//
// Las cuatro tablas son las del formato — órdenes de trabajo ejecutadas,
// actividades adicionales, amenazas y estado de los equipos —, así que lo que
// se baja es la MISMA planilla que se manda hoy, rellenada.
//
// La llena el supervisor sin cuenta, con su nombre, y aunque esté sin señal:
// se va por la cola de subida. En la base cualquiera puede insertar y solo los
// editores de planificación pueden leer, por eso queda además una copia local
// para releer y reimprimir lo que entregó desde ESTE celular.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { encolar } from './sync'
import { quienSoy } from './identidad'
import { uuid } from './util'
import {
  AREAS_ENTREGA, PERSONA_VACIA, TURNOS, filaEntrega, nombreTurno, semanaDe,
  type AreaEntrega, type Entrega, type LineaAdicional, type LineaAmenaza, type LineaEquipo,
  type LineaOT, type Persona, type Turno,
} from './planDatos'
import { EQUIPOS, ESTADOS_EQUIPO, ESTADOS_OT } from './equiposFormato'
import { traerObsDeFecha } from './turnoObs'
import { generarPDFEntrega } from './pdfEntrega'
import { bajarExcelEntrega } from './xlsxEntrega'
import type { EntregaLocal } from './types'

const hoy = () => new Date().toISOString().slice(0, 10)

/** El turno que se está entregando: entre las 7 y las 19 es el de día. */
function turnoProbable(): Turno {
  const h = new Date().getHours()
  return h >= 7 && h < 19 ? 'dia' : 'noche'
}

/** La misma pantalla sirve para las dos áreas, que son entregas distintas:
    la de SUPERVISIÓN la llena el supervisor en terreno y sin cuenta; la de
    PLANIFICACIÓN la hacen Brayan y Juan desde su pantalla. No se mezclan. */
export default function EntregaTurno({ area = 'supervision' }: { area?: AreaEntrega }) {
  const [fecha, setFecha] = useState(hoy())
  const [semana, setSemana] = useState(semanaDe(hoy()))
  const [turno, setTurno] = useState<Turno>(turnoProbable())
  const [entrega, setEntrega] = useState<Persona>({ ...PERSONA_VACIA, nombre: quienSoy() })
  const [recibe, setRecibe] = useState<Persona>({ ...PERSONA_VACIA })
  const [ots, setOts] = useState<LineaOT[]>([{ ot: '', observaciones: '', estado: 'Realizado' }])
  const [adicionales, setAdicionales] = useState<LineaAdicional[]>([])
  const [amenazas, setAmenazas] = useState<LineaAmenaza[]>([])
  const [equipos, setEquipos] = useState<LineaEquipo[]>([])
  const [verEquipos, setVerEquipos] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [errorBajada, setErrorBajada] = useState('')
  /** Las observaciones de planificación que ya se cargaron en el formulario.
      Si el supervisor saca una, no vuelve a aparecer sola. */
  const [obsPuestas, setObsPuestas] = useState<string[]>([])
  const [obsAviso, setObsAviso] = useState(0)

  /** Bajar la planilla puede fallar (sin señal la primera vez, por ejemplo) y
      antes se caía en silencio: el supervisor apretaba y no pasaba nada. */
  const bajar = async (e: Entrega) => {
    setErrorBajada('')
    try { await bajarExcelEntrega(e) } catch (err) {
      setErrorBajada(
        (err instanceof Error ? err.message : 'No se pudo armar el Excel.')
        + ' Conéctate una vez para que el formato quede guardado en el celular.',
      )
    }
  }

  const todasMias = useLiveQuery(
    () => db.entregas.orderBy('createdAt').reverse().limit(40).toArray(), [],
  ) ?? []
  // las de antes de separar las áreas eran todas de supervisión
  const mias = todasMias.filter((e) => {
    const d = e.datos as { area?: AreaEntrega } | undefined
    return (d?.area ?? 'supervision') === area
  })

  const conTexto = ots.filter((o) => o.ot.trim() || o.observaciones.trim())
  const listo = entrega.nombre.trim().length >= 3
    && (conTexto.length > 0 || adicionales.some((a) => a.descripcion.trim()))

  const equipoDe = (interno: string): LineaEquipo =>
    equipos.find((e) => e.interno === interno) ?? { interno, estado: '', observaciones: '', horometro: '' }

  const cambiarEquipo = (interno: string, cambio: Partial<LineaEquipo>) => {
    setEquipos((prev) => {
      const otros = prev.filter((e) => e.interno !== interno)
      return [...otros, { ...equipoDe(interno), ...cambio }]
    })
  }

  const todosOperativos = () =>
    setEquipos(EQUIPOS.map((e) => ({ ...equipoDe(e.interno), estado: 'Operativo' })))

  const armar = (): Entrega => ({
    id: uuid(), area, fecha, semana: semana.trim(), turno,
    entrega: { ...entrega, nombre: entrega.nombre.trim() },
    recibe: { ...recibe, nombre: recibe.nombre.trim() },
    ots: conTexto,
    adicionales: adicionales.filter((a) => a.descripcion.trim()),
    amenazas: amenazas.filter((a) => a.descripcion.trim()),
    equipos: equipos.filter((e) => e.estado || e.observaciones || e.horometro),
  })

  const entregaDe = (e: EntregaLocal): Entrega =>
    ({ id: e.id, ...(e.datos as Omit<Entrega, 'id'>) })

  const enviar = async () => {
    if (!listo || enviando) return
    setEnviando(true)
    try {
      const e = armar()
      const { id, ...resto } = e
      await db.entregas.put({
        id, fecha: e.fecha, turno: e.turno, supervisor: e.entrega.nombre,
        datos: resto as unknown as Record<string, unknown>,
        createdAt: Date.now(), sincronizado: false,
      })
      await encolar('entrega_turno', filaEntrega(e))
      setOts([{ ot: '', observaciones: '', estado: 'Realizado' }])
      setAdicionales([]); setAmenazas([])
      setAviso('Entrega enviada. Queda en planificación y la puedes bajar acá abajo.')
      setTimeout(() => setAviso(''), 7000)
    } finally {
      setEnviando(false)
    }
  }

  // Lo que planificación dejó en la minuta para este turno: llega ya cargado en
  // el cuadro que ellos eligieron del formato. El supervisor lo corrige o lo saca.
  useEffect(() => {
    void (async () => {
      if (area !== 'planificacion') return
      try {
        const suyas = await traerObsDeFecha(fecha)
        const nuevas = suyas.filter((o) => !obsPuestas.includes(o.id))
        if (nuevas.length === 0) return
        const adi = nuevas.filter((o) => o.cuadro === 'adicional')
        const ame = nuevas.filter((o) => o.cuadro === 'amenaza')
        if (adi.length > 0) {
          setAdicionales((x) => [...x, ...adi.map((o) => ({ descripcion: o.texto, estado: 'Realizado', dePlan: true }))])
        }
        if (ame.length > 0) {
          setAmenazas((x) => [...x, ...ame.map((o) => ({ descripcion: o.texto, dePlan: true }))])
        }
        setObsPuestas((x) => [...x, ...nuevas.map((o) => o.id)])
        setObsAviso(nuevas.length)
      } catch { /* sin señal se llena igual, a mano */ }
    })()
    // obsPuestas a propósito fuera: si entra, se relanza en cada carga
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, area])

  const persona = (p: Persona, set: (p: Persona) => void, quien: string) => (
    <>
      <label className="lab">Nombre y apellidos de quien {quien} turno</label>
      <input value={p.nombre} onChange={(e) => set({ ...p, nombre: e.target.value })} placeholder="Nombre y apellido" />
      <div className="row" style={{ gap: 8 }}>
        <label className="lab" style={{ flex: 1 }}>
          Cargo
          <input value={p.cargo} onChange={(e) => set({ ...p, cargo: e.target.value })} placeholder="Supervisor de obra" />
        </label>
        <label className="lab" style={{ flex: 1 }}>
          RUN
          <input value={p.run} onChange={(e) => set({ ...p, run: e.target.value })} placeholder="12.345.678-9" />
        </label>
      </div>
    </>
  )

  return (
    <div>
      <div className="plano-titulo">
        <b>ENTREGA DE TURNO</b>
        <span>{AREAS_ENTREGA.find((x) => x.codigo === area)?.nombre} · PYC-EG-MEL-6001-01</span>
      </div>

      <p className="hint" style={{ margin: '0 0 12px' }}>
        {area === 'planificacion'
          ? 'Esta es la entrega de turno del área de planificación, aparte de la que manda supervisión. Al enviarla queda acá abajo y la bajas en Excel (el formato oficial) o en PDF.'
          : 'Es el mismo formato que se manda hoy. Al enviarla la recibe planificación, y acá abajo la bajas en Excel (el formato oficial) o en PDF.'}
      </p>

      {obsAviso > 0 && (
        <p className="entrega-ok">
          Planificación dejó {obsAviso} {obsAviso === 1 ? 'observación' : 'observaciones'} para
          este turno. Están abajo, en su cuadro: revísalas, corrígelas o sácalas.
        </p>
      )}

      <div className="form">
        <h3 className="sec">Antecedentes de la entrega</h3>
        <div className="row" style={{ gap: 8 }}>
          <label className="lab" style={{ flex: 1 }}>
            Fecha
            <input type="date" value={fecha} onChange={(e) => { setFecha(e.target.value); setSemana(semanaDe(e.target.value)) }} />
          </label>
          <label className="lab" style={{ flex: 1 }}>
            Semana
            <input value={semana} onChange={(e) => setSemana(e.target.value)} placeholder="W35" />
          </label>
        </div>

        <label className="lab">Turno</label>
        <div className="seg">
          {TURNOS.map((t) => (
            <button key={t.codigo} className={turno === t.codigo ? 'on' : ''} onClick={() => setTurno(t.codigo)}>
              {t.nombre}
            </button>
          ))}
        </div>

        {persona(entrega, setEntrega, 'entrega')}
        {persona(recibe, setRecibe, 'recibe')}

        <h3 className="sec">3.1 Órdenes de trabajo ejecutadas</h3>
        {ots.map((o, i) => (
          <div key={i} className="bloque-ot">
            <div className="row" style={{ gap: 8 }}>
              <input
                style={{ flex: 1 }} inputMode="numeric" value={o.ot} placeholder="Nº de OT"
                onChange={(e) => setOts(ots.map((x, k) => (k === i ? { ...x, ot: e.target.value } : x)))}
              />
              <select
                value={o.estado}
                onChange={(e) => setOts(ots.map((x, k) => (k === i ? { ...x, estado: e.target.value } : x)))}
              >
                {ESTADOS_OT.map((s) => <option key={s}>{s}</option>)}
              </select>
              <button className="memb-x" onClick={() => setOts(ots.filter((_, k) => k !== i))}>✕</button>
            </div>
            <textarea
              rows={3} value={o.observaciones} placeholder="Observaciones: qué se hizo, en qué vasijas, qué quedó"
              onChange={(e) => setOts(ots.map((x, k) => (k === i ? { ...x, observaciones: e.target.value } : x)))}
            />
          </div>
        ))}
        <button className="btn add" onClick={() => setOts([...ots, { ot: '', observaciones: '', estado: 'Realizado' }])}>
          + Otra orden de trabajo
        </button>

        <h3 className="sec">3.2 Actividades adicionales / OT subsecuentes</h3>
        {adicionales.map((a, i) => (
          <div key={i} className={'row' + (a.dePlan ? ' de-plan' : '')} style={{ gap: 8, marginBottom: 8 }}>
            {a.dePlan && <span className="obs-cuadro" title="La dejó planificación en la minuta">Plan</span>}
            <input
              style={{ flex: 1 }} value={a.descripcion} placeholder="OT y descripción"
              onChange={(e) => setAdicionales(adicionales.map((x, k) => (k === i ? { ...x, descripcion: e.target.value } : x)))}
            />
            <select
              value={a.estado}
              onChange={(e) => setAdicionales(adicionales.map((x, k) => (k === i ? { ...x, estado: e.target.value } : x)))}
            >
              {ESTADOS_OT.map((s) => <option key={s}>{s}</option>)}
            </select>
            <button className="memb-x" onClick={() => setAdicionales(adicionales.filter((_, k) => k !== i))}>✕</button>
          </div>
        ))}
        <button className="btn add" onClick={() => setAdicionales([...adicionales, { descripcion: '', estado: 'Realizado' }])}>
          + Actividad adicional
        </button>

        <h3 className="sec">3.3 Amenazas</h3>
        {amenazas.map((a, i) => (
          <div key={i} className={'row' + (a.dePlan ? ' de-plan' : '')} style={{ gap: 8, marginBottom: 8 }}>
            {a.dePlan && <span className="obs-cuadro amenaza" title="La dejó planificación en la minuta">Plan</span>}
            <input
              style={{ flex: 1 }} value={a.descripcion} placeholder="Lo que puede frenar el trabajo"
              onChange={(e) => setAmenazas(amenazas.map((x, k) => (k === i ? { ...x, descripcion: e.target.value } : x)))}
            />
            <button className="memb-x" onClick={() => setAmenazas(amenazas.filter((_, k) => k !== i))}>✕</button>
          </div>
        ))}
        <button className="btn add" onClick={() => setAmenazas([...amenazas, { descripcion: '' }])}>
          + Amenaza
        </button>

        <h3 className="sec">3.4 Equipos</h3>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn sm ghost" onClick={() => setVerEquipos(!verEquipos)}>
            {verEquipos ? 'Ocultar' : `Ver los ${EQUIPOS.length} equipos`}
          </button>
          <button className="btn sm ghost" onClick={todosOperativos}>Marcar todos operativos</button>
        </div>
        {verEquipos && (
          <div className="equipos">
            {EQUIPOS.map((eq) => {
              const l = equipoDe(eq.interno)
              return (
                <div key={eq.interno} className="equipo">
                  <div className="equipo-tit">
                    <b>{eq.nombre}</b>
                    <small>{eq.interno} · {eq.ubicacion}</small>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <select value={l.estado} onChange={(e) => cambiarEquipo(eq.interno, { estado: e.target.value })}>
                      <option value="">Sin informar</option>
                      {ESTADOS_EQUIPO.map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <input
                      style={{ width: 96 }} inputMode="numeric" value={l.horometro} placeholder="Horóm."
                      onChange={(e) => cambiarEquipo(eq.interno, { horometro: e.target.value })}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {aviso && <p className="entrega-ok">{aviso}</p>}

        <button className="btn primary" disabled={!listo || enviando} onClick={() => void enviar()}>
          {enviando ? 'Enviando…' : 'Enviar entrega de turno'}
        </button>
        {!listo && (
          <p className="hint">Falta tu nombre y al menos una orden de trabajo o actividad.</p>
        )}
      </div>

      {mias.length > 0 && (
        <>
          <h3 className="sec">Entregas enviadas desde este celular</h3>
          <p className="hint" style={{ margin: '0 0 8px' }}>
            El <b>Excel</b> es el formato oficial, el que está validado por calidad:
            ese es el que se manda por correo. El PDF es solo para leerlo.
          </p>
          {errorBajada && <p className="memb-aviso">{errorBajada}</p>}
          <div className="lista">
            {mias.map((e) => (
              <div key={e.id} className="fila-entrega">
                <div>
                  <b>{e.fecha} · {nombreTurno(e.turno as Turno)}</b>
                  <small>{e.supervisor}{e.sincronizado ? '' : ' · por subir'}</small>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn sm" onClick={() => void bajar(entregaDe(e))}>Excel</button>
                  <button className="btn sm ghost" onClick={() => generarPDFEntrega(entregaDe(e))}>PDF</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
