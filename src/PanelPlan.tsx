// El plan maestro: la planilla "Planificacion" de SharePoint, semana por
// semana, con sus turnos día y noche y las HH de cada día.
//
// ⚠️ Acá la semana va de LUNES A DOMINGO y lleva el número de la planilla
// ("Week 46"), no de martes a lunes como la minuta. Son dos calendarios
// distintos a propósito: este es el de United.
//
// El ida y vuelta con SharePoint es por archivo: se carga el Excel que está
// allá y, cuando se quiere publicar, se baja de nuevo. Conectarlo en línea
// necesitaría que TI registre la app en el tenant de United.
import { useCallback, useEffect, useState } from 'react'
import { quienSoy } from './identidad'
import { uuid } from './util'
import { sumarDias, diasDeLaSemana } from './minuta'
import {
  borrarLinea, esSemanaPlanDeHoy, guardarLinea, guardarMuchas, hhDe, lineasDe, lunesDe,
  rotuloSemanaPlan, traerHHDia, traerPlan, traerSemanasCargadas,
  type LineaPlan, type TurnoPlan,
} from './planSemana'
import { bajarPlanExcel, leerLibro, type HojaPlan } from './planExcel'

const hoy = () => new Date().toISOString().slice(0, 10)
const TURNOS: { codigo: TurnoPlan; nombre: string }[] = [
  { codigo: 'dia', nombre: 'Día' },
  { codigo: 'noche', nombre: 'Noche' },
]

export default function PanelPlan() {
  const [inicio, setInicio] = useState(lunesDe(hoy()))
  const [plan, setPlan] = useState<LineaPlan[]>([])
  const [hojas, setHojas] = useState<HojaPlan[]>([])
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

  /** Carga una hoja del libro. Al terminar se para en la semana de hoy si la
      hoja la tiene; si no, en la primera que trajo, para que se vea que cargó. */
  const cargarHoja = async (h: HojaPlan) => {
    setCargando(true); setError('')
    try {
      const n = await guardarMuchas(h.lineas, quienSoy())
      const cuales = [...new Set(h.lineas.map((l) => lunesDe(l.fecha)))].sort()
      const deHoy = lunesDe(hoy())
      const ir = cuales.includes(deHoy) ? deHoy : cuales[0]
      setHojas([])
      setAviso(`Hoja «${h.nombre}»: ${n} líneas en ${cuales.length} semanas, del ${h.desde} al ${h.hasta}.`)
      await cargarSemanas()
      if (ir && ir !== inicio) setInicio(ir)
      else await cargar(inicio)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la hoja.')
    } finally {
      setCargando(false)
    }
  }

  const importar = async (archivo: File | undefined) => {
    if (!archivo) return
    setCargando(true); setError(''); setAviso(''); setHojas([])
    try {
      const encontradas = await leerLibro(archivo)
      if (encontradas.length === 0) {
        setError('No se encontraron semanas en ese archivo.')
        return
      }
      // el libro de United trae la hoja histórica y la viva: hay que elegir,
      // porque cargar la vieja deja la semana de hoy en blanco
      if (encontradas.length === 1) {
        await cargarHoja(encontradas[0])
        return
      }
      setHojas(encontradas)
      setAviso(`El archivo trae ${encontradas.length} hojas con plan. Elige cuál cargar.`)
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
          <b>{rotuloSemanaPlan(inicio)}</b>
          {!esSemanaPlanDeHoy(inicio) && (
            <button className="btn sm ghost" onClick={() => setInicio(lunesDe(hoy()))}>Ir a la de hoy</button>
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
            // se limpia el campo para poder volver a elegir el MISMO archivo
            onChange={(e) => { const a = e.target.files?.[0]; e.target.value = ''; void importar(a) }}
          />
        </label>
        <button className="btn sm ghost" disabled={cargando} onClick={() => void exportar()}>Bajar el Excel</button>
        <span className="hint" style={{ alignSelf: 'center' }}>HH del día: {hhDia}</span>
        <p className="hint" style={{ width: '100%', margin: 0 }}>
          Cargar reemplaza las semanas que traiga el archivo. No hay conexión en vivo
          con SharePoint: el ida y vuelta es bajando y subiendo el Excel.
        </p>
      </div>

      {hojas.length > 0 && (
        <div className="lista">
          {hojas.map((h) => (
            <div key={h.nombre} className="fila-entrega">
              <div>
                <b>{h.nombre}{h.vigente ? ' · tiene la semana de hoy' : ''}</b>
                <small>{h.lineas.length} líneas · del {h.desde} al {h.hasta}</small>
              </div>
              <button className="btn sm" disabled={cargando} onClick={() => void cargarHoja(h)}>Cargar</button>
            </div>
          ))}
        </div>
      )}

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
              <option key={x.inicio} value={x.inicio}>{rotuloSemanaPlan(x.inicio)} · {x.lineas} líneas</option>
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
