// La minuta de la semana: lo pendiente, lo que se está haciendo y lo cerrado.
//
// ⚠️ La semana va de MARTES a LUNES, como la trabaja Brayan, y se identifica
// por su martes de inicio ("Martes 22-09 → lunes 28-09 · W39").
import { useCallback, useEffect, useState } from 'react'
import { quienSoy } from './identidad'
import { uuid } from './util'
import {
  ESTADOS_MINUTA, arrastrarPendientes, borrarTarea, esSemanaDeHoy, guardarTarea,
  martesDe, resumir, rotuloSemana, sumarDias, traerMinuta,
  type EstadoMinuta, type TareaMinuta,
} from './minuta'
import {
  armarArbol, guardarObsPlan, nombreTurno, traerEntregasEntre, traerProyectos, traerTareas,
  type Entrega, type Proyecto, type Tarea, type Turno,
} from './planDatos'
import { CUADROS, borrarObs, guardarObs, traerObs, type CuadroObs, type ObsTurno } from './turnoObs'
import { generarPDFEntrega } from './pdfEntrega'
import { bajarExcelEntrega } from './xlsxEntrega'
import FichaTarea from './FichaTarea'
import { useModal } from './useModal'

const hoy = () => new Date().toISOString().slice(0, 10)

/** El toque cicla el estado: pendiente → en curso → lista → pendiente. */
function siguienteEstado(e: EstadoMinuta): EstadoMinuta {
  return e === 'pendiente' ? 'en_curso' : e === 'en_curso' ? 'lista' : 'pendiente'
}

