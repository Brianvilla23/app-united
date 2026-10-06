// La minuta de la semana: lo pendiente, lo que se está haciendo y lo cerrado.
//
// ⚠️ La semana va de MARTES a LUNES, como la trabaja Brayan, y se identifica
// por su martes de inicio ("Martes 22-09 → lunes 28-09 · W39").
import { useCallback, useEffect, useState } from 'react'
import { quienSoy } from './identidad'
import { uuid, hoyISO } from './util'
import {
  ESTADOS_MINUTA, arrastrarPendientes, borrarTarea, cerrarSemana, esSemanaDeHoy, guardarTarea,
  martesDe, resumir, rotuloSemana, sumarDias, traerMinuta,
  type EstadoMinuta, type TareaMinuta,
} from './minuta'
import { armarArbol, traerProyectos, traerTareas, type Proyecto, type Tarea } from './planDatos'
import {
  armarDesdeLaMinuta, guardarEntregaPlan, traerEntregasPlan, type EntregaPlan,
} from './entregaPlan'
import { excelEntregaPlan, pdfEntregaPlan } from './docEntregaPlan'
import {
  ESTADOS_AMENAZA, guardarAmenaza, resumirAmenazas, siguienteEstadoAmenaza, traerAmenazas,
  type Amenaza,
} from './amenazas'
import FichaTarea from './FichaTarea'
import { useModal } from './useModal'

