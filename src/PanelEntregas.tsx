// Las entregas de turno que mandan los SUPERVISORES. Son otra área: la de
// planificación es aparte y la llenan ellos mismos.
// Acá se leen y se bajan: el Excel es el formato oficial de United, rellenado.
import { useEffect, useState } from 'react'
import { nombreTurno, traerEntregas, type Entrega } from './planDatos'
import { bajarCSVEntregas, generarPDFEntrega } from './pdfEntrega'
import { bajarExcelEntrega } from './xlsxEntrega'

export default function PanelEntregas() {
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [error, setError] = useState('')
  const [abierta, setAbierta] = useState<string | null>(null)
  const [errorBajada, setErrorBajada] = useState('')

  /** Si falla la plantilla hay que decirlo: antes el botón no hacía nada. */
  const bajar = async (e: Entrega) => {
    setErrorBajada('')
    try { await bajarExcelEntrega(e) } catch (err) {
      setErrorBajada(err instanceof Error ? err.message : 'No se pudo armar el Excel.')
    }
  }

  useEffect(() => {
    void (async () => {
      try { setEntregas(await traerEntregas(60, 'supervision')) } catch (e) {
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

      {errorBajada && <p className="memb-aviso">{errorBajada}</p>}

      {entregas.length === 0 && (
        <p className="hint">Todavía no llega ninguna de supervisión. Ellos la mandan desde "Entrega de turno" en la portada de la app.</p>
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
                <button className="btn sm" onClick={(ev) => { ev.stopPropagation(); void bajar(e) }}>Excel</button>
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
