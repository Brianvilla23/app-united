// Sesión con correo y clave, solo para el plan maestro.
//
// El resto de la app sigue entrando sin cuenta: la cuadrilla marca tapas y
// fugas sin registrarse, como hasta ahora. La cuenta hace falta únicamente
// para escribir la planilla madre, y quién puede hacerlo lo dice la tabla
// `plan_editores` en la base — no una lista dentro de este archivo, que sería
// pura decoración porque el JS de la app va publicado.
//
// Las cuentas NO se crean desde acá: se crean en Supabase → Authentication →
// Users. Así la clave la pone su dueño y nunca pasa por este código.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { entrar, salir, soyEditor } from './planDatos'

export interface Sesion {
  correo: string | null
  esEditor: boolean
  cargando: boolean
}

export function useSesion(): Sesion {
  const [sesion, setSesion] = useState<Sesion>({ correo: null, esEditor: false, cargando: true })

  useEffect(() => {
    let vivo = true

    async function revisar(correo: string | null) {
      if (!correo) {
        if (vivo) setSesion({ correo: null, esEditor: false, cargando: false })
        return
      }
      const editor = await soyEditor()
      if (vivo) setSesion({ correo, esEditor: editor, cargando: false })
    }

    void supabase.auth.getSession().then(({ data }) => revisar(data.session?.user.email ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      void revisar(s?.user.email ?? null)
    })
    return () => { vivo = false; sub.subscription.unsubscribe() }
  }, [])

  return sesion
}

export default function Cuenta({ onCerrar }: { onCerrar: () => void }) {
  const sesion = useSesion()
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function iniciar() {
    setOcupado(true); setError('')
    try {
      await entrar(correo, clave)
      setClave('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal plan-cuenta" onClick={(e) => e.stopPropagation()}>
        {sesion.correo ? (
          <>
            <h3>Sesión iniciada</h3>
            <p className="plan-sub">{sesion.correo}</p>
            <p className={sesion.esEditor ? 'plan-ok' : 'plan-error'}>
              {sesion.esEditor
                ? 'Puedes editar el plan.'
                : 'Esta cuenta entra pero no está habilitada para editar el plan.'}
            </p>
            <div className="plan-acciones">
              <button className="btn peligro" disabled={ocupado} onClick={async () => {
                setOcupado(true); await salir(); setOcupado(false)
              }}>Cerrar sesión</button>
              <button className="btn" onClick={onCerrar}>Volver</button>
            </div>
          </>
        ) : (
          <>
            <h3>Entrar para editar el plan</h3>
            <p className="plan-sub">
              Solo hace falta para cambiar la planilla. Para mirarla y para mandar
              sugerencias no se necesita cuenta.
            </p>
            <label>Correo
              <input
                type="email" autoComplete="username" value={correo} autoFocus
                onChange={(e) => setCorreo(e.target.value)}
              />
            </label>
            <label>Clave
              <input
                type="password" autoComplete="current-password" value={clave}
                onChange={(e) => setClave(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void iniciar() }}
              />
            </label>
            {error && <p className="plan-error">{error}</p>}
            <div className="plan-acciones">
              <button className="btn primary" disabled={ocupado || !correo || !clave} onClick={iniciar}>
                {ocupado ? 'Entrando…' : 'Entrar'}
              </button>
              <button className="btn" onClick={onCerrar}>Cancelar</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
