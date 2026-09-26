// Planificación: los proyectos con sus actividades y las entregas de turno que
// mandan los supervisores.
//
// Es la única pantalla con cuenta. Quién entra lo dice la tabla `plan_editores`
// en la base y lo hace cumplir RLS: si alguien abre esta pantalla sin ser
// editor, la base no le devuelve ni una fila. Lo de acá es la comodidad, no la
// seguridad.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { quienSoy } from './identidad'
import { uuid } from './util'
import { fechaCorta } from './fecha'
import {
  armarArbol, borrarTarea, cambiarClave, entrar, guardarTarea, nombreTurno, salir,
  soyEditor, traerEntregas, traerProyectos, traerTareas,
  type ActividadConSubtareas, type Entrega, type Proyecto, type Tarea,
} from './planDatos'
import { bajarCSVEntregas, generarPDFEntrega } from './pdfEntrega'
import { bajarExcelEntrega } from './xlsxEntrega'

type Pestana = 'proyectos' | 'entregas'

interface Sesion {
  correo: string | null
  esEditor: boolean
  cargando: boolean
}

function useSesion(): Sesion {
  const [sesion, setSesion] = useState<Sesion>({ correo: null, esEditor: false, cargando: true })

  useEffect(() => {
    let vivo = true
    const revisar = async (correo: string | null) => {
      if (!correo) {
        if (vivo) setSesion({ correo: null, esEditor: false, cargando: false })
        return
      }
      const editor = await soyEditor()
      if (vivo) setSesion({ correo, esEditor: editor, cargando: false })
    }
    void supabase.auth.getSession().then(({ data }) => revisar(data.session?.user.email ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { void revisar(s?.user.email ?? null) })
    return () => { vivo = false; sub.subscription.unsubscribe() }
  }, [])

  return sesion
}

// ------------------------------------------------------------------ entrar

function Ingreso() {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const ingresar = async () => {
    setOcupado(true); setError('')
    try {
      await entrar(correo, clave)
      setClave('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo entrar.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="form">
      <h2 style={{ margin: '0 0 4px' }}>Planificación</h2>
      <p className="hint" style={{ marginBottom: 12 }}>
        Esta parte va con cuenta: correo corporativo y clave.
      </p>
      <label className="lab">Correo</label>
      <input
        type="email" autoComplete="username" inputMode="email"
        value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@united.cl"
      />
      <label className="lab">Clave</label>
      <input
        type="password" autoComplete="current-password"
        value={clave} onChange={(e) => setClave(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void ingresar() }}
      />
      {error && <p className="memb-aviso" style={{ marginTop: 10 }}>{error}</p>}
      <button className="btn primary" disabled={ocupado || !correo || !clave} onClick={() => void ingresar()}>
        {ocupado ? 'Entrando…' : 'Entrar'}
      </button>
    </div>
  )
}

// -------------------------------------------------------------- proyectos

function PanelProyectos() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [elegido, setElegido] = useState<string>('')
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [error, setError] = useState('')
  const [nueva, setNueva] = useState('')
  const [abierta, setAbierta] = useState<string | null>(null)
  const [nuevaSub, setNuevaSub] = useState('')

  const cargarTareas = useCallback(async (proyecto: string) => {
    try { setTareas(await traerTareas(proyecto)) } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar.')
    }
  }, [])

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

  const fila = (t: Tarea, esSub: boolean) => (
    <li key={t.id} className={'plan-tarea' + (esSub ? ' sub' : '') + (t.estado === 'completada' ? ' tachada' : '')}>
      <button className="plan-check" onClick={() => tachar(t)} title="Completada">
        {t.estado === 'completada' ? '✓' : ''}
      </button>
      <span className="plan-cuerpo" onClick={() => setAbierta(abierta === t.id ? null : t.id)}>
        <b>{t.titulo}</b>
        {(t.desde || t.hasta || t.seguimiento) && (
          <small>
            {t.desde && `desde ${t.desde}`}{t.desde && t.hasta && ' · '}{t.hasta && `hasta ${t.hasta}`}
            {t.seguimiento && `${t.desde || t.hasta ? ' · ' : ''}${t.seguimiento}`}
          </small>
        )}
      </span>
      <button className="memb-x" onClick={() => void quitar(t.id)} title="Borrar">✕</button>
    </li>
  )

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
      </div>

      <div className="avance">
        <div className="avance-top">
          <b>{arbol.filter((a) => a.actividad.estado === 'completada').length}</b>
          <span>de {arbol.length} actividades completadas</span>
        </div>
      </div>

      <ul className="plan-lista">
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

        <li className="plan-nueva">
          <input
            value={nueva}
            placeholder="Actividad nueva"
            onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { void agregar(nueva, null); setNueva('') } }}
          />
          <button className="btn sm" onClick={() => { void agregar(nueva, null); setNueva('') }}>Agregar</button>
        </li>
      </ul>
    </div>
  )
}

// --------------------------------------------------------- entregas de turno

