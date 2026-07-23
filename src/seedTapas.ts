import { db } from './db'
import { encolar } from './sync'
import type { TapaEstado } from './types'

// Snapshot del turno noche 21/07/2026 · OT 419375139 · Rack 12 (lado alimentación).
const AUTOR = 'Turno noche 21/07'
const FLAG = 'seed_tapas_r12_v3'

function rec(vasija: string, p: Partial<TapaEstado>): TapaEstado {
  return {
    id: `12-${vasija}`, rack: 12, vasija,
    tapaAgripada: false, segurosAgripados: [], pernosRodados: [], marca: '',
    creadoPor: AUTOR, createdAt: Date.now(), sincronizado: false,
    ...p,
  }
}

const AGRIPADAS = ['K10']
const PERNOS = ['J4', 'J9', 'J12', 'J14', 'J16']
const NORMALIZADAS = ['I13', 'I14', 'H13', 'H15', 'G16']
const SIN_PROBLEMA = [
  'K9', 'K11', 'K12', 'J1', 'J2', 'J3', 'J5', 'J6', 'J7', 'J8', 'J10', 'J11', 'J13', 'J15',
  'I15', 'I16', 'H14', 'H16', 'G13', 'G14',
  'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
  'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12',
  'H5', 'H6', 'H7', 'H8', 'H9', 'H10', 'H11', 'H12',
  'I5', 'I6', 'I7', 'I8', 'I9', 'I10', 'I11', 'I12',
]

export async function seedTapasRack12(): Promise<void> {
  if (localStorage.getItem(FLAG)) return
  const n = await db.tapas.where('rack').equals(12).count()
  if (n === 0) {
    const filas: TapaEstado[] = [
      ...AGRIPADAS.map((v) => rec(v, { tapaAgripada: true })),
      ...PERNOS.map((v) => rec(v, { pernosRodados: [0] })),
      ...NORMALIZADAS.map((v) => rec(v, { marca: 'normalizada' })),
      ...SIN_PROBLEMA.map((v) => rec(v, {})),
    ]
    for (const f of filas) {
      await db.tapas.put(f)
      await encolar('tapas_upsert', {
        rack: 12, vasija: f.vasija, tapa_agripada: f.tapaAgripada, seguros_agripados: f.segurosAgripados,
        pernos_rodados: f.pernosRodados, marca: f.marca, ot: '419375139', creado_por: AUTOR,
      })
    }
  }
  localStorage.setItem(FLAG, '1')
}
