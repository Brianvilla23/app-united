// La entrega de turno del área de planificación.
//
// Sale de la MINUTA de la semana, ordenada por estado: lo que se hizo, lo que
// quedó a medias y lo que sigue pendiente. Se puede sacar o agregar líneas a
// mano antes de guardarla, y al guardar queda una foto de esa semana.
//
// Las entregas guardadas se listan POR SEMANA y cada una se puede ver, bajar
// en Excel o en PDF.
import { useCallback, useEffect, useState } from 'react'
import { quienSoy } from './identidad'
import { uuid } from './util'
import { esSemanaDeHoy, martesDe, rotuloSemana, sumarDias } from './minuta'
import {
  BLOQUES, armarDesdeLaMinuta, borrarEntregaPlan, guardarEntregaPlan, porSemana,
  traerEntregasPlan, type EntregaPlan, type LineaEntregaPlan,
} from './entregaPlan'
import { excelEntregaPlan, pdfEntregaPlan } from './docEntregaPlan'

const hoy = () => new Date().toISOString().slice(0, 10)
type Bloques = Pick<EntregaPlan, 'realizadas' | 'seguimiento' | 'pendientes' | 'observaciones'>
const VACIO: Bloques = { realizadas: [], seguimiento: [], pendientes: [], observaciones: [] }

