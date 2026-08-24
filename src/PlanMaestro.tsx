// La planilla madre dentro de la app.
//
// Tres formas de mirar el mismo dato, que en el Excel eran imposibles o había
// que armarlas a mano cada vez:
//   Semana     la grilla de siempre — 7 días, turno día y turno noche, HH y lo
//              que sobra de las 344 HH del día.
//   Horizonte  actividad contra semanas, para ver de aquí a un año. Es lo que
//              no se podía ver saltando entre 56 bloques copiados.
//   Sugerencias lo que manda la cuadrilla desde planta, y qué se hizo con eso.
//
// Quien no es editor ve todo y no puede tocar nada. Eso lo decide la base
// (política RLS), no esta pantalla: acá los botones se esconden para no marear,
// pero aunque alguien los forzara, el servidor rechaza la escritura.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { uuid } from './util'
import { quienSoy } from './identidad'
import { empujarCapa, volver } from './navegacion'
import {
  bajarPlan, bajarSugerencias, bajarCatalogo, hhPorDia, guardarActividad, borrarActividad,
  copiarSemana, enviarSugerencia, resolverSugerencia, registrarPlan, SinPermiso, SinSenal,
  CLAVE_ULTIMA_BAJADA,
} from './planDatos'
import Cuenta, { useSesion } from './Cuenta'
import {
  type ActividadPlan, type EstadoPlan, type TipoSugerencia, type TurnoPlan,
  NOMBRE_ESTADO, COLOR_ESTADO, NOMBRE_TIPO_SUG, TURNOS,
  aISO, aFecha, lunesDe, sumarDias, semanaISO, fechasDeSemana, rangoSemana,
  DIAS_SEMANA, DIAS_CORTO, diaYMes,
} from './planTipos'

type Pestana = 'semana' | 'horizonte' | 'sugerencias'

const ESTADOS: EstadoPlan[] = ['planificada', 'en_curso', 'hecha', 'postergada', 'cancelada']

function hhDe(filas: ActividadPlan[]): number {
  return filas.reduce((t, f) => t + (f.hh ?? 0), 0)
}

// ---------------------------------------------------------------- vista semana

function BarraCarga({ usadas, tope }: { usadas: number; tope: number }) {
  const pct = tope > 0 ? Math.min(100, Math.round((usadas / tope) * 100)) : 0
  const pasado = usadas > tope
  return (
    <div className="plan-barra" title={`${usadas} de ${tope} HH`}>
      <div
        className={'plan-barra-fill' + (pasado ? ' pasado' : '')}
        style={{ width: `${pasado ? 100 : pct}%` }}
      />
    </div>
  )
}

