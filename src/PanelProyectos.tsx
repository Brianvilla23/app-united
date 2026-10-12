// Los proyectos de planificación con sus actividades y subtareas.
// Tachar es marcar: la completada se ve tachada, como en el papel.
import { useCallback, useEffect, useState } from 'react'
import Archivos from './Archivos'
import { quienSoy } from './identidad'
import { uuid } from './util'
import {
  armarArbol, borrarTarea, guardarProyecto, guardarTarea, traerProyectos, traerTareas,
  type ActividadConSubtareas, type Proyecto, type Tarea,
} from './planDatos'
import {
  borrarComentario, comentar, cuandoComentario, traerComentarios, type Comentario,
} from './comentarios'

export default function PanelProyectos() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [elegido, setElegido] = useState<string>('')
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [error, setError] = useState('')
  const [nueva, setNueva] = useState('')
  const [abierta, setAbierta] = useState<string | null>(null)
  const [nuevaSub, setNuevaSub] = useState('')
  const [editandoNombre, setEditandoNombre] = useState(false)
  const [nuevaSeccion, setNuevaSeccion] = useState<string | null>(null)
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [nuevoComentario, setNuevoComentario] = useState('')

  const cargarTareas = useCallback(async (proyecto: string) => {
    try {
      const ts = await traerTareas(proyecto)
      setTareas(ts)
      setComentarios(await traerComentarios('proyecto', ts.map((t) => t.id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar.')
    }
  }, [])

  const deTarea = (id: string) => comentarios.filter((c) => c.objetoId === id)

  const agregarComentario = async (t: Tarea) => {
    const texto = nuevoComentario.trim()
    if (!texto) return
    try {
      await comentar('proyecto', t.id, texto, quienSoy(), uuid())
      setNuevoComentario('')
      setComentarios(await traerComentarios('proyecto', tareas.map((x) => x.id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el comentario.')
    }
  }

  const quitarComentario = async (id: string) => {
    try {
      await borrarComentario(id)
      setComentarios((cs) => cs.filter((c) => c.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar el comentario.')
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const ps = await traerProyectos()
        setProyectos(ps)
        const primero = ps[0]?.id ?? ''
        setElegido(primero)
        if (primero) await cargarTareas(primero)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar.')
      }
    })()
  }, [cargarTareas])

  const arbol = armarArbol(tareas)

  const agregar = async (titulo: string, padreId: string | null) => {
    const t = titulo.trim()
    if (!t || !elegido) return
    const hermanos = tareas.filter((x) => (x.padreId ?? null) === padreId)
    const tarea: Tarea = {
      id: uuid(), proyectoId: elegido, padreId, titulo: t, estado: 'pendiente',
      desde: null, hasta: null, seguimiento: null, orden: hermanos.length + 1,
    }
    await guardarTarea(tarea, quienSoy())
    await cargarTareas(elegido)
  }

  /** Renombrar la sección que se está mirando. */
  const renombrar = async (nombre: string) => {
    const n = nombre.trim()
    const p = proyectos.find((x) => x.id === elegido)
    setEditandoNombre(false)
    if (!p || !n || n === p.nombre) return
    try {
      await guardarProyecto({ ...p, nombre: n }, quienSoy())
      setProyectos(await traerProyectos())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el nombre.')
    }
  }

  /** Una sección nueva: es una pestaña más de esta pantalla. */
  const crearSeccion = async (nombre: string) => {
    const n = nombre.trim()
    if (!n) { setNuevaSeccion(null); return }
    try {
      const id = uuid()
      await guardarProyecto(
        { id, nombre: n, orden: Math.max(0, ...proyectos.map((p) => p.orden)) + 1, activo: true },
        quienSoy(),
      )
      setProyectos(await traerProyectos())
      setNuevaSeccion(null)
      setElegido(id)
      setAbierta(null)
      await cargarTareas(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la sección.')
    }
  }

  const cambiar = async (tarea: Tarea, cambio: Partial<Tarea>) => {
    await guardarTarea({ ...tarea, ...cambio }, quienSoy())
    await cargarTareas(elegido)
  }

  const quitar = async (id: string) => {
    await borrarTarea(id)
    await cargarTareas(elegido)
  }

  /** Tachar es marcar: la actividad completada se ve tachada, como en el papel. */
  const tachar = (t: Tarea) =>
    void cambiar(t, { estado: t.estado === 'completada' ? 'pendiente' : 'completada' })

  const fila = (t: Tarea, esSub: boolean) => {
    const cs = deTarea(t.id)
    const ultimo = cs[cs.length - 1]
    return (
    <li key={t.id} className={'plan-tarea' + (esSub ? ' sub' : '') + (t.estado === 'completada' ? ' tachada' : '')}>
      <button className="plan-check" onClick={() => tachar(t)} title="Completada">
        {t.estado === 'completada' ? '✓' : ''}
      </button>
      <span className="plan-cuerpo" onClick={() => { setAbierta(abierta === t.id ? null : t.id); setNuevoComentario('') }}>
        <b>{t.titulo}</b>
        {(t.desde || t.hasta || t.seguimiento) && (
          <small>
            {t.desde && `desde ${t.desde}`}{t.desde && t.hasta && ' · '}{t.hasta && `hasta ${t.hasta}`}
            {t.seguimiento && `${t.desde || t.hasta ? ' · ' : ''}${t.seguimiento}`}
          </small>
        )}
        {ultimo && (
          <small className="coment-ultimo">
            💬 {cs.length > 1 ? `${cs.length} · ` : ''}{ultimo.texto}
          </small>
        )}
      </span>
      <button className="memb-x" onClick={() => void quitar(t.id)} title="Borrar">✕</button>
    </li>
    )
  }

  const detalle = (t: Tarea) => (
    <li className="plan-detalle">
      <div className="row" style={{ gap: 8 }}>
        <label className="lab" style={{ flex: 1 }}>
          Desde
          <input type="date" value={t.desde ?? ''} onChange={(e) => void cambiar(t, { desde: e.target.value || null })} />
        </label>
        <label className="lab" style={{ flex: 1 }}>
          Hasta
          <input type="date" value={t.hasta ?? ''} onChange={(e) => void cambiar(t, { hasta: e.target.value || null })} />
        </label>
      </div>
      <label className="lab">Seguimiento</label>
      <input
        defaultValue={t.seguimiento ?? ''}
        placeholder="Dónde va, qué falta, quién responde"
        onBlur={(e) => { if ((t.seguimiento ?? '') !== e.target.value) void cambiar(t, { seguimiento: e.target.value || null }) }}
      />
      <label className="lab">Comentarios</label>
      {deTarea(t.id).length > 0 && (
        <ul className="comentarios">
          {deTarea(t.id).map((c) => (
            <li key={c.id}>
              <div>
                <p>{c.texto}</p>
                <small>{c.autor}{c.autor && c.creadoEn ? ' · ' : ''}{cuandoComentario(c.creadoEn)}</small>
              </div>
              <button className="memb-x" title="Borrar el comentario" onClick={() => void quitarComentario(c.id)}>✕</button>
            </li>
          ))}
        </ul>
      )}
      <div className="plan-nueva">
        <input
          value={nuevoComentario}
          placeholder="Escribe un comentario: qué pasó, a quién se entregó…"
          onChange={(e) => setNuevoComentario(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void agregarComentario(t) }}
        />
        <button className="btn sm" disabled={!nuevoComentario.trim()} onClick={() => void agregarComentario(t)}>
          Comentar
        </button>
      </div>
      <label className="lab">Archivos</label>
      <Archivos ambito="proyecto" objetoId={t.id} />
    </li>
  )

  return (
    <div>
      {error && <p className="memb-aviso">{error}</p>}

      <div className="rack-tabs">
        {proyectos.map((p) => (
          <button
            key={p.id}
            className={'rack-tab' + (p.id === elegido ? ' on' : '')}
            onClick={() => { setElegido(p.id); setAbierta(null); void cargarTareas(p.id) }}
          >
            {p.nombre}
          </button>
        ))}
        <button className="rack-tab nueva-seccion" onClick={() => setNuevaSeccion('')}>+ Sección</button>
      </div>

      {nuevaSeccion !== null && (
        <div className="plan-nueva" style={{ marginBottom: 10 }}>
          <input
            autoFocus value={nuevaSeccion}
            placeholder="Nombre de la sección"
            onChange={(e) => setNuevaSeccion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void crearSeccion(nuevaSeccion)
              if (e.key === 'Escape') setNuevaSeccion(null)
            }}
          />
          <button className="btn sm" onClick={() => void crearSeccion(nuevaSeccion)}>Crear</button>
          <button className="btn sm ghost" onClick={() => setNuevaSeccion(null)}>Cancelar</button>
        </div>
      )}

      {elegido && (
        <div className="proyecto-titulo">
          {editandoNombre ? (
            <input
              autoFocus
              defaultValue={proyectos.find((p) => p.id === elegido)?.nombre ?? ''}
              onBlur={(e) => void renombrar(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void renombrar((e.target as HTMLInputElement).value)
                if (e.key === 'Escape') setEditandoNombre(false)
              }}
            />
          ) : (
            <>
              <b>{proyectos.find((p) => p.id === elegido)?.nombre}</b>
              <button className="btn sm ghost" onClick={() => setEditandoNombre(true)} title="Cambiar el nombre">
                Cambiar nombre
              </button>
            </>
          )}
        </div>
      )}

      <div className="avance">
        <div className="avance-top">
          <b>{arbol.filter((a) => a.actividad.estado === 'completada').length}</b>
          <span>de {arbol.length} actividades completadas</span>
        </div>
      </div>

      <ul className="plan-lista">
        <li className="plan-nueva">
          <input
            value={nueva}
            placeholder="Actividad nueva"
            onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { void agregar(nueva, null); setNueva('') } }}
          />
          <button className="btn sm" onClick={() => { void agregar(nueva, null); setNueva('') }}>Agregar</button>
        </li>

        {arbol.length === 0 && (
          <li className="hint" style={{ padding: '8px 2px' }}>
            Esta sección todavía no tiene actividades. Escribe la primera arriba.
          </li>
        )}

        {arbol.map((a: ActividadConSubtareas) => (
          <div key={a.actividad.id}>
            {fila(a.actividad, false)}
            {abierta === a.actividad.id && detalle(a.actividad)}
            {a.subtareas.map((s) => (
              <div key={s.id}>
                {fila(s, true)}
                {abierta === s.id && detalle(s)}
              </div>
            ))}
            {abierta === a.actividad.id && (
              <li className="plan-nueva sub">
                <input
                  value={nuevaSub}
                  placeholder="Subtarea"
                  onChange={(e) => setNuevaSub(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { void agregar(nuevaSub, a.actividad.id); setNuevaSub('') }
                  }}
                />
                <button className="btn sm" onClick={() => { void agregar(nuevaSub, a.actividad.id); setNuevaSub('') }}>
                  Agregar
                </button>
              </li>
            )}
          </div>
        ))}
      </ul>
    </div>
  )
}