export default function EntregaPlanificacion() {
  const [inicio, setInicio] = useState(martesDe(hoy()))
  const [bloques, setBloques] = useState<Bloques>(VACIO)
  const [entrega, setEntrega] = useState({ nombre: quienSoy(), cargo: 'Planificador' })
  const [recibe, setRecibe] = useState({ nombre: '', cargo: 'Planificador' })
  const [guardadas, setGuardadas] = useState<EntregaPlan[]>([])
  const [abierta, setAbierta] = useState<string | null>(null)
  const [nueva, setNueva] = useState<Record<string, string>>({})
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  const armar = useCallback(async (semana: string) => {
    try { setBloques(await armarDesdeLaMinuta(semana)); setError('') } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer la minuta.')
    }
  }, [])

  const cargarGuardadas = useCallback(async () => {
    try { setGuardadas(await traerEntregasPlan()) } catch { /* se vive sin la lista */ }
  }, [])

  useEffect(() => { void armar(inicio) }, [inicio, armar])
  useEffect(() => { void cargarGuardadas() }, [cargarGuardadas])

  const quitarLinea = (clave: keyof Bloques, i: number) =>
    setBloques({ ...bloques, [clave]: bloques[clave].filter((_, k) => k !== i) })

  const agregarLinea = (clave: keyof Bloques) => {
    const t = (nueva[clave] ?? '').trim()
    if (!t) return
    setBloques({ ...bloques, [clave]: [...bloques[clave], { titulo: t, detalle: 'Agregada a mano' }] })
    setNueva({ ...nueva, [clave]: '' })
  }

  const guardar = async () => {
    setTrabajando(true); setError('')
    try {
      const e: EntregaPlan = {
        id: uuid(), inicio, fecha: hoy(),
        entrega: { ...entrega, nombre: entrega.nombre.trim() },
        recibe: { ...recibe, nombre: recibe.nombre.trim() },
        ...bloques,
      }
      await guardarEntregaPlan(e, quienSoy())
      setAviso('Entrega guardada. Queda abajo, en su semana.')
      setTimeout(() => setAviso(''), 6000)
      await cargarGuardadas()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setTrabajando(false)
    }
  }

  const bajar = async (e: EntregaPlan, como: 'excel' | 'pdf') => {
    setError('')
    try {
      if (como === 'excel') await excelEntregaPlan(e)
      else await pdfEntregaPlan(e)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo bajar.')
    }
  }

  const quitar = async (id: string) => {
    await borrarEntregaPlan(id)
    await cargarGuardadas()
  }

  const total = BLOQUES.reduce((n, b) => n + bloques[b.clave].length, 0)
  const listo = entrega.nombre.trim().length >= 3 && total > 0

  const lineas = (ls: LineaEntregaPlan[]) => (
    <ul className="plan-lista">
      {ls.map((l, i) => (
        <li key={l.titulo + i} className="plan-tarea">
          <span className="plan-cuerpo"><b>{l.titulo}</b>{l.detalle && <small>{l.detalle}</small>}</span>
        </li>
      ))}
    </ul>
  )

  return (
    <div>
      <div className="plano-titulo">
        <b>ENTREGA DE TURNO</b>
        <span>ÁREA DE PLANIFICACIÓN</span>
      </div>

      <div className="semana-barra">
        <button className="btn sm ghost" onClick={() => setInicio(sumarDias(inicio, -7))}>‹</button>
        <div className="semana-rotulo">
          <b>{rotuloSemana(inicio)}</b>
          {!esSemanaDeHoy(inicio) && (
            <button className="btn sm ghost" onClick={() => setInicio(martesDe(hoy()))}>Ir a la de hoy</button>
          )}
        </div>
        <button className="btn sm ghost" onClick={() => setInicio(sumarDias(inicio, 7))}>›</button>
      </div>

      <p className="hint" style={{ margin: '0 0 12px' }}>
        Sale de la <b>minuta de esta semana</b>: lo que quedó listo, lo que se está
        haciendo y lo que sigue pendiente. Saca o agrega lo que quieras antes de guardarla.
      </p>

      {error && <p className="memb-aviso">{error}</p>}
      {aviso && <p className="entrega-ok">{aviso}</p>}

      <div className="form">
        <div className="row" style={{ gap: 8 }}>
          <label className="lab" style={{ flex: 1 }}>
            Entrega el turno
            <input value={entrega.nombre} onChange={(e) => setEntrega({ ...entrega, nombre: e.target.value })} placeholder="Nombre y apellido" />
          </label>
          <label className="lab" style={{ flex: 1 }}>
            Cargo
            <input value={entrega.cargo} onChange={(e) => setEntrega({ ...entrega, cargo: e.target.value })} />
          </label>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <label className="lab" style={{ flex: 1 }}>
            Recibe el turno
            <input value={recibe.nombre} onChange={(e) => setRecibe({ ...recibe, nombre: e.target.value })} placeholder="Nombre y apellido" />
          </label>
          <label className="lab" style={{ flex: 1 }}>
            Cargo
            <input value={recibe.cargo} onChange={(e) => setRecibe({ ...recibe, cargo: e.target.value })} />
          </label>
        </div>
      </div>

      {BLOQUES.map((b) => (
        <div key={b.clave}>
          <h3 className="sec">{b.nombre} · {bloques[b.clave].length}</h3>
          <p className="hint" style={{ margin: '0 0 6px' }}>{b.bajada}</p>
          <ul className="plan-lista">
            {bloques[b.clave].map((l, i) => (
              <li key={l.titulo + i} className="plan-tarea">
                <span className="plan-cuerpo"><b>{l.titulo}</b>{l.detalle && <small>{l.detalle}</small>}</span>
                <button className="memb-x" onClick={() => quitarLinea(b.clave, i)} title="Sacar de la entrega">✕</button>
              </li>
            ))}
            <li className="plan-nueva">
              <input
                value={nueva[b.clave] ?? ''}
                placeholder="Agregar una línea a mano"
                onChange={(e) => setNueva({ ...nueva, [b.clave]: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') agregarLinea(b.clave) }}
              />
              <button className="btn sm" onClick={() => agregarLinea(b.clave)}>Agregar</button>
            </li>
          </ul>
        </div>
      ))}

      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn primary" disabled={!listo || trabajando} onClick={() => void guardar()}>
          {trabajando ? 'Guardando…' : 'Guardar la entrega de la semana'}
        </button>
        <button className="btn ghost" onClick={() => void armar(inicio)}>Rearmar desde la minuta</button>
      </div>
      {!listo && <p className="hint">Falta tu nombre y que haya algo en la minuta de esta semana.</p>}

      <h3 className="sec">Entregas guardadas</h3>
      {guardadas.length === 0
        ? <p className="hint">Todavía no hay ninguna guardada.</p>
        : porSemana(guardadas).map(({ inicio: semana, entregas }) => (
          <div key={semana} style={{ marginBottom: 12 }}>
            <p className="hint" style={{ margin: '0 0 6px' }}><b>{rotuloSemana(semana)}</b> · {entregas.length}</p>
            <div className="lista">
              {entregas.map((e) => (
                <div key={e.id} className="entrega-caja">
                  <div className="fila-entrega">
                    <div>
                      <b>{e.fecha}</b>
                      <small>
                        {e.entrega.nombre}
                        {' · '}{e.realizadas.length} realizadas · {e.seguimiento.length} en seguimiento
                        {' · '}{e.pendientes.length} pendientes
                      </small>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <button className="btn sm ghost" onClick={() => setAbierta(abierta === e.id ? null : e.id)}>
                        {abierta === e.id ? 'Cerrar' : 'Ver'}
                      </button>
                      <button className="btn sm" onClick={() => void bajar(e, 'excel')}>Excel</button>
                      <button className="btn sm ghost" onClick={() => void bajar(e, 'pdf')}>PDF</button>
                      <button className="memb-x" onClick={() => void quitar(e.id)}>✕</button>
                    </div>
                  </div>
                  {abierta === e.id && (
                    <div className="entrega-detalle">
                      <p>Recibe: <b>{e.recibe.nombre || '—'}</b></p>
                      {BLOQUES.map((b) => (
                        e[b.clave].length > 0 && (
                          <div key={b.clave}>
                            <h4 className="sec">{b.nombre}</h4>
                            {lineas(e[b.clave])}
                          </div>
                        )
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  )
}
