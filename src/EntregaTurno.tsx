// La entrega de turno, como la llena el supervisor: sin cuenta, con su nombre,
// y aunque esté sin señal (se va por la cola de subida como todo lo demás).
//
// Quien la lee es planificación: en la base, `entregas_turno` deja insertar a
// cualquiera pero leer solo a los dos editores. Por eso queda también una copia
// local — para que el supervisor pueda releer y reimprimir lo que entregó desde
// ESTE celular.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { encolar } from './sync'
import { quienSoy } from './identidad'
import { uuid } from './util'
import { fechaCorta } from './fecha'
import { TURNOS, filaEntrega, nombreTurno, type Entrega, type Turno } from './planDatos'
import { generarPDFEntrega } from './pdfEntrega'
import type { EntregaLocal } from './types'

const hoy = () => new Date().toISOString().slice(0, 10)

/** El turno que se está entregando: antes de las 19:00 es el de día. */
function turnoProbable(): Turno {
  const h = new Date().getHours()
  return h >= 7 && h < 19 ? 'dia' : 'noche'
}

export default function EntregaTurno() {
  const [fecha, setFecha] = useState(hoy())
  const [turno, setTurno] = useState<Turno>(turnoProbable())
  const [supervisor, setSupervisor] = useState(quienSoy())
  const [area, setArea] = useState('')
  const [dotacion, setDotacion] = useState('')
  const [hecho, setHecho] = useState('')
  const [pendiente, setPendiente] = useState('')
  const [novedades, setNovedades] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState('')

  const mias = useLiveQuery(
    () => db.entregas.orderBy('createdAt').reverse().limit(20).toArray(), [],
  ) ?? []

  const listo = supervisor.trim().length >= 3 && (hecho.trim() || pendiente.trim())

  const entregaDe = (e: EntregaLocal): Entrega => ({
    id: e.id, fecha: e.fecha, turno: e.turno as Turno, supervisor: e.supervisor,
    ...(e.datos as Omit<Entrega, 'id' | 'fecha' | 'turno' | 'supervisor'>),
  })

  const enviar = async () => {
    if (!listo || enviando) return
    setEnviando(true)
    try {
      const entrega: Entrega = {
        id: uuid(), fecha, turno, supervisor: supervisor.trim(), area: area.trim(),
        dotacion: dotacion ? Number(dotacion) : null,
        hecho: hecho.trim(), pendiente: pendiente.trim(), novedades: novedades.trim(),
        actividades: [],
      }
      await db.entregas.put({
        id: entrega.id, fecha: entrega.fecha, turno: entrega.turno,
        supervisor: entrega.supervisor,
        datos: {
          area: entrega.area, dotacion: entrega.dotacion, hecho: entrega.hecho,
          pendiente: entrega.pendiente, novedades: entrega.novedades, actividades: [],
        },
        createdAt: Date.now(), sincronizado: false,
      })
      await encolar('entrega_turno', filaEntrega(entrega))
      setHecho(''); setPendiente(''); setNovedades('')
      setAviso('Entrega enviada. Queda en planificación y puedes descargarla acá abajo.')
      setTimeout(() => setAviso(''), 6000)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div>
      <div className="plano-titulo">
        <b>ENTREGA DE TURNO</b>
        <span>{fechaCorta().toUpperCase()}</span>
      </div>

      <p className="hint" style={{ margin: '0 0 12px' }}>
        Lo que escribas acá lo recibe planificación. Queda una copia en este celular
        para releerla o mandarla en PDF.
      </p>

      <div className="form">
        <label className="lab">Fecha del turno</label>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />

        <label className="lab">Turno</label>
        <div className="seg">
          {TURNOS.map((t) => (
            <button key={t.codigo} className={turno === t.codigo ? 'on' : ''} onClick={() => setTurno(t.codigo)}>
              {t.nombre}
            </button>
          ))}
        </div>

        <label className="lab">Supervisor que entrega</label>
        <input value={supervisor} onChange={(e) => setSupervisor(e.target.value)} placeholder="Nombre y apellido" />

        <label className="lab">Área o frente de trabajo</label>
        <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Ej: Rack 3 · lado descarga" />

        <label className="lab">Dotación del turno</label>
        <input
          type="number" inputMode="numeric" min={0}
          value={dotacion} onChange={(e) => setDotacion(e.target.value)} placeholder="Personas"
        />

        <label className="lab">Lo que se hizo</label>
        <textarea rows={4} value={hecho} onChange={(e) => setHecho(e.target.value)}
          placeholder="Una línea por actividad terminada." />

        <label className="lab">Queda pendiente</label>
        <textarea rows={4} value={pendiente} onChange={(e) => setPendiente(e.target.value)}
          placeholder="Lo que toma el turno que entra." />

        <label className="lab">Novedades y seguridad</label>
        <textarea rows={3} value={novedades} onChange={(e) => setNovedades(e.target.value)}
          placeholder="Detenciones, incidentes, permisos, materiales que faltaron." />

        {aviso && <p className="entrega-ok">{aviso}</p>}

        <button className="btn primary" disabled={!listo || enviando} onClick={() => void enviar()}>
          {enviando ? 'Enviando…' : 'Enviar entrega de turno'}
        </button>
        {!listo && (
          <p className="hint">Falta tu nombre y al menos qué se hizo o qué queda pendiente.</p>
        )}
      </div>

      {mias.length > 0 && (
        <>
          <h3 className="sec">Entregas enviadas desde este celular</h3>
          <div className="lista">
            {mias.map((e) => (
              <div key={e.id} className="fila-entrega">
                <div>
                  <b>{e.fecha} · {nombreTurno(e.turno as Turno)}</b>
                  <small>{e.supervisor}{e.sincronizado ? '' : ' · por subir'}</small>
                </div>
                <button className="btn sm ghost" onClick={() => generarPDFEntrega(entregaDe(e))}>PDF</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
