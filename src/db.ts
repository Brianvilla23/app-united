import Dexie, { type Table } from 'dexie'
import type { Aviso, Andamio, MarcaFuga, TapaEstado, OutboxItem, HistorialItem, ItemAvance, EntregaLocal } from './types'

export class UnitedDB extends Dexie {
  avisos!: Table<Aviso, string>
  andamios!: Table<Andamio, string>
  marcas!: Table<MarcaFuga, string>
  tapas!: Table<TapaEstado, string>
  historial!: Table<HistorialItem, string>
  items!: Table<ItemAvance, string>
  entregas!: Table<EntregaLocal, string>
  outbox!: Table<OutboxItem, string>

  constructor() {
    super('united_app')
    this.version(1).stores({
      avisos: 'id, folio, createdAt, estado, sincronizado',
    })
    this.version(2).stores({
      avisos: 'id, folio, createdAt, estado, sincronizado',
      andamios: 'id, folio, createdAt, sincronizado',
    })
    this.version(3).stores({
      avisos: 'id, folio, createdAt, estado, sincronizado',
      andamios: 'id, folio, createdAt, sincronizado',
      marcas: 'id, vasija, componente, createdAt, [vasija+componente]',
    })
    this.version(4).stores({
      avisos: 'id, folio, createdAt, estado, sincronizado',
      andamios: 'id, folio, createdAt, sincronizado',
      marcas: 'id, vasija, componente, createdAt, [vasija+componente]',
      outbox: 'id, createdAt, tabla',
    })
    this.version(5).stores({
      avisos: 'id, folio, createdAt, estado, sincronizado',
      andamios: 'id, folio, createdAt, sincronizado',
      marcas: 'id, rack, vasija, componente, createdAt, [rack+vasija+componente]',
      outbox: 'id, createdAt, tabla',
    }).upgrade(async (tx) => { await tx.table('marcas').clear() })
    this.version(6).stores({
      avisos: 'id, folio, createdAt, estado, sincronizado',
      andamios: 'id, folio, createdAt, sincronizado',
      marcas: 'id, rack, vasija, componente, createdAt, [rack+vasija+componente]',
      tapas: 'id, rack, vasija, estado, [rack+vasija]',
      outbox: 'id, createdAt, tabla',
    })
    this.version(7).stores({
      avisos: 'id, folio, createdAt, estado, sincronizado',
      andamios: 'id, folio, createdAt, sincronizado',
      marcas: 'id, rack, vasija, componente, createdAt, [rack+vasija+componente]',
      tapas: 'id, rack, vasija, [rack+vasija]',
      outbox: 'id, createdAt, tabla',
    }).upgrade(async (tx) => { await tx.table('tapas').clear() })
    this.version(8).stores({
      avisos: 'id, folio, createdAt, estado, sincronizado',
      andamios: 'id, folio, createdAt, sincronizado',
      marcas: 'id, rack, vasija, componente, createdAt, [rack+vasija+componente]',
      tapas: 'id, rack, vasija, [rack+vasija]',
      outbox: 'id, createdAt, tabla',
    }).upgrade(async (tx) => { await tx.table('tapas').clear() })
    this.version(9).stores({
      avisos: 'id, folio, createdAt, estado, sincronizado',
      andamios: 'id, folio, createdAt, sincronizado',
      marcas: 'id, rack, vasija, componente, createdAt, [rack+vasija+componente]',
      tapas: 'id, rack, vasija, [rack+vasija]',
      outbox: 'id, createdAt, tabla',
    }).upgrade(async (tx) => { await tx.table('tapas').clear() })
    this.version(10).stores({
      avisos: 'id, folio, createdAt, estado, sincronizado',
      andamios: 'id, folio, createdAt, sincronizado',
      marcas: 'id, rack, vasija, componente, createdAt, [rack+vasija+componente]',
      tapas: 'id, rack, vasija, [rack+vasija]',
      historial: 'id, rack, vasija, createdAt, tipo',
      outbox: 'id, createdAt, tabla',
    })
    // v11: la tapa pasa a tener lado (alimentación/descarga) y estado "aislada".
    // OJO: esta migración NO borra nada — reescribe los registros existentes
    // como lado 'alimentacion', que es lo que se venía registrando hasta ahora.
    this.version(11).stores({
      avisos: 'id, folio, createdAt, estado, sincronizado',
      andamios: 'id, folio, createdAt, sincronizado',
      marcas: 'id, rack, vasija, componente, createdAt, [rack+vasija+componente]',
      tapas: 'id, lado, rack, vasija, [lado+rack+vasija]',
      historial: 'id, rack, vasija, createdAt, tipo',
      outbox: 'id, createdAt, tabla',
    }).upgrade(async (tx) => {
      const tabla = tx.table('tapas')
      const viejas = await tabla.toArray()
      if (viejas.length === 0) return
      await tabla.clear()
      await tabla.bulkAdd(viejas.map((t: Record<string, unknown>) => ({
        ...t,
        id: `alimentacion-${t.rack}-${t.vasija}`,
        lado: 'alimentacion',
        aislada: false,
      })))
    })
    // v13: tabla genérica para las actividades del outage que no son tapas
    // (venteos, manifold, pasos simples). Solo agrega, no toca lo existente.
    this.version(13).stores({
      avisos: 'id, folio, createdAt, estado, sincronizado',
      andamios: 'id, folio, createdAt, sincronizado',
      marcas: 'id, rack, vasija, componente, createdAt, [rack+vasija+componente]',
      tapas: 'id, lado, rack, vasija, [lado+rack+vasija]',
      historial: 'id, rack, vasija, createdAt, tipo',
      items: 'id, actividad, lado, item, [actividad+lado]',
      outbox: 'id, createdAt, tabla',
    })
    // v14: el avance del outage deja de ser "del Rack 12" y pasa a tener rack.
    // NO borra nada: lo que había era todo del 12, salvo las fugas de manifold
    // y el comentario, que traían el rack metido dentro del ítem porque no
    // existía dónde ponerlo. La misma mudanza va en `sql/07`.
    this.version(14).stores({
      avisos: 'id, folio, createdAt, estado, sincronizado',
      andamios: 'id, folio, createdAt, sincronizado',
      marcas: 'id, rack, vasija, componente, createdAt, [rack+vasija+componente]',
      tapas: 'id, lado, rack, vasija, [lado+rack+vasija]',
      historial: 'id, rack, vasija, createdAt, tipo',
      items: 'id, actividad, lado, rack, item, [actividad+rack]',
      outbox: 'id, createdAt, tabla',
    }).upgrade(async (tx) => {
      const tabla = tx.table('items')
      const viejos = await tabla.toArray()
      if (viejos.length === 0) return
      await tabla.clear()
      await tabla.bulkPut(viejos.map((i: Record<string, unknown>) => {
        const { rack, item } = sacarRackDelItem(String(i.actividad), String(i.item))
        return { ...i, rack, item, id: `${i.actividad}-${i.lado}-${rack}-${item}` }
      }))
    })
    // v15: la marca de fuga pasa a tener lado. La base ya lo tenía desde la
    // migración 2 (`marcas_fuga.lado`), pero la app solo marcaba alimentación,
    // así que lo local no lo guardaba. Lo que había es de alimentación.
    this.version(15).stores({
      avisos: 'id, folio, createdAt, estado, sincronizado',
      andamios: 'id, folio, createdAt, sincronizado',
      marcas: 'id, lado, rack, vasija, componente, createdAt, [lado+rack+vasija]',
      tapas: 'id, lado, rack, vasija, [lado+rack+vasija]',
      historial: 'id, rack, vasija, createdAt, tipo',
      items: 'id, actividad, lado, rack, item, [actividad+rack]',
      outbox: 'id, createdAt, tabla',
    }).upgrade(async (tx) => {
      const tabla = tx.table('marcas')
      const viejas = await tabla.toArray()
      if (viejas.length === 0) return
      await tabla.clear()
      await tabla.bulkPut(viejas.map((m: Record<string, unknown>) => ({
        ...m,
        lado: m.lado ?? 'alimentacion',
        id: marcaId(String(m.lado ?? 'alimentacion'), Number(m.rack), String(m.vasija), String(m.componente)),
      })))
    })
    // v16: la entrega de turno que manda el supervisor queda también acá, para
    // que pueda releer lo que entregó desde este celular (en la base solo la
    // leen los dos editores de planificación).
    this.version(16).stores({
      avisos: 'id, folio, createdAt, estado, sincronizado',
      andamios: 'id, folio, createdAt, sincronizado',
      marcas: 'id, lado, rack, vasija, componente, createdAt, [lado+rack+vasija]',
      tapas: 'id, lado, rack, vasija, [lado+rack+vasija]',
      historial: 'id, rack, vasija, createdAt, tipo',
      items: 'id, actividad, lado, rack, item, [actividad+rack]',
      entregas: 'id, fecha, turno, createdAt',
      outbox: 'id, createdAt, tabla',
    })
  }
}

/** Igual que en la base: la marca de fuga es de un lado del rack. */
export function marcaId(lado: string, rack: number, vasija: string, componente: string): string {
  return `${lado}-${rack}-${vasija}-${componente}`
}

/** Antes de que `items` tuviera rack, dos actividades lo metían dentro del
    ítem: la fuga de manifold como "7-DE1" y el comentario como "12". */
export function sacarRackDelItem(actividad: string, item: string): { rack: number; item: string } {
  if (actividad === 'fuga_manifold' && /^\d+-/.test(item)) {
    const corte = item.indexOf('-')
    return { rack: Number(item.slice(0, corte)), item: item.slice(corte + 1) }
  }
  if (actividad === 'comentario_rack' && /^\d+$/.test(item)) {
    return { rack: Number(item), item: 'comentario' }
  }
  return { rack: 12, item }
}

export const db = new UnitedDB()

export async function generarFolio(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await db.avisos.count()
  return `AV-${year}-${String(count + 1).padStart(4, '0')}`
}

export async function generarFolioAndamio(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await db.andamios.count()
  return `AND-${year}-${String(count + 1).padStart(4, '0')}`
}