function EditorLinea({
  linea, catalogo, onGuardar, onBorrar, onCerrar,
}: {
  linea: ActividadPlan
  catalogo: string[]
  onGuardar: (a: ActividadPlan) => Promise<void>
  onBorrar: (id: string) => Promise<void>
  onCerrar: () => void
}) {
  const [a, setA] = useState<ActividadPlan>(linea)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const nuevo = !linea.actividad

  const cambiar = <K extends keyof ActividadPlan>(k: K, v: ActividadPlan[K]) =>
    setA((x) => ({ ...x, [k]: v }))

  async function guardar() {
    if (!a.actividad.trim()) { setError('Ponle nombre a la actividad.'); return }
    setGuardando(true); setError('')
    try {
      await onGuardar({ ...a, actividad: a.actividad.trim() })
      onCerrar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal plan-editor" onClick={(e) => e.stopPropagation()}>
        <h3>{nuevo ? 'Agregar al plan' : 'Editar línea del plan'}</h3>
        <p className="plan-sub">
          {DIAS_SEMANA[(aFecha(a.fecha).getDay() + 6) % 7]} {diaYMes(a.fecha)} · turno {a.turno === 'Dia' ? 'día' : 'noche'}
        </p>

        <label>Actividad
          <input
            list="plan-catalogo" autoFocus value={a.actividad}
            placeholder="Ej: Retiro de Tapas rack 12"
            onChange={(e) => cambiar('actividad', e.target.value)}
          />
        </label>
        <datalist id="plan-catalogo">
          {catalogo.map((c) => <option key={c} value={c} />)}
        </datalist>

        <div className="plan-fila-2">
          <label>HH
            <input
              type="number" inputMode="numeric" min={0} value={a.hh ?? ''}
              onChange={(e) => cambiar('hh', e.target.value === '' ? null : Number(e.target.value))}
            />
          </label>
          <label>Turno
            <select value={a.turno} onChange={(e) => cambiar('turno', e.target.value as TurnoPlan)}>
              {TURNOS.map((t) => <option key={t} value={t}>{t === 'Dia' ? 'Día' : 'Noche'}</option>)}
            </select>
          </label>
        </div>

        <div className="plan-fila-2">
          <label>Estado
            <select value={a.estado} onChange={(e) => cambiar('estado', e.target.value as EstadoPlan)}>
              {ESTADOS.map((e2) => <option key={e2} value={e2}>{NOMBRE_ESTADO[e2]}</option>)}
            </select>
          </label>
          <label>Día
            <input type="date" value={a.fecha} onChange={(e) => {
              if (!e.target.value) return
              const { anio, semana } = semanaISO(aFecha(e.target.value))
              setA((x) => ({ ...x, fecha: e.target.value, anio, semana }))
            }} />
          </label>
        </div>

        <div className="plan-fila-2">
          <label>Zona <input value={a.zona} placeholder="opcional" onChange={(e) => cambiar('zona', e.target.value)} /></label>
          <label>OT <input value={a.ot} placeholder="opcional" onChange={(e) => cambiar('ot', e.target.value)} /></label>
        </div>

        <label>Nota
          <textarea rows={2} value={a.nota} placeholder="opcional" onChange={(e) => cambiar('nota', e.target.value)} />
        </label>

        {error && <p className="plan-error">{error}</p>}

        <div className="plan-acciones">
          <button className="btn primary" disabled={guardando} onClick={guardar}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
          {!nuevo && (
            <button className="btn peligro" disabled={guardando} onClick={async () => {
              setGuardando(true)
              try { await onBorrar(a.id); onCerrar() }
              catch (e) { setError(e instanceof Error ? e.message : 'No se pudo borrar.'); setGuardando(false) }
            }}>Borrar</button>
          )}
          <button className="btn" onClick={onCerrar}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function CajaSugerir({ fecha, actividadId, onListo }: {
  fecha: string | null; actividadId: string | null; onListo: () => void
}) {
  const [tipo, setTipo] = useState<TipoSugerencia>('cambiar')
  const [texto, setTexto] = useState('')
  const [listo, setListo] = useState(false)

  if (listo) {
    return (
      <div className="plan-sug-ok">
        Sugerencia enviada. Si estás sin señal queda guardada y sube sola.
        <button className="btn" onClick={onListo}>Cerrar</button>
      </div>
    )
  }
  return (
    <div className="plan-sug-caja">
      <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoSugerencia)}>
        {(Object.keys(NOMBRE_TIPO_SUG) as TipoSugerencia[]).map((t) =>
          <option key={t} value={t}>{NOMBRE_TIPO_SUG[t]}</option>)}
      </select>
      <textarea
        rows={3} value={texto} placeholder="Qué cambiarías y por qué"
        onChange={(e) => setTexto(e.target.value)}
      />
      <div className="plan-acciones">
        <button
          className="btn primary" disabled={texto.trim().length < 5}
          onClick={async () => { await enviarSugerencia({ tipo, texto, fecha, actividadId }); setListo(true) }}
        >Enviar</button>
        <button className="btn" onClick={onListo}>Cancelar</button>
      </div>
    </div>
  )
}

function VistaSemana({
  lunes, setLunes, plan, tope, puedeEditar, catalogo, recargar,
}: {
  lunes: Date
  setLunes: (d: Date) => void
  plan: ActividadPlan[]
  tope: number
  puedeEditar: boolean
  catalogo: string[]
  recargar: () => void
}) {
  const [editando, setEditando] = useState<ActividadPlan | null>(null)
  const [sugiriendo, setSugiriendo] = useState<{ fecha: string; id: string | null } | null>(null)
  const dias = fechasDeSemana(lunes)
  const hoy = aISO(new Date())

  const porDia = useMemo(() => {
    const m = new Map<string, ActividadPlan[]>()
    for (const d of dias) m.set(d, [])
    for (const p of plan) m.get(p.fecha)?.push(p)
    for (const v of m.values()) v.sort((a, b) => a.orden - b.orden || a.actividad.localeCompare(b.actividad))
    return m
  }, [plan, dias.join()])

  const { anio, semana } = semanaISO(lunes)
  const totalSemana = hhDe(plan)

  function nueva(fecha: string, turno: TurnoPlan): ActividadPlan {
    const s = semanaISO(aFecha(fecha))
    return {
      id: uuid(), fecha, anio: s.anio, semana: s.semana, turno, actividad: '', hh: null,
      estado: 'planificada', zona: '', ot: '', nota: '',
      orden: (porDia.get(fecha)?.length ?? 0) + 1,
      creadoPor: quienSoy(), actualizadoPor: quienSoy(), actualizadoEn: Date.now(),
    }
  }

  return (
    <div className="plan-semana">
      <div className="plan-nav">
        <button className="btn" onClick={() => setLunes(sumarDias(lunes, -7))} aria-label="Semana anterior">‹</button>
        <div className="plan-nav-txt">
          <b>Semana {String(semana).padStart(2, '0')} · {anio}</b>
          <small>{rangoSemana(lunes)}</small>
        </div>
        <button className="btn" onClick={() => setLunes(sumarDias(lunes, 7))} aria-label="Semana siguiente">›</button>
      </div>

      <div className="plan-resumen">
        {dias.map((d, i) => {
          const usadas = hhDe(porDia.get(d) ?? [])
          return (
            <div key={d} className={'plan-mini' + (d === hoy ? ' hoy' : '')}>
              <span>{DIAS_CORTO[i]}</span>
              <BarraCarga usadas={usadas} tope={tope} />
              <small className={usadas > tope ? 'pasado' : ''}>{usadas || '—'}</small>
            </div>
          )
        })}
      </div>
      <p className="plan-total">
        {totalSemana} HH planificadas de {tope * 7} disponibles en la semana
        {totalSemana > tope * 7 && <b className="pasado"> · se pasa por {totalSemana - tope * 7} HH</b>}
      </p>

      {puedeEditar && (
        <div className="plan-copiar">
          <button className="btn" onClick={async () => {
            const destino = sumarDias(lunes, 7)
            if (!confirm(`¿Copiar esta semana a la del ${rangoSemana(destino)}?`)) return
            try {
              const n = await copiarSemana(lunes, destino)
              alert(n === 0 ? 'Esta semana no tiene nada que copiar.' : `${n} líneas copiadas.`)
              recargar()
            } catch (e) { alert(e instanceof Error ? e.message : 'No se pudo copiar.') }
          }}>Copiar a la semana siguiente</button>
        </div>
      )}

      {dias.map((d, i) => {
        const delDia = porDia.get(d) ?? []
        const usadas = hhDe(delDia)
        return (
          <section key={d} className={'plan-dia' + (d === hoy ? ' hoy' : '')}>
            <header>
              <b>{DIAS_SEMANA[i]}</b>
              <span>{diaYMes(d)}</span>
              <small className={usadas > tope ? 'pasado' : ''}>
                {usadas} / {tope} HH · {usadas > tope
                  ? `se pasa por ${usadas - tope}`
                  : `quedan ${tope - usadas}`}
              </small>
            </header>

            {TURNOS.map((t) => {
              const delTurno = delDia.filter((x) => x.turno === t)
              return (
                <div key={t} className="plan-turno">
                  <div className="plan-turno-tit">
                    <span>{t === 'Dia' ? 'Día' : 'Noche'}</span>
                    <small>{hhDe(delTurno)} HH</small>
                  </div>
                  {delTurno.length === 0 && <p className="plan-vacio">Sin actividades</p>}
                  {delTurno.map((a) => (
                    <button
                      key={a.id} className="plan-linea"
                      onClick={() => puedeEditar ? setEditando(a) : setSugiriendo({ fecha: d, id: a.id })}
                    >
                      <span className="plan-punto" style={{ background: COLOR_ESTADO[a.estado] }} />
                      <span className="plan-nombre">
                        {a.actividad}
                        {a.ot && <small> · OT {a.ot}</small>}
                        {a.estado !== 'planificada' && <small> · {NOMBRE_ESTADO[a.estado]}</small>}
                      </span>
                      <span className="plan-hh">{a.hh ?? '—'}</span>
                    </button>
                  ))}
                  {puedeEditar && (
                    <button className="plan-agregar" onClick={() => setEditando(nueva(d, t))}>+ agregar</button>
                  )}
                </div>
              )
            })}

            {!puedeEditar && (
              sugiriendo?.fecha === d
                ? <CajaSugerir fecha={d} actividadId={sugiriendo.id} onListo={() => setSugiriendo(null)} />
                : <button className="plan-agregar" onClick={() => setSugiriendo({ fecha: d, id: null })}>
                    Sugerir algo para este día
                  </button>
            )}
          </section>
        )
      })}

      {editando && (
        <EditorLinea
          linea={editando} catalogo={catalogo}
          onGuardar={async (a) => {
            await guardarActividad(a)
            void registrarPlan(editando.actividad ? 'edito' : 'creo', `${a.actividad} (${a.hh ?? 0} HH)`, a.id, a.fecha)
            recargar()
          }}
          onBorrar={async (id) => {
            await borrarActividad(id)
            void registrarPlan('borro', editando.actividad, id, editando.fecha)
            recargar()
          }}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  )
}

// ------------------------------------------------------------ vista horizonte

function VistaHorizonte({ lunes, plan, tope }: { lunes: Date; plan: ActividadPlan[]; tope: number }) {
  const [cuantas, setCuantas] = useState(12)

  const semanas = useMemo(
    () => Array.from({ length: cuantas }, (_, i) => sumarDias(lunes, i * 7)),
    [lunes, cuantas],
  )
  const claves = semanas.map((s) => { const { anio, semana } = semanaISO(s); return `${anio}-${semana}` })
  const dentro = new Set(claves)

  const { filas, totales } = useMemo(() => {
    const acum = new Map<string, Map<string, number>>()
    const tot = new Map<string, number>()
    for (const p of plan) {
      const k = `${p.anio}-${p.semana}`
      if (!dentro.has(k)) continue
      if (!acum.has(p.actividad)) acum.set(p.actividad, new Map())
      const fila = acum.get(p.actividad)!
      fila.set(k, (fila.get(k) ?? 0) + (p.hh ?? 0))
      tot.set(k, (tot.get(k) ?? 0) + (p.hh ?? 0))
    }
    const ordenadas = [...acum.entries()]
      .map(([actividad, porSemana]) => ({
        actividad, porSemana,
        total: [...porSemana.values()].reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => b.total - a.total)
    return { filas: ordenadas, totales: tot }
  }, [plan, claves.join()])

  const maximo = Math.max(1, ...filas.flatMap((f) => [...f.porSemana.values()]))
  const topeSemana = tope * 7

  if (filas.length === 0) {
    return <p className="plan-vacio grande">No hay nada planificado en estas {cuantas} semanas.</p>
  }

  return (
    <div className="plan-horizonte">
      <div className="plan-chips">
        {[12, 26, 52].map((n) => (
          <button key={n} className={'chip' + (cuantas === n ? ' on' : '')} onClick={() => setCuantas(n)}>
            {n} semanas
          </button>
        ))}
      </div>
      <p className="plan-sub">
        HH por actividad y por semana. Cada columna es una semana; mientras más oscura, más carga.
      </p>

      <div className="plan-tabla-scroll">
        <table className="plan-tabla">
          <thead>
            <tr>
              <th className="pegada">Actividad</th>
              {semanas.map((s, i) => {
                const { semana } = semanaISO(s)
                return <th key={claves[i]} title={rangoSemana(s)}>W{String(semana).padStart(2, '0')}</th>
              })}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.actividad}>
                <td className="pegada" title={f.actividad}>{f.actividad}</td>
                {claves.map((k) => {
                  const v = f.porSemana.get(k) ?? 0
                  const alfa = v > 0 ? 0.15 + 0.75 * (v / maximo) : 0
                  return (
                    <td key={k} style={v > 0 ? { background: `rgba(37,99,235,${alfa.toFixed(2)})` } : undefined}>
                      {v > 0 ? Math.round(v) : ''}
                    </td>
                  )
                })}
                <td><b>{Math.round(f.total)}</b></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="pegada"><b>Carga de la semana</b></td>
              {claves.map((k) => {
                const v = totales.get(k) ?? 0
                const pasado = v > topeSemana
                return <td key={k} className={pasado ? 'pasado' : ''}><b>{v ? Math.round(v) : ''}</b></td>
              })}
              <td />
            </tr>
            <tr className="plan-tope">
              <td className="pegada">Disponible</td>
              {claves.map((k) => <td key={k}>{topeSemana}</td>)}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------- vista sugerencias

function VistaSugerencias({ puedeEditar, recargar }: { puedeEditar: boolean; recargar: () => void }) {
  const sugerencias = useLiveQuery(
    () => db.sugerencias.orderBy('createdAt').reverse().toArray(), [],
  ) ?? []
  const [respondiendo, setRespondiendo] = useState<string | null>(null)
  const [texto, setTexto] = useState('')

  const pendientes = sugerencias.filter((s) => s.estado === 'pendiente')
  const resueltas = sugerencias.filter((s) => s.estado !== 'pendiente')

  async function resolver(id: string, estado: 'aceptada' | 'rechazada') {
    try {
      await resolverSugerencia(id, estado, texto)
      setRespondiendo(null); setTexto(''); recargar()
    } catch (e) { alert(e instanceof Error ? e.message : 'No se pudo responder.') }
  }

  if (sugerencias.length === 0) {
    return <p className="plan-vacio grande">Todavía no hay sugerencias.</p>
  }

  return (
    <div className="plan-sugerencias">
      <h3>Pendientes ({pendientes.length})</h3>
      {pendientes.length === 0 && <p className="plan-vacio">Ninguna pendiente.</p>}
      {pendientes.map((s) => (
        <article key={s.id} className="plan-sug">
          <header>
            <b>{NOMBRE_TIPO_SUG[s.tipo]}</b>
            <small>{s.autor}{s.fecha ? ` · ${diaYMes(s.fecha)}` : ''}</small>
          </header>
          <p>{s.texto}</p>
          {puedeEditar && (
            respondiendo === s.id ? (
              <div className="plan-sug-caja">
                <textarea rows={2} value={texto} placeholder="Respuesta (opcional)"
                  onChange={(e) => setTexto(e.target.value)} />
                <div className="plan-acciones">
                  <button className="btn primary" onClick={() => resolver(s.id, 'aceptada')}>Aceptar</button>
                  <button className="btn peligro" onClick={() => resolver(s.id, 'rechazada')}>Rechazar</button>
                  <button className="btn" onClick={() => { setRespondiendo(null); setTexto('') }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <button className="btn" onClick={() => setRespondiendo(s.id)}>Responder</button>
            )
          )}
        </article>
      ))}

      {resueltas.length > 0 && <h3>Resueltas ({resueltas.length})</h3>}
      {resueltas.map((s) => (
        <article key={s.id} className={'plan-sug ' + s.estado}>
          <header>
            <b>{NOMBRE_TIPO_SUG[s.tipo]}</b>
            <small>{s.autor} · {s.estado}</small>
          </header>
          <p>{s.texto}</p>
          {s.respuesta && <p className="plan-respuesta">{s.resueltoPor}: {s.respuesta}</p>}
        </article>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ pantalla

export default function PlanMaestro() {
  const [pestana, setPestana] = useState<Pestana>('semana')
  const [lunes, setLunes] = useState(() => lunesDe(new Date()))
  const [catalogo, setCatalogo] = useState<string[]>([])
  const [tope, setTope] = useState(344)
  const [bajando, setBajando] = useState(true)
  const [sinSenal, setSinSenal] = useState(false)
  const [verCuenta, setVerCuenta] = useState(false)
  const sesion = useSesion()

  // El finally no es decorativo: si la bajada revienta (sin senal, servidor
  // caido), sin el la pantalla se queda diciendo "Actualizando..." para siempre
  // y el plan que si esta guardado localmente parece que no cargo nunca.
  const recargar = useCallback(async () => {
    setBajando(true)
    try {
      // Las dos bajadas van juntas y no una detras de otra: cada una tiene su
      // propio tope de 8 s, y en serie la espera sin senal se duplicaba.
      const [ok] = await Promise.all([bajarPlan(), bajarSugerencias()])
      setSinSenal(!ok)
    } catch {
      setSinSenal(true)
    } finally {
      setBajando(false)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      await recargar()
      try {
        const [cat, hh] = await Promise.all([bajarCatalogo(), hhPorDia()])
        setCatalogo(cat)
        setTope(hh)
      } catch { /* sin senal: el catalogo queda vacio y el tope en el ultimo conocido */ }
    })()
    window.addEventListener('online', recargar)
    return () => window.removeEventListener('online', recargar)
  }, [recargar])

  useEffect(() => {
    if (!verCuenta) return
    empujarCapa(() => setVerCuenta(false))
  }, [verCuenta])

  const { anio, semana } = semanaISO(lunes)
  const planSemana = useLiveQuery(
    () => db.plan.where({ anio, semana }).toArray(), [anio, semana],
  ) ?? []
  const planTodo = useLiveQuery(() => db.plan.toArray(), []) ?? []
  const pendientes = useLiveQuery(
    () => db.sugerencias.where('estado').equals('pendiente').count(), [],
  ) ?? 0

  const puedeEditar = sesion.esEditor
  const ultima = Number(localStorage.getItem(CLAVE_ULTIMA_BAJADA) ?? 0)

  return (
    <div className="plan">
      <div className="plan-cabecera">
        <div>
          <b>Plan maestro</b>
          <small>
            {puedeEditar
              ? `Editando como ${sesion.correo}`
              : sinSenal
                ? (ultima ? `Sin señal · copia del ${new Date(ultima).toLocaleDateString('es-CL')}` : 'Sin señal')
                : 'Solo lectura'}
          </small>
        </div>
        <button className="btn" onClick={() => setVerCuenta(true)}>
          {sesion.correo ? 'Cuenta' : 'Iniciar sesión'}
        </button>
      </div>

      <div className="plan-chips">
        <button className={'chip' + (pestana === 'semana' ? ' on' : '')} onClick={() => setPestana('semana')}>Semana</button>
        <button className={'chip' + (pestana === 'horizonte' ? ' on' : '')} onClick={() => setPestana('horizonte')}>Horizonte</button>
        <button className={'chip' + (pestana === 'sugerencias' ? ' on' : '')} onClick={() => setPestana('sugerencias')}>
          Sugerencias{pendientes > 0 ? ` (${pendientes})` : ''}
        </button>
      </div>

      {bajando && <p className="plan-sub">Actualizando…</p>}

      {pestana === 'semana' && (
        <VistaSemana
          lunes={lunes} setLunes={setLunes} plan={planSemana} tope={tope}
          puedeEditar={puedeEditar} catalogo={catalogo} recargar={() => void recargar()}
        />
      )}
      {pestana === 'horizonte' && <VistaHorizonte lunes={lunes} plan={planTodo} tope={tope} />}
      {pestana === 'sugerencias' && <VistaSugerencias puedeEditar={puedeEditar} recargar={() => void recargar()} />}

      {verCuenta && <Cuenta onCerrar={() => volver()} />}
    </div>
  )
}

export { SinPermiso, SinSenal }
