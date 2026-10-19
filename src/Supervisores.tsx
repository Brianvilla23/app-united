// La carpeta de supervisión: todo lo del turno en un solo lugar.
//
// Se entra CON CUENTA, sí o sí (Brayan, 13-10-2026: "que ya no sea opcional
// sino que sea fijo"). La cuenta es la misma de Supabase Auth que usa
// Planificación; el rol lo dice la base (`supervisores` y `plan_editores`,
// `sql/28`), y el PGP lo cierra también la base (`sql/29`).
//
// En terreno no hay señal, así que:
//  · la sesión queda guardada en el celular (supabase-js la persiste) y se
//    entra una sola vez;
//  · el rol y el nombre se recuerdan (`united_rol_terreno`): si no se puede
//    preguntar a la base, vale lo último que se supo de ESA cuenta;
//  · el ingreso es un <form> con autocomplete, para que el teléfono ofrezca
//    guardar la clave.
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { cambiarClave, entrar, miRol, salir, type RolTerreno } from './planDatos'

export type DestinoSupervisores = 'entrega' | 'fugas' | 'andamio' | 'pgp' | 'documentos'

const TARJETAS: { destino: DestinoSupervisores; icono: string; nombre: string; bajada: string; color: string }[] = [
  { destino: 'entrega', icono: '📝', nombre: 'Entrega de turno', bajada: 'Formato PYC-EG-MEL-6001-01 · Excel y PDF', color: 'amber' },
  { destino: 'pgp', icono: '🦺', nombre: 'PGP', bajada: 'Charla, fatiga, equipos y cartilla CIS · 7 días', color: 'rojo' },
  { destino: 'documentos', icono: '📋', nombre: 'Check list y documentos', bajada: 'Check list, protocolos y BOS del CC6001 · ver e imprimir', color: 'blue' },
  { destino: 'fugas', icono: '💧', nombre: 'Diagrama de fugas', bajada: 'Marcar y editar fugas por rack', color: 'blue' },
  { destino: 'andamio', icono: '🏗️', nombre: 'Levantamiento de andamio', bajada: 'Acta + tarjeta de andamio', color: 'amber' },
]

const CLAVE_ROL = 'united_rol_terreno'

function rolGuardado(correo: string): RolTerreno | null {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE_ROL) ?? 'null') as (RolTerreno & { correo: string }) | null
    return g && g.correo === correo ? g : null
  } catch { return null }
}

interface Cuenta extends RolTerreno { correo: string | null; cargando: boolean }

