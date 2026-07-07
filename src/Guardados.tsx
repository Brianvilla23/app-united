import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { generarPDF } from './pdf'
import { generarPDFAndamio } from './pdfAndamio'
import type { Aviso, Andamio } from './types'

type Item = {
  kind: 'aviso' | 'andamio'
  id: string
  folio: string
  titulo: string
  sub: string
  createdAt: number
  aviso?: Aviso
  andamio?: Andamio
}

export default function Guardados() {
  const avisos = useLiveQuery(() => db.avisos.orderBy('createdAt').reverse().toArray(), [])
  const andamios = useLiveQuery(() => db.andamios.orderBy('createdAt').reverse().toArray(), [])

  if (!avisos || !andamios) return <p className="muted">Cargando…</p>

  const items: Item[] = [
    ...avisos.map((a): Item => ({ kind: 'aviso', id: a.id, folio: a.folio, titulo: a.titulo, sub: `${a.zona} · ${a.fechaTrabajo}`, createdAt: a.createdAt, aviso: a })),
    ...andamios.map((a): Item => ({ kind: 'andamio', id: a.id, folio: a.folio, titulo: a.descripcionUso, sub: `${a.lugar} · ${a.cantidadCuerpos} cuerpos`, createdAt: a.createdAt, andamio: a })),
  ].sort((x, y) => y.createdAt - x.createdAt)

  if (items.length === 0)
    return <div className="empty">Aún no hay registros guardados.<br />Creá el primero desde el menú.</div>

  const pdf = (it: Item) => { if (it.kind === 'aviso' && it.aviso) generarPDF(it.aviso); if (it.kind === 'andamio' && it.andamio) generarPDFAndamio(it.andamio) }
  const borrar = (it: Item) => { if (it.kind === 'aviso') db.avisos.delete(it.id); else db.andamios.delete(it.id) }

  return (
    <div className="list">
      {items.map((it) => (
        <div className="card" key={it.id}>
          <div className="card-top">
            <span className="folio-tag">{it.folio}</span>
            <span className={'pill ' + (it.kind === 'aviso' ? 'k-aviso' : 'k-andamio')}>{it.kind === 'aviso' ? 'Aviso' : 'Andamio'}</span>
          </div>
          <div className="card-title">{it.titulo || '(sin título)'}</div>
          <div className="card-sub">{it.sub}</div>
          <div className="card-actions">
            <button className="btn sm" onClick={() => pdf(it)}>Descargar PDF</button>
            <button className="btn sm ghost" onClick={() => borrar(it)}>Borrar</button>
          </div>
        </div>
      ))}
    </div>
  )
}
