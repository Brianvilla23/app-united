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
import { armarArbol, traerProyectos, traerTareas, type Proyecto, type Tarea } from './planDatos'
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

  const cargar = useCallback(async (semana: string) => {
    try { setTareas(await traerMinuta(semana)) } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar.')
    }
  }, [])

  useEffect(() => { void cargar(inicio) }, [inicio, cargar])

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

  const agregar = async (titulo: string, proyectoId: string | null) => {
    const t = titulo.trim()
    if (!t) return
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
                  onClick={() => void agregar(tarea.titulo, tarea.proyectoId)}
                >
                  A la semana
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