const hoy = () => hoyISO()

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
  const [nuevaObs, setNuevaObs] = useState('')
  const [entregas, setEntregas] = useState<EntregaPlan[]>([])
  /** El cierre de semana pide quién recibe antes de hacer nada. */
  const [cerrando, setCerrando] = useState<{ recibe: string } | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [errorBajada, setErrorBajada] = useState('')
  const [amenazas, setAmenazas] = useState<Amenaza[]>([])

  const cargar = useCallback(async (semana: string) => {
    try { setTareas(await traerMinuta(semana)) } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar.')
    }
  }, [])

  /** Las entregas de turno de PLANIFICACIÓN de esa semana: las nuestras. Las
      de supervisión son otra área y se leen en su propia pantalla. */
  const cargarEntregas = useCallback(async (semana: string) => {
    try {
      setEntregas((await traerEntregasPlan()).filter((e) => e.inicio === semana))
    } catch { /* la minuta sirve igual */ }
  }, [])

  /** Las amenazas que reportó supervisión esa semana, para monitorearlas. */
  const cargarAmenazas = useCallback(async (semana: string) => {
    try { setAmenazas(await traerAmenazas(semana)) } catch { /* la minuta sirve igual */ }
  }, [])

  useEffect(() => { void cargar(inicio) }, [inicio, cargar])
  useEffect(() => { void cargarAmenazas(inicio) }, [inicio, cargarAmenazas])
  useEffect(() => { void cargarEntregas(inicio) }, [inicio, cargarEntregas])

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

  const madres = tareas.filter((t) => !t.padreId && t.tipo !== 'observacion')
  /** Lo que se deja escrito para nuestra entrega de turno: son tareas más, con
      la misma ficha (información, archivos, subtareas). */
  const observaciones = tareas.filter((t) => !t.padreId && t.tipo === 'observacion')
  const subtareasDe = (id: string) => tareas.filter((t) => t.padreId === id)
  const resumen = resumir(madres)
  const obsAbiertas = observaciones.filter((o) => o.estado !== 'lista').length

  const yaEsta = (titulo: string) =>
    madres.some((m) => m.titulo.trim().toLowerCase() === titulo.trim().toLowerCase())

  const agregar = async (titulo: string, proyectoId: string | null, tipo: 'tarea' | 'observacion' = 'tarea') => {
    const t = titulo.trim()
    if (!t) return
    // sin esto, tocar dos veces "A la semana" deja la tarea repetida
    if (tipo === 'tarea' && yaEsta(t)) { setNueva(''); return }
    const hermanas = tipo === 'tarea' ? madres : observaciones
    await guardarTarea({
      id: uuid(), inicio, titulo: t, estado: 'pendiente',
      proyectoId, nota: '', orden: hermanas.length + 1, vieneDe: null,
      cierre: null, correo: '', padreId: null, tipo,
    }, quienSoy())
    if (tipo === 'tarea') setNueva(''); else setNuevaObs('')
    await cargar(inicio)
  }

  /** Cerrar la semana: se guarda la entrega de turno de planificación con lo
      que hay (realizadas, en seguimiento, pendientes, observaciones) y todo lo
      que no quedó listo pasa a la semana siguiente, para el contraturno. */
  const cerrar = async (recibe: string) => {
    setTrabajando(true); setError('')
    try {
      const bloques = await armarDesdeLaMinuta(inicio)
      await guardarEntregaPlan({
        id: uuid(), inicio, fecha: hoy(),
        entrega: { nombre: quienSoy(), cargo: 'Planificador' },
        recibe: { nombre: recibe.trim(), cargo: 'Planificador' },
        ...bloques,
      }, quienSoy())
      const n = await cerrarSemana(inicio, quienSoy())
      setCerrando(null)
      setAviso(`Semana cerrada: la entrega de turno quedó guardada y ${n} ${n === 1 ? 'actividad pasó' : 'actividades pasaron'} a la semana siguiente.`)
      setTimeout(() => setAviso(''), 9000)
      setInicio(sumarDias(inicio, 7))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cerrar la semana.')
    } finally {
      setTrabajando(false)
    }
  }

  const cambiar = async (t: TareaMinuta, cambio: Partial<TareaMinuta>) => {
    await guardarTarea({ ...t, ...cambio }, quienSoy())
    await cargar(inicio)
  }

  const quitar = async (id: string) => {
    await borrarTarea(id)
    await cargar(inicio)
  }

  const bajarEntrega = async (e: EntregaPlan, como: 'excel' | 'pdf') => {
    setErrorBajada('')
    try {
      if (como === 'excel') await excelEntregaPlan(e)
      else await pdfEntregaPlan(e)
    } catch (err) {
      setErrorBajada(err instanceof Error ? err.message : 'No se pudo bajar.')
    }
  }

  const cambiarAmenaza = async (
    a: Amenaza,
    cambio: Partial<Pick<Amenaza, 'estado' | 'solucion' | 'responsable'>>,
  ) => {
    setErrorBajada('')
    try {
      await guardarAmenaza(a, cambio, quienSoy())
      await cargarAmenazas(inicio)
    } catch (e) {
      setErrorBajada(e instanceof Error ? e.message : 'No se pudo guardar la amenaza.')
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

      <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button className="btn sm" onClick={() => setCerrando({ recibe: '' })}>
          Cerrar la semana y entregar el turno
        </button>
        <button className="btn sm ghost" onClick={() => void arrastrar()}>
          Traer lo que quedó abierto la semana pasada
        </button>
      </div>

      {cerrando && (
        <div className="modal-overlay" onClick={() => { if (!trabajando) setCerrando(null) }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <b>Cerrar la semana</b>
              <button className="modal-x" onClick={() => setCerrando(null)}>✕</button>
            </div>
            <p className="hint" style={{ margin: '0 0 10px' }}>
              Se guarda la entrega de turno de planificación de esta semana con lo que
              hay en la minuta: <b>{resumen.lista}</b> realizadas, <b>{resumen.en_curso}</b> en
              seguimiento, <b>{resumen.pendiente}</b> pendientes y <b>{observaciones.length}</b> observaciones.
              Después, las <b>{resumen.pendiente + resumen.en_curso + obsAbiertas}</b> que no
              quedaron listas <b>pasan a la semana siguiente</b> con sus subtareas y
              archivos, para tu contraturno.
            </p>
            <label className="lab">Quién recibe el turno</label>
            <input
              autoFocus value={cerrando.recibe} placeholder="Nombre y apellido"
              onChange={(e) => setCerrando({ recibe: e.target.value })}
            />
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <button className="btn primary" disabled={trabajando} onClick={() => void cerrar(cerrando.recibe)}>
                {trabajando ? 'Cerrando…' : 'Cerrar y pasar al contraturno'}
              </button>
              <button className="btn ghost" disabled={trabajando} onClick={() => setCerrando(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {abierta && tareas.some((t) => t.id === abierta) && (
        <FichaTarea
          tarea={tareas.find((t) => t.id === abierta)!}
          subtareas={subtareasDe(abierta)}
          proyectos={proyectos}
          onCambio={() => cargar(inicio)}
          onCerrar={cerrarFicha}
        />
      )}

      <h3 className="sec">Amenazas de supervisión · para monitorear</h3>
      <p className="hint" style={{ margin: '0 0 8px' }}>
        Lo que los supervisores pusieron en el cuadro <b>3.3 Amenazas</b> de su entrega
        de esta semana. Acá se monitorean y se anota <b>cómo se solucionan</b>. Tocando
        el estado va: por monitorear → en curso → resuelta.
      </p>
      {amenazas.length === 0
        ? <p className="hint">Esta semana no llegó ninguna amenaza de supervisión.</p>
        : (
          <>
            <div className="minuta-resumen">
              <span><b>{resumirAmenazas(amenazas).monitorear}</b> por monitorear</span>
              <span><b>{resumirAmenazas(amenazas).en_curso}</b> en curso</span>
              <span className="ok"><b>{resumirAmenazas(amenazas).resuelta}</b> resueltas</span>
            </div>
            <div className="lista">
              {amenazas.map((a) => (
                <div key={a.id} className={'entrega-caja amenaza-' + a.estado}>
                  <div className="fila-entrega">
                    <div>
                      <b>{a.descripcion}</b>
                      <small>De la entrega de {a.origen}</small>
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <button
                        className={'btn sm' + (a.estado === 'resuelta' ? '' : ' ghost')}
                        onClick={() => void cambiarAmenaza(a, { estado: siguienteEstadoAmenaza(a.estado) })}
                      >
                        {ESTADOS_AMENAZA.find((e) => e.codigo === a.estado)?.nombre}
                      </button>
                      <button
                        className="btn sm ghost"
                        title="Llevarla a la minuta como tarea de la semana"
                        onClick={() => void agregar(a.descripcion, null)}
                      >
                        A la minuta
                      </button>
                    </div>
                  </div>
                  <label className="lab">
                    Cómo se soluciona
                    <textarea
                      rows={2} defaultValue={a.solucion}
                      placeholder="Qué hay que hacer para cerrarla"
                      onBlur={(e) => { if (e.target.value !== a.solucion) void cambiarAmenaza(a, { solucion: e.target.value }) }}
                    />
                  </label>
                  <label className="lab">
                    Quién responde
                    <input
                      defaultValue={a.responsable} placeholder="Nombre o empresa"
                      onBlur={(e) => { if (e.target.value !== a.responsable) void cambiarAmenaza(a, { responsable: e.target.value.trim() }) }}
                    />
                  </label>
                </div>
              ))}
            </div>
          </>
        )}

      <h3 className="sec">Para nuestra entrega de turno</h3>
      <p className="hint" style={{ margin: '0 0 8px' }}>
        Lo que escribas acá va a la <b>entrega de turno de planificación</b>, en
        Observaciones. Tócala para cargarle información, archivos y subtareas, igual
        que a cualquier tarea. (La de supervisión es otra área, no se toca.)
      </p>
      <ul className="plan-lista">
        {observaciones.map((o) => (
          <li key={o.id} className={'plan-tarea min-' + o.estado}>
            <button
              className="plan-check" title={ESTADOS_MINUTA.find((e) => e.codigo === o.estado)?.nombre}
              onClick={() => void cambiar(o, { estado: siguienteEstado(o.estado) })}
            >
              {ESTADOS_MINUTA.find((e) => e.codigo === o.estado)?.corto}
            </button>
            <span className="plan-cuerpo" onClick={() => abrirFicha(o.id)}>
              <b>{o.titulo}</b>
              <small>
                Observación
                {o.cierre ? ` · cierra ${o.cierre}` : ''}
                {subtareasDe(o.id).length > 0 ? ` · ${subtareasDe(o.id).length} subtareas` : ''}
                {o.vieneDe ? ' · viene de la semana anterior' : ''}
              </small>
            </span>
            <button className="memb-x" onClick={() => void quitar(o.id)} title="Borrar">✕</button>
          </li>
        ))}
        <li className="plan-nueva">
          <input
            value={nuevaObs}
            placeholder="Observación para el turno"
            onChange={(e) => setNuevaObs(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void agregar(nuevaObs, null, 'observacion') }}
          />
          <button className="btn sm" onClick={() => void agregar(nuevaObs, null, 'observacion')}>Agregar</button>
        </li>
      </ul>

      <h3 className="sec">Nuestras entregas de turno de esta semana</h3>
      {errorBajada && <p className="memb-aviso">{errorBajada}</p>}
      {entregas.length === 0
        ? <p className="hint">Esta semana todavía no se entrega el turno. Se hace con "Cerrar la semana".</p>
        : (
          <div className="lista">
            {entregas.map((e) => (
              <div key={e.id} className="fila-entrega">
                <div>
                  <b>{e.fecha} · {e.entrega.nombre}{e.recibe.nombre ? ` → ${e.recibe.nombre}` : ''}</b>
                  <small>
                    {e.realizadas.length} realizadas · {e.seguimiento.length} en seguimiento
                    {' · '}{e.pendientes.length} pendientes
                  </small>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn sm" onClick={() => void bajarEntrega(e, 'excel')}>Excel</button>
                  <button className="btn sm ghost" onClick={() => void bajarEntrega(e, 'pdf')}>PDF</button>
                </div>
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
