import { db } from './db'
import { encolar } from './sync'
import type { EstadoTapa } from './types'

// Snapshot del turno noche 21/07/2026 · OT 419375139 · Rack 12 (lado alimentación).
// Se carga una sola vez por dispositivo; luego se edita desde la app y sincroniza.
const R12: Record<EstadoTapa, string[]> = {
  agripada: ['K10'],
  pernos_rodados: ['J4', 'J9', 'J12', 'J14', 'J16'],
  normalizada: ['I13', 'I14', 'H13', 'H15', 'G16'],
  sin_problema: [
    'K9', 'K11', 'K12', 'J1', 'J2', 'J3', 'J5', 'J6', 'J7', 'J8', 'J10', 'J11', 'J13', 'J15',
    'I15', 'I16', 'H14', 'H16', 'G13', 'G14',
    'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
    'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12',
    'H5', 'H6', 'H7', 'H8', 'H9', 'H10', 'H11', 'H12',
    'I5', 'I6', 'I7', 'I8', 'I9', 'I10', 'I11', 'I12',
  ],
  aislada: [],
}

const FLAG = 'seed_tapas_r12_v1'
const AUTOR = 'Turno noche 21/07'

export async function seedTapasRack12(): Promise<void> {
  if (localStorage.getItem(FLAG)) return
  const existentes = await db.tapas.where('rack').equals(12).count()
  if (existentes === 0) {
    const now = Date.now()
    for (const [estado, vasijas] of Object.entries(R12) as [EstadoTapa, string[]][]) {
      for (const vasija of vasijas) {
        const id = `12-${vasija}`
        await db.tapas.put({ id, rack: 12, vasija, estado, creadoPor: AUTOR, createdAt: now, sincronizado: false })
        await encolar('tapas_upsert', { rack: 12, vasija, estado, ot: '419375139', creado_por: AUTOR })
      }
    }
  }
  localStorage.setItem(FLAG, '1')
}
