// Planificación: la parte con cuenta, para Brayan y su colega.
//
// Al entrar se ve el HOME con las áreas y de ahí se baja a cada una. Quién
// entra lo dice la tabla `plan_editores` en la base y lo hace cumplir RLS: si
// alguien abre esta pantalla sin ser editor, la base no le devuelve ni una
// fila. Lo de acá es la comodidad, no la seguridad.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { fechaCorta } from './fecha'
import { cambiarClave, entrar, salir, soyEditor } from './planDatos'
import { martesDe, rotuloSemana } from './minuta'
import PanelMinuta from './PanelMinuta'
import PanelProyectos from './PanelProyectos'
import PanelEntregas from './PanelEntregas'
import EntregaPlanificacion from './EntregaPlanificacion'
import PanelPlan from './PanelPlan'
import PanelSeccion from './PanelSeccion'
import NuevaSeccion from './NuevaSeccion'
import { quienSoy } from './identidad'
import {
  SECCIONES_BASE, borrarSeccion, guardarSeccion, traerSecciones, type Seccion,
} from './secciones'

/** 'home' o el id de una sección: las cinco de siempre y las que se agreguen. */
type Area = string


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
        value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@unitedpipeline-sa.com"
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

// ------------------------------------------------------------------ pantalla

export default function Planificacion() {
  const sesion = useSesion()
  const [area, setArea] = useState<Area>('home')
  const [cambiando, setCambiando] = useState(false)
  const [secciones, setSecciones] = useState<Seccion[]>(SECCIONES_BASE)
  const [editando, setEditando] = useState(false)
  const [renombrando, setRenombrando] = useState<string | null>(null)
  const [agregando, setAgregando] = useState(false)

  const cargarSecciones = async () => {
    try { setSecciones(await traerSecciones()) } catch { /* quedan las de siempre */ }
  }
  useEffect(() => { void cargarSecciones() }, [])

  /** Cambiarle el nombre a una sección: vale para las de siempre y las nuevas. */
  const renombrar = async (s: Seccion, nombre: string) => {
    setRenombrando(null)
    const n = nombre.trim()
    if (!n || n === s.nombre) return
    await guardarSeccion({ ...s, nombre: n }, quienSoy())
    await cargarSecciones()
  }

  const quitarSeccion = async (s: Seccion) => {
    await borrarSeccion(s.id)
    if (area === s.id) setArea('home')
    await cargarSecciones()
  }
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

  const abierta = secciones.find((x) => x.id === area)

  return (
    <div>
      <div className="plano-titulo">
        <b>{abierta ? abierta.nombre.toUpperCase() : 'PLANIFICACIÓN'}</b>
        <span>{area === 'home' ? fechaCorta().toUpperCase() : 'PLANIFICACIÓN'}</span>
      </div>

      {area !== 'home' && (
        <button className="btn sm ghost" style={{ marginBottom: 10 }} onClick={() => setArea('home')}>
          ‹ Volver
        </button>
      )}

      {area === 'home' && (
        <>
          <p className="hint" style={{ margin: '0 0 12px' }}>
            Semana en curso: <b>{rotuloSemana(martesDe(new Date().toISOString().slice(0, 10)))}</b>.
            Va de martes a lunes, como la trabajas tú.
          </p>
          <div className="menu-grid">
            {secciones.map((s) => (
              <div key={s.id} className="menu-card-caja">
                {renombrando === s.id ? (
                  <div className="plan-nueva">
                    <input
                      autoFocus defaultValue={s.nombre}
                      onBlur={(e) => void renombrar(s, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void renombrar(s, (e.target as HTMLInputElement).value)
                        if (e.key === 'Escape') setRenombrando(null)
                      }}
                    />
                  </div>
                ) : (
                  <button className="menu-card" onClick={() => setArea(s.id)}>
                    <span className="mc-ico rojo">{s.icono}</span>
                    <span className="mc-txt"><b>{s.nombre}</b><small>{s.bajada}</small></span>
                    <span className="mc-arrow">›</span>
                  </button>
                )}
                {editando && renombrando !== s.id && (
                  <div className="row" style={{ gap: 6, padding: '0 6px 8px' }}>
                    <button className="btn sm ghost" onClick={() => setRenombrando(s.id)}>Cambiar nombre</button>
                    {s.tipo !== 'fija' && (
                      <button className="btn sm ghost" onClick={() => void quitarSeccion(s)}>Borrar</button>
                    )}
                  </div>
                )}
              </div>
            ))}
            <button className="menu-card agregar" onClick={() => setAgregando(true)}>
              <span className="mc-ico rojo">＋</span>
              <span className="mc-txt"><b>Agregar una sección</b><small>Te pregunto qué necesitas y te la muestro antes de crearla</small></span>
              <span className="mc-arrow">›</span>
            </button>
          </div>

          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button className="btn sm ghost" onClick={() => { setEditando(!editando); setRenombrando(null) }}>
              {editando ? 'Listo' : 'Editar las secciones'}
            </button>
          </div>
        </>
      )}

      {area === 'minuta' && <PanelMinuta />}
      {area === 'plan' && <PanelPlan />}
      {area === 'proyectos' && <PanelProyectos />}
      {area === 'entrega-propia' && <EntregaPlanificacion />}
      {area === 'entregas' && <PanelEntregas />}
      {abierta && abierta.tipo !== 'fija' && <PanelSeccion seccion={abierta} />}

      {agregando && (
        <NuevaSeccion
          orden={Math.max(50, ...secciones.map((s) => s.orden)) + 10}
          onCerrar={() => setAgregando(false)}
          onListo={(s) => { setAgregando(false); void cargarSecciones().then(() => setArea(s.id)) }}
        />
      )}

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