export default function PanelMinuta() {
  const [inicio, setInicio] = useState(martesDe(hoy()))
  const [tareas, setTareas] = useState<TareaMinuta[]>([])
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [pendientesProyecto, setPendientesProyecto] = useState<{ proyecto: string; tarea: Tarea }[]>([])
  const [nueva, setNueva] = useState('')
  const [proyectoNueva, setProyectoNueva] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [abierta, abrirFicha, cerrarFicha] = useModal<string>()
  const [obs, setObs] = useState<ObsTurno[]>([])
  const [nuevaObs, setNuevaObs] = useState('')
  const [cuadroObs, setCuadroObs] = useState<CuadroObs>('adicional')
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [errorBajada, setErrorBajada] = useState('')

  const cargar = useCallback(async (semana: string) => {
    try { setTareas(await traerMinuta(semana)) } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar.')
    }
  }, [])

  /** Lo que planificación le manda al turno esa semana. */
  const cargarObs = useCallback(async (semana: string) => {
    try { setObs(await traerObs(semana)) } catch { /* la minuta sirve igual */ }
  }, [])

  /** Y las entregas que mandaron los supervisores en esa misma semana. */
  const cargarEntregas = useCallback(async (semana: string) => {
    try { setEntregas(await traerEntregasEntre(semana, sumarDias(semana, 6))) } catch { /* idem */ }
  }, [])

  useEffect(() => { void cargar(inicio) }, [inicio, cargar])
  useEffect(() => { void cargarObs(inicio); void cargarEntregas(inicio) }, [inicio, cargarObs, cargarEntregas])

  // lo que sigue abierto en los proyectos, para tenerlo a la vista en la minuta
  useEffect(() => {
    void (async () => {
      try {
        const ps = await traerProyectos()
        setProyectos(ps)
        const todas = await traerTareas()
        const abiertas: { proyecto: string; tarea: Tarea }[] = []
        for (const p of ps) {
          for (const a of armarArbol(todas.filter((t) => t.proyectoId === p.id))) {
            if (a.actividad.estado !== 'completada') abiertas.push({ proyecto: p.nombre, tarea: a.actividad })
          }
        }
        setPendientesProyecto(abiertas)
      } catch { /* la minuta sirve igual sin esto */ }
    })()
  }, [])

  const madres = tareas.filter((t) => !t.padreId)
  const subtareasDe = (id: string) => tareas.filter((t) => t.padreId === id)
  const resumen = resumir(madres)

  const yaEsta = (titulo: string) =>
    madres.some((m) => m.titulo.trim().toLowerCase() === titulo.trim().toLowerCase())

  const agregar = async (titulo: string, proyectoId: string | null) => {
    const t = titulo.trim()
    if (!t) return
    // sin esto, tocar dos veces "A la semana" deja la tarea repetida
    if (yaEsta(t)) { setNueva(''); return }
    await guardarTarea({
      id: uuid(), inicio, titulo: t, estado: 'pendiente',
      proyectoId, nota: '', orden: madres.length + 1, vieneDe: null,
      cierre: null, correo: '', padreId: null,
    }, quienSoy())
    setNueva('')
    await cargar(inicio)
  }

  const cambiar = async (t: TareaMinuta, cambio: Partial<TareaMinuta>) => {
    await guardarTarea({ ...t, ...cambio }, quienSoy())
    await cargar(inicio)
  }

  const quitar = async (id: string) => {
    await borrarTarea(id)
    await cargar(inicio)
  }

  const agregarObs = async (texto: string, cuadro: CuadroObs, tareaId: string | null) => {
    const t = texto.trim()
    if (!t) return
    await guardarObs({ id: uuid(), inicio, texto: t, cuadro, tareaId, creadoPor: quienSoy() })
    setNuevaObs('')
    await cargarObs(inicio)
  }

  const quitarObs = async (id: string) => {
    await borrarObs(id)
    await cargarObs(inicio)
  }

  const anotarEntrega = async (e: Entrega, texto: string) => {
    setErrorBajada('')
    try {
      await guardarObsPlan(e.id, texto, quienSoy())
      await cargarEntregas(inicio)
    } catch (err) {
      setErrorBajada(err instanceof Error ? err.message : 'No se pudo guardar la observación.')
    }
  }

  const bajarExcel = async (e: Entrega) => {
    setErrorBajada('')
    try { await bajarExcelEntrega(e) } catch (err) {
      setErrorBajada(err instanceof Error ? err.message : 'No se pudo armar el Excel.')
    }
  }

  const arrastrar = async () => {
    const n = await arrastrarPendientes(inicio, quienSoy(), uuid)
    setAviso(n === 0 ? 'No quedó nada abierto la semana pasada.' : `Se trajeron ${n} de la semana pasada.`)
    setTimeout(() => setAviso(''), 6000)
    await cargar(inicio)
  }

  return (
    <div>
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

      {error && <p className="memb-aviso">{error}</p>}
      {aviso && <p className="entrega-ok">{aviso}</p>}

      <div className="minuta-resumen">
        <span><b>{resumen.pendiente}</b> pendientes</span>
        <span><b>{resumen.en_curso}</b> en curso</span>
        <span className="ok"><b>{resumen.lista}</b> listas</span>
      </div>

      <ul className="plan-lista">
        {madres.map((t) => {
          const p = proyectos.find((x) => x.id === t.proyectoId)
          return (
            <li key={t.id} className={'plan-tarea min-' + t.estado}>
              <button
                className="plan-check" title={ESTADOS_MINUTA.find((e) => e.codigo === t.estado)?.nombre}
                onClick={() => void cambiar(t, { estado: siguienteEstado(t.estado) })}
              >
                {ESTADOS_MINUTA.find((e) => e.codigo === t.estado)?.corto}
              </button>
              <span className="plan-cuerpo" onClick={() => abrirFicha(t.id)}>
                <b>{t.titulo}</b>
                <small>
                  {p ? p.nombre : 'Sin proyecto'}
                  {t.cierre ? ` · cierra ${t.cierre}` : ''}
                  {subtareasDe(t.id).length > 0 ? ` · ${subtareasDe(t.id).length} subtareas` : ''}
                  {t.vieneDe ? ' · viene de la semana anterior' : ''}
                </small>
              </span>
              <button
                className="btn sm ghost al-turno"
                title="Mandarla al turno: le aparece al supervisor en su entrega"
                onClick={() => void agregarObs(t.titulo, 'adicional', t.id)}
              >
                Al turno
              </button>
              <button className="memb-x" onClick={() => void quitar(t.id)} title="Borrar">✕</button>
            </li>
          )
        })}

        <li className="plan-nueva">
          <input
            value={nueva}
            placeholder="Tarea de la semana"
            onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void agregar(nueva, proyectoNueva || null) }}
          />
          <select value={proyectoNueva} onChange={(e) => setProyectoNueva(e.target.value)}>
            <option value="">Sin proyecto</option>
            {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <button className="btn sm" onClick={() => void agregar(nueva, proyectoNueva || null)}>Agregar</button>
        </li>
      </ul>

      <div className="row" style={{ gap: 8, marginTop: 12 }}>
        <button className="btn sm ghost" onClick={() => void arrastrar()}>
          Traer lo que quedó abierto la semana pasada
        </button>
      </div>

      {abierta && tareas.some((t) => t.id === abierta) && (
        <FichaTarea
          tarea={tareas.find((t) => t.id === abierta)!}
          subtareas={subtareasDe(abierta)}
          proyectos={proyectos}
          onCambio={() => cargar(inicio)}
          onCerrar={cerrarFicha}
        />
      )}

      <h3 className="sec">Para la entrega de turno</h3>
      <p className="hint" style={{ margin: '0 0 8px' }}>
        Lo que escribas acá <b>lo ve el supervisor</b> cuando llena su entrega de esta
        semana, ya cargado en el cuadro que elijas del formato oficial. Él lo puede
        corregir o sacar. La minuta no se ve: solo esto.
      </p>
      <ul className="plan-lista">
        {obs.map((o) => (
          <li key={o.id} className="plan-tarea">
            <span className={'obs-cuadro ' + o.cuadro}>
              {CUADROS.find((c) => c.codigo === o.cuadro)?.nombre}
            </span>
            <span className="plan-cuerpo">
              <b>{o.texto}</b>
              <small>
                Va en {CUADROS.find((c) => c.codigo === o.cuadro)?.donde}
                {o.creadoPor ? ` · ${o.creadoPor}` : ''}
              </small>
            </span>
            <button className="memb-x" onClick={() => void quitarObs(o.id)} title="Sacar">✕</button>
          </li>
        ))}
        <li className="plan-nueva">
          <input
            value={nuevaObs}
            placeholder="Observación para el turno"
            onChange={(e) => setNuevaObs(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void agregarObs(nuevaObs, cuadroObs, null) }}
          />
          <select value={cuadroObs} onChange={(e) => setCuadroObs(e.target.value as CuadroObs)}>
            {CUADROS.map((c) => <option key={c.codigo} value={c.codigo}>{c.donde}</option>)}
          </select>
          <button className="btn sm" onClick={() => void agregarObs(nuevaObs, cuadroObs, null)}>Agregar</button>
        </li>
      </ul>

      <h3 className="sec">Entregas de turno de esta semana</h3>
      {errorBajada && <p className="memb-aviso">{errorBajada}</p>}
      {entregas.length === 0
        ? <p className="hint">Todavía no llega ninguna de esta semana.</p>
        : (
          <div className="lista">
            {entregas.map((e) => (
              <div key={e.id} className="entrega-caja">
                <div className="fila-entrega">
                  <div>
                    <b>{e.fecha} · {nombreTurno(e.turno as Turno)}</b>
                    <small>{e.entrega.nombre} · {e.ots.length} OT · {e.adicionales.length} adicionales</small>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn sm" onClick={() => void bajarExcel(e)}>Excel</button>
                    <button className="btn sm ghost" onClick={() => generarPDFEntrega(e)}>PDF</button>
                  </div>
                </div>
                <label className="lab" style={{ marginTop: 6 }}>
                  Observación de planificación
                  <textarea
                    rows={2} defaultValue={e.obsPlan ?? ''}
                    placeholder="Qué hay que seguir de esta entrega"
                    onBlur={(ev) => { if (ev.target.value !== (e.obsPlan ?? '')) void anotarEntrega(e, ev.target.value) }}
                  />
                </label>
                {e.obsPlanPor && <small className="hint">Anotada por {e.obsPlanPor}. Sale en el PDF, no en el Excel firmado.</small>}
              </div>
            ))}
          </div>
        )}

      {pendientesProyecto.length > 0 && (
        <>
          <h3 className="sec">Pendiente en los proyectos</h3>
          <div className="lista">
            {pendientesProyecto.map(({ proyecto, tarea }) => (
              <div key={tarea.id} className="fila-entrega">
                <div>
                  <b>{tarea.titulo}</b>
                  <small>{proyecto}{tarea.hasta ? ` · hasta ${tarea.hasta}` : ''}</small>
                </div>
                <button
                  className="btn sm ghost"
                  disabled={yaEsta(tarea.titulo)}
                  onClick={() => void agregar(tarea.titulo, tarea.proyectoId)}
                >
                  {yaEsta(tarea.titulo) ? 'Ya está' : 'A la semana'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