function useCuenta(): Cuenta {
  const [c, setC] = useState<Cuenta>({ correo: null, supervisor: false, planificacion: false, nombre: null, cargando: true })
  useEffect(() => {
    let vivo = true
    const revisar = async (correo: string | null) => {
      if (!correo) {
        localStorage.removeItem(CLAVE_ROL)
        if (vivo) setC({ correo: null, supervisor: false, planificacion: false, nombre: null, cargando: false })
        return
      }
      // primero lo recordado, para no hacer esperar ni dejar afuera sin señal
      const antes = rolGuardado(correo)
      if (antes && vivo) setC({ ...antes, correo, cargando: false })
      const rol = await miRol(correo).catch(() => null)
      if (rol) localStorage.setItem(CLAVE_ROL, JSON.stringify({ ...rol, correo }))
      const final = rol ?? antes ?? { supervisor: false, planificacion: false, nombre: null }
      if (vivo) setC({ ...final, correo, cargando: false })
    }
    void supabase.auth.getSession().then(({ data }) => revisar(data.session?.user.email ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { void revisar(s?.user.email ?? null) })
    return () => { vivo = false; sub.subscription.unsubscribe() }
  }, [])
  return c
}

function Ingreso() {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const ingresar = async () => {
    if (!correo || !clave) return
    setOcupado(true); setError('')
    try { await entrar(correo, clave) } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo entrar.')
    } finally { setOcupado(false) }
  }

  return (
    <form
      className="form" method="post" action="#"
      onSubmit={(e) => { e.preventDefault(); void ingresar() }}
    >
      <h2 style={{ margin: '0 0 4px' }}>Supervisión</h2>
      <p className="hint" style={{ marginBottom: 12 }}>
        Entra con tu correo y tu clave. Se pide una sola vez: el celular queda con la sesión
        abierta, también sin señal.
      </p>
      <label className="lab" htmlFor="sup-correo">Correo</label>
      <input
        id="sup-correo" name="email" type="email" autoComplete="username" inputMode="email"
        value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@unitedpipeline-sa.com"
      />
      <label className="lab" htmlFor="sup-clave">Clave</label>
      <input
        id="sup-clave" name="password" type="password" autoComplete="current-password"
        value={clave} onChange={(e) => setClave(e.target.value)}
      />
      {error && <p className="memb-aviso" style={{ marginTop: 10 }}>{error}</p>}
      <button type="submit" className="btn primary" style={{ width: '100%' }} disabled={ocupado || !correo || !clave}>
        {ocupado ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}

function Tarjeta({ cuenta, rol }: { cuenta: Cuenta; rol: string }) {
  const [nueva, setNueva] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState('')

  const guardarClave = async () => {
    try {
      await cambiarClave(nueva ?? '')
      setNueva(null); setMensaje('Clave cambiada. Si el celular te ofrece actualizarla, acepta.')
    } catch (e) { setMensaje(e instanceof Error ? e.message : 'No se pudo cambiar.') }
  }

  return (
    <div className="sup-cuenta dentro">
      <span className="sup-nombre">{cuenta.nombre ?? cuenta.correo}</span>
      <small>✓ {rol}{cuenta.nombre ? ` · ${cuenta.correo}` : ''}</small>
      <div className="row" style={{ gap: 6, marginTop: 6 }}>
        <button className="btn sm ghost" onClick={() => { setNueva(nueva === null ? '' : null); setMensaje('') }}>
          Cambiar clave
        </button>
        <button className="btn sm ghost" onClick={() => { if (confirm('¿Cerrar la sesión en este celular?')) void salir() }}>
          Salir
        </button>
      </div>
      {nueva !== null && (
        <form
          className="row" style={{ gap: 6, marginTop: 6 }}
          onSubmit={(e) => { e.preventDefault(); if (nueva.length >= 6) void guardarClave() }}
        >
          <input type="email" name="email" autoComplete="username" value={cuenta.correo ?? ''} readOnly hidden />
          <input
            type="password" name="new-password" autoComplete="new-password" placeholder="Clave nueva (mínimo 6)"
            value={nueva} onChange={(e) => setNueva(e.target.value)} style={{ flex: 1 }}
          />
          <button type="submit" className="btn sm" disabled={nueva.length < 6}>Guardar</button>
        </form>
      )}
      {mensaje && <p className="hint">{mensaje}</p>}
    </div>
  )
}

/** Puerta de la carpeta: sin cuenta de supervisión o planificación no se pasa. */
function Puerta({ children, onNombre }: { children: (cuenta: Cuenta, rol: string) => ReactNode; onNombre: (n: string) => void }) {
  const cuenta = useCuenta()
  const rol = cuenta.supervisor && cuenta.planificacion ? 'Supervisión y planificación'
    : cuenta.supervisor ? 'Supervisión'
    : cuenta.planificacion ? 'Planificación' : null

  // lo que registre queda firmado con el nombre de su cuenta
  useEffect(() => { if (rol && cuenta.nombre) onNombre(cuenta.nombre) }, [rol, cuenta.nombre, onNombre])

  if (cuenta.cargando) return <p className="hint">Revisando tu cuenta…</p>
  if (!cuenta.correo) return <Ingreso />
  if (!rol) {
    return (
      <div className="sup-cuenta dentro sin-rol">
        <span><b>Esta cuenta no está en supervisión</b></span>
        <small>{cuenta.correo} · pídele a Brayan que la agregue</small>
        <div className="row" style={{ gap: 6, marginTop: 6 }}>
          <button className="btn sm ghost" onClick={() => void salir()}>Salir</button>
        </div>
      </div>
    )
  }
  return <>{children(cuenta, rol)}</>
}

export default function Supervisores({
  go, onNombre,
}: { go: (d: DestinoSupervisores) => void; onNombre: (n: string) => void }) {
  return (
    <div>
      <div className="plano-titulo">
        <b>SUPERVISORES</b>
        <span>ENTREGA DE TURNO · PGP · CHECK LIST · FUGAS · ANDAMIOS</span>
      </div>
      <Puerta onNombre={onNombre}>
        {(cuenta, rol) => (
          <>
            <Tarjeta cuenta={cuenta} rol={rol} />
            <div className="menu-grid">
              {TARJETAS.map((t) => (
                <button key={t.destino} className="menu-card" onClick={() => go(t.destino)}>
                  <span className={`mc-ico ${t.color}`}>{t.icono}</span>
                  <span className="mc-txt"><b>{t.nombre}</b><small>{t.bajada}</small></span>
                  <span className="mc-arrow">›</span>
                </button>
              ))}
            </div>
          </>
        )}
      </Puerta>
    </div>
  )
}
