// El plan maestro: la planilla "Planificacion" de SharePoint, semana por
// semana (martes a lunes), con sus turnos día y noche y las HH de cada día.
//
// El ida y vuelta con SharePoint es por archivo: se carga el Excel que está
// allá y, cuando se quiere publicar, se baja de nuevo. Conectarlo en línea
// necesitaría que TI registre la app en el tenant de United.
import { useCallback, useEffect, useState } from 'react'
import { quienSoy } from './identidad'
import { uuid } from './util'
import { martesDe, rotuloSemana, sumarDias, diasDeLaSemana, esSemanaDeHoy } from './minuta'
import {
  borrarLinea, guardarLinea, guardarMuchas, hhDe, lineasDe, traerHHDia, traerPlan,
  traerSemanasCargadas, type LineaPlan, type TurnoPlan,
} from './planSemana'
import { bajarPlanExcel, leerPlanDesdeArchivo } from './planExcel'

const hoy = () => new Date().toISOString().slice(0, 10)
const TURNOS: { codigo: TurnoPlan; nombre: string }[] = [
  { codigo: 'dia', nombre: 'Día' },
  { codigo: 'noche', nombre: 'Noche' },
]

export default function PanelPlan() {
  const [inicio, setInicio] = useState(martesDe(hoy()))
  const [plan, setPlan] = useState<LineaPlan[]>([])
  const [hhDia, setHHDia] = useState(344)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [cargando, setCargando] = useState(false)
  const [semanas, setSemanas] = useState<{ inicio: string; lineas: number }[]>([])
  const [nueva, setNueva] = useState<{ fecha: string; turno: TurnoPlan } | null>(null)
  const [texto, setTexto] = useState('')
  const [hh, setHH] = useState('')

  const dias = diasDeLaSemana(inicio)

  const cargar = useCallback(async (desde: string) => {
    try {
      setPlan(await traerPlan(desde, sumarDias(desde, 6)))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar.')
    }
  }, [])

  const cargarSemanas = useCallback(async () => {
    try { setSemanas(await traerSemanasCargadas()) } catch { /* se vive sin la lista */ }
  }, [])

  useEffect(() => { void cargar(inicio) }, [inicio, cargar])
  useEffect(() => { void traerHHDia().then(setHHDia); void cargarSemanas() }, [cargarSemanas])

  const importar = async (archivo: File | undefined) => {
    if (!archivo) return
    setCargando(true); setError(''); setAviso('')
    try {
      const lineas = await leerPlanDesdeArchivo(archivo)
      if (lineas.length === 0) {
        setError('No se encontraron semanas en ese archivo.')
        return
      }
      const n = await guardarMuchas(lineas, quienSoy())
      const cuales = [...new Set(lineas.map((l) => martesDe(l.fecha)))].sort()
      // saltar a la primera semana del archivo: si trae semanas viejas, la de
      // hoy queda vacía y parece que no cargó nada
      const primera = cuales[0]
      setAviso(`Se cargaron ${n} líneas en ${cuales.length} semanas, de la del ${primera} a la del ${cuales[cuales.length - 1]}.`)
      await cargarSemanas()
      if (primera) setInicio(primera)
      else await cargar(inicio)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    } finally {
      setCargando(false)
    }
  }

  const agregar = async () => {
    if (!nueva || !texto.trim()) return
    const hermanas = lineasDe(plan, nueva.fecha, nueva.turno)
    await guardarLinea({
      id: uuid(), fecha: nueva.fecha, turno: nueva.turno, orden: hermanas.length + 1,
      actividad: texto.trim(), hh: hh ? Number(hh) : null, ot: '',
      titulo: plan[0]?.titulo ?? '', observaciones: '',
    }, quienSoy())
    setTexto(''); setHH(''); setNueva(null)
    await cargar(inicio)
    await cargarSemanas()
  }

  const quitar = async (id: string) => {
    await borrarLinea(id)
    await cargar(inicio)
  }

  const exportar = async () => {
    setCargando(true)
    try {
      const todo = await traerPlan(sumarDias(inicio, -364), sumarDias(inicio, 364))
      await bajarPlanExcel(todo.length > 0 ? todo : plan, hhDia)
    } finally {
      setCargando(false)
    }
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

      <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <label className="btn sm ghost">
          {cargando ? 'Trabajando…' : 'Cargar el Excel'}
          <input
            type="file" hidden accept=".xlsx,.xlsm"
            onChange={(e) => void importar(e.target.files?.[0])}
          />
        </label>
        <button className="btn sm ghost" disabled={cargando} onClick={() => void exportar()}>Bajar el Excel</button>
        <span className="hint" style={{ alignSelf: 'center' }}>HH del día: {hhDia}</span>
        <p className="hint" style={{ width: '100%', margin: 0 }}>
          Cargar reemplaza las semanas que traiga el archivo. No hay conexión en vivo
          con SharePoint: el ida y vuelta es bajando y subiendo el Excel.
        </p>
      </div>

      {plan.length === 0 && semanas.length > 0 && (
        <p className="memb-aviso">
          Esta semana no tiene nada cargado. El plan tiene {semanas.length} semanas con
          actividades; la más nueva es la del {semanas[0].inicio}.{' '}
          <button className="btn sm" onClick={() => setInicio(semanas[0].inicio)}>Ir a esa</button>
        </p>
      )}

      {semanas.length > 0 && (
        <label className="lab">
          Semanas cargadas
          <select value={semanas.some((x) => x.inicio === inicio) ? inicio : ''} onChange={(e) => e.target.value && setInicio(e.target.value)}>
            <option value="">Elegir una semana…</option>
            {semanas.map((x) => (
              <option key={x.inicio} value={x.inicio}>{rotuloSemana(x.inicio)} · {x.lineas} líneas</option>
            ))}
          </select>
        </label>
      )}

      <div className="plan-dias">
        {dias.map((dia) => {
          const delDia = plan.filter((l) => l.fecha === dia)
          const usadas = hhDe(delDia)
          return (
            <div key={dia} className="plan-dia">
              <div className="plan-dia-tit">
                <b>{new Date(dia + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: '2-digit' })}</b>
                <small className={usadas > hhDia ? 'pasado' : ''}>{usadas} / {hhDia} HH</small>
              </div>
              {TURNOS.map((t) => (
                <div key={t.codigo} className="plan-turno">
                  <span className="plan-turno-tit">{t.nombre}</span>
                  {lineasDe(plan, dia, t.codigo).map((l) => (
                    <div key={l.id} className="plan-linea">
                      <span>
                        <b>{l.actividad}</b>
                        <small>{l.hh ?? '—'} HH{l.ot ? ` · OT ${l.ot}` : ''}</small>
                      </span>
                      <button className="memb-x" onClick={() => void quitar(l.id)}>✕</button>
                    </div>
                  ))}
                  {nueva && nueva.fecha === dia && nueva.turno === t.codigo ? (
                    <div className="plan-linea nueva">
                      <input
                        autoFocus value={texto} placeholder="Actividad"
                        onChange={(e) => setTexto(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void agregar() }}
                      />
                      <input
                        style={{ width: 64 }} inputMode="numeric" value={hh} placeholder="HH"
                        onChange={(e) => setHH(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void agregar() }}
                      />
                      <button className="btn sm" onClick={() => void agregar()}>OK</button>
                    </div>
                  ) : (
                    <button
                      className="plan-mas"
                      onClick={() => { setNueva({ fecha: dia, turno: t.codigo }); setTexto(''); setHH('') }}
                    >
                      + actividad
                    </button>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
