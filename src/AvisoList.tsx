import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { generarPDF } from './pdf'

export default function AvisoList() {
  const avisos = useLiveQuery(() => db.avisos.orderBy('createdAt').reverse().toArray(), [])

  if (!avisos) return <p className="muted">Cargando…</p>
  if (avisos.length === 0)
    return <div className="empty">Aún no hay avisos guardados.<br />Creá el primero en la pestaña «Nuevo aviso».</div>

  return (
    <div className="list">
      {avisos.map((a) => (
        <div className="card" key={a.id}>
          <div className="card-top">
            <span className="folio-tag">{a.folio}</span>
            <span className={'pill p-' + a.prioridad.toLowerCase()}>{a.prioridad}</span>
          </div>
          <div className="card-title">{a.titulo}</div>
          <div className="card-sub">{a.zona} · {a.fechaTrabajo}{a.detencion ? ' · con detención' : ''}</div>
          <div className="card-actions">
            <button className="btn sm" onClick={() => generarPDF(a)}>Descargar PDF</button>
            <button className="btn sm ghost" onClick={() => db.avisos.delete(a.id)}>Borrar</button>
          </div>
        </div>
      ))}
    </div>
  )
}
