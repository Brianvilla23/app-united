// La carpeta de supervisión: todo lo del turno en un solo lugar.
//
// La cuenta es la misma de Planificación (Supabase Auth) y el rol lo dice la
// tabla `supervisores` en la base (`sql/28`). Etapa 2 del despliegue gradual
// (13-10-2026): se muestra con qué cuenta entraste, pero la carpeta sigue
// abierta para quien no tiene cuenta, hasta que todos tengan la suya.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { cambiarClave, entrar, salir, soyEditor, soySupervisor } from './planDatos'

export type DestinoSupervisores = 'entrega' | 'fugas' | 'andamio' | 'pgp'

const TARJETAS: { destino: DestinoSupervisores; icono: string; nombre: string; bajada: string; color: string }[] = [
  { destino: 'entrega', icono: '📝', nombre: 'Entrega de turno', bajada: 'Formato PYC-EG-MEL-6001-01 · Excel y PDF', color: 'amber' },
  { destino: 'pgp', icono: '🦺', nombre: 'PGP', bajada: 'Charla, fatiga, equipos y cartilla CIS · 7 días', color: 'rojo' },
  { destino: 'fugas', icono: '💧', nombre: 'Diagrama de fugas', bajada: 'Marcar y editar fugas por rack', color: 'blue' },
  { destino: 'andamio', icono: '🏗️', nombre: 'Levantamiento de andamio', bajada: 'Acta + tarjeta de andamio', color: 'amber' },
]

interface Cuenta { correo: string | null; supervisor: boolean; planificacion: boolean; cargando: boolean }

function useCuenta(): Cuenta {
  const [c, setC] = useState<Cuenta>({ correo: null, supervisor: false, planificacion: false, cargando: true })
  useEffect(() => {
    let vivo = true
    const revisar = async (correo: string | null) => {
      if (!correo) {
        if (vivo) setC({ correo: null, supervisor: false, planificacion: false, cargando: false })
        return
      }
      const [supervisor, planificacion] = await Promise.all([soySupervisor(), soyEditor()])
      if (vivo) setC({ correo, supervisor, planificacion, cargando: false })
    }
    void supabase.auth.getSession().then(({ data }) => revisar(data.session?.user.email ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { void revisar(s?.user.email ?? null) })
    return () => { vivo = false; sub.subscription.unsubscribe() }
  }, [])
  return c
}

function Ingreso({ onCancelar }: { onCancelar: () => void }) {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const ingresar = async () => {
    setOcupado(true); setError('')
    try { await entrar(correo, clave); setClave('') } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo entrar.')
    } finally { setOcupado(false) }
  }

  return (
    <div className="form" style={{ marginBottom: 12 }}>
      <label className="lab" style={{ marginTop: 0 }}>Correo</label>
      <input
        type="email" autoComplete="username" inputMode="email" value={correo}
        onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@unitedpipeline-sa.com"
      />
      <label className="lab">Clave</label>
      <input
        type="password" autoComplete="current-password" value={clave}
        onChange={(e) => setClave(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void ingresar() }}
      />
      {error && <p className="memb-aviso" style={{ marginTop: 10 }}>{error}</p>}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn ghost" onClick={onCancelar}>Cancelar</button>
        <button className="btn primary" disabled={ocupado || !correo || !clave} onClick={() => void ingresar()}>
          {ocupado ? 'Entrando…' : 'Entrar'}
        </button>
      </div>
    </div>
  )
}

function CuentaSupervision() {
  const cuenta = useCuenta()
  const [abierto, setAbierto] = useState(false)
  const [nueva, setNueva] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState('')

  if (cuenta.cargando) return null

  if (!cuenta.correo) {
    if (abierto) return <Ingreso onCancelar={() => setAbierto(false)} />
    return (
      <button className="sup-cuenta" onClick={() => setAbierto(true)}>
        <span>🔑 <b>Entrar con tu cuenta de supervisión</b></span>
        <small>Por ahora es opcional. Pronto hará falta para registrar.</small>
      </button>
    )
  }

  const rol = cuenta.supervisor && cuenta.planificacion ? 'Supervisión y planificación'
    : cuenta.supervisor ? 'Supervisión'
    : cuenta.planificacion ? 'Planificación' : null

  const guardarClave = async () => {
    try {
      await cambiarClave(nueva ?? '')
      setNueva(null); setMensaje('Clave cambiada.')
    } catch (e) { setMensaje(e instanceof Error ? e.message : 'No se pudo cambiar.') }
  }

  return (
    <div className={'sup-cuenta dentro' + (rol ? '' : ' sin-rol')}>
      <span>{rol ? <>✓ <b>{rol}</b></> : <b>Esta cuenta no está en supervisión</b>}</span>
      <small>{cuenta.correo}{rol ? '' : ' · pídele a Brayan que la agregue'}</small>
      <div className="row" style={{ gap: 6, marginTop: 6 }}>
        <button className="btn sm ghost" onClick={() => { setNueva(nueva === null ? '' : null); setMensaje('') }}>
          Cambiar clave
        </button>
        <button className="btn sm ghost" onClick={() => void salir()}>Salir</button>
      </div>
      {nueva !== null && (
        <div className="row" style={{ gap: 6, marginTop: 6 }}>
          <input
            type="password" autoComplete="new-password" placeholder="Clave nueva (mínimo 6)"
            value={nueva} onChange={(e) => setNueva(e.target.value)} style={{ flex: 1 }}
          />
          <button className="btn sm" disabled={nueva.length < 6} onClick={() => void guardarClave()}>Guardar</button>
        </div>
      )}
      {mensaje && <p className="hint">{mensaje}</p>}
    </div>
  )
}

export default function Supervisores({ go }: { go: (d: DestinoSupervisores) => void }) {
  return (
    <div>
      <div className="plano-titulo">
        <b>SUPERVISORES</b>
        <span>ENTREGA DE TURNO · PGP · FUGAS · ANDAMIOS</span>
      </div>
      <CuentaSupervision />
      <div className="menu-grid">
        {TARJETAS.map((t) => (
          <button key={t.destino} className="menu-card" onClick={() => go(t.destino)}>
            <span className={`mc-ico ${t.color}`}>{t.icono}</span>
            <span className="mc-txt"><b>{t.nombre}</b><small>{t.bajada}</small></span>
            <span className="mc-arrow">›</span>
          </button>
        ))}
      </div>
    </div>
  )
}
