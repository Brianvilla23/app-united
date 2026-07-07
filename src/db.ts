import Dexie, { type Table } from 'dexie'
import type { Aviso, Andamio, MarcaFuga, OutboxItem } from './types'

export class UnitedDB extends Dexie {
  avisos!: Table<Aviso, string>
  andamios!: Table<Andamio, string>
  marcas!: Table<MarcaFuga, string>
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
  }
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