function PanelEntregas() {
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [error, setError] = useState('')
  const [abierta, setAbierta] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try { setEntregas(await traerEntregas(60)) } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar.')
      }
    })()
  }, [])

  if (error) return <p className="memb-aviso">{error}</p>

  return (
    <div>
      <div className="avance">
        <div className="avance-top">
          <b>{entregas.length}</b>
          <span>entregas en los últimos 60 días</span>
          {entregas.length > 0 && (
            <button className="btn sm ghost" onClick={() => bajarCSVEntregas(entregas)}>Resumen</button>
          )}
        </div>
      </div>

      {entregas.length === 0 && (
        <p className="hint">Todavía no llega ninguna. Los supervisores la mandan desde "Entrega de turno".</p>
      )}

      <div className="lista">
        {entregas.map((e) => (
          <div key={e.id} className="entrega-caja">
            <div className="fila-entrega" onClick={() => setAbierta(abierta === e.id ? null : e.id)}>
              <div>
                <b>{e.fecha} · {nombreTurno(e.turno)}{e.semana ? ` · ${e.semana}` : ''}</b>
                <small>{e.entrega.nombre}{e.entrega.cargo ? ` · ${e.entrega.cargo}` : ''}</small>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn sm ghost" onClick={(ev) => { ev.stopPropagation(); void bajarExcelEntrega(e) }}>Excel</button>
                <button className="btn sm ghost" onClick={(ev) => { ev.stopPropagation(); generarPDFEntrega(e) }}>PDF</button>
              </div>
            </div>
            {abierta === e.id && (
              <div className="entrega-detalle">
                {e.recibe.nombre && <p>Recibe: <b>{e.recibe.nombre}</b></p>}
                {e.ots.length > 0 && <>
                  <b>Órdenes de trabajo</b>
                  {e.ots.map((o, i) => (
                    <p key={i}>{o.ot ? `OT ${o.ot} · ` : ''}{o.observaciones} <em>({o.estado})</em></p>
                  ))}
                </>}
                {e.adicionales.length > 0 && <>
                  <b>Actividades adicionales</b>
                  {e.adicionales.map((a, i) => <p key={i}>{a.descripcion} <em>({a.estado})</em></p>)}
                </>}
                {e.amenazas.length > 0 && <>
                  <b>Amenazas</b>
                  {e.amenazas.map((a, i) => <p key={i}>{a.descripcion}</p>)}
                </>}
                {e.equipos.length > 0 && <>
                  <b>Equipos informados</b>
                  <p>{e.equipos.map((q) => `${q.interno}: ${q.estado || '—'}${q.horometro ? ` (${q.horometro})` : ''}`).join(' · ')}</p>
                </>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ pantalla

export default function Planificacion() {
  const sesion = useSesion()
  const [pestana, setPestana] = useState<Pestana>('proyectos')
  const [cambiando, setCambiando] = useState(false)
  const [nuevaClave, setNuevaClave] = useState('')
  const [aviso, setAviso] = useState('')

  if (sesion.cargando) return <p className="hint">Revisando la sesión…</p>
  if (!sesion.correo) return <Ingreso />

  if (!sesion.esEditor) {
    return (
      <div className="form">
        <h2 style={{ margin: '0 0 6px' }}>Sin acceso</h2>
        <p className="hint">
          La cuenta <b>{sesion.correo}</b> entró bien, pero no está en la lista de
          planificación. Pídele a Brayan que la agregue.
        </p>
        <button className="btn" onClick={() => void salir()}>Salir</button>
      </div>
    )
  }

  const guardarClave = async () => {
    try {
      await cambiarClave(nuevaClave)
      setNuevaClave(''); setCambiando(false)
      setAviso('Clave cambiada.')
      setTimeout(() => setAviso(''), 5000)
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo cambiar.')
    }
  }

  return (
    <div>
      <div className="plano-titulo">
        <b>PLANIFICACIÓN</b>
        <span>{fechaCorta().toUpperCase()}</span>
      </div>

      <div className="vista-seg">
        <button className={pestana === 'proyectos' ? 'on' : ''} onClick={() => setPestana('proyectos')}>
          Proyectos
        </button>
        <button className={pestana === 'entregas' ? 'on' : ''} onClick={() => setPestana('entregas')}>
          Entrega de turno
        </button>
      </div>

      {pestana === 'proyectos' ? <PanelProyectos /> : <PanelEntregas />}

      <div className="plan-pie">
        <span>{sesion.correo}</span>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn sm ghost" onClick={() => setCambiando(!cambiando)}>Cambiar clave</button>
          <button className="btn sm ghost" onClick={() => void salir()}>Salir</button>
        </div>
      </div>

      {cambiando && (
        <div className="form" style={{ marginTop: 10 }}>
          <label className="lab">Clave nueva</label>
          <input
            type="password" autoComplete="new-password"
            value={nuevaClave} onChange={(e) => setNuevaClave(e.target.value)}
            placeholder="Al menos 6 caracteres"
          />
          <button className="btn primary" disabled={nuevaClave.length < 6} onClick={() => void guardarClave()}>
            Guardar clave
          </button>
        </div>
      )}
      {aviso && <p className="entrega-ok">{aviso}</p>}
    </div>
  )
}
