export type Prioridad = 'Alta' | 'Media' | 'Baja'
export type EstadoAviso = 'borrador' | 'completo'

export interface MaterialItem {
  nombre: string
  codigoSap: string
  cantidad: number
}

export interface Aviso {
  id: string
  folio: string
  titulo: string
  tipo: string
  prioridad: Prioridad
  zona: string
  equipo: string
  descripcion: string
  modoFalla: string
  materiales: MaterialItem[]
  dotacion: number
  horas: number
  detencion: boolean
  fechaTrabajo: string
  hse: string
  fotos: string[]
  correoRespaldo: string
  estado: EstadoAviso
  creadoPor: string
  createdAt: number
  sincronizado: boolean
}

export const ZONAS: string[] = [
  'Planta RO', 'Planta 0', 'Bicapas EWS', 'Bicapa Planta 0', 'Intake', 'Captación',
  'Agua Clarificada', 'Estación de bombeo 1A', 'Estación de bombeo 1B', 'Bombas CAN',
  'Acueducto 24"', 'Barrio Cívico', 'Instalación United', 'TK 900',
  'Patio Reactivo EWS', 'Patio Reactivo Planta 0',
]

export const TIPOS_AVISO: string[] = ['Correctivo', 'Preventivo', 'Inspección', 'Emergencia']
export const PRIORIDADES: Prioridad[] = ['Alta', 'Media', 'Baja']

export interface ModoFalla {
  codigo: string
  nombre: string
  materiales: MaterialItem[]
}

// NOTA: datos de ejemplo. El catálogo real MF1-14 + repuestos se carga
// luego desde el Excel "Buscador Repuestos SAP por Modo de Falla".
export const MODOS_FALLA: ModoFalla[] = [
  { codigo: 'MF1', nombre: 'Fuga por o-ring de tapa', materiales: [
    { nombre: 'O-ring tapa', codigoSap: '11432371', cantidad: 1 },
  ] },
  { codigo: 'MF2', nombre: 'Daño en membrana', materiales: [
    { nombre: 'Membrana RO', codigoSap: '11427300', cantidad: 1 },
  ] },
  { codigo: 'MF3', nombre: 'Incrustación / scale', materiales: [
    { nombre: 'Membrana RO', codigoSap: '11427300', cantidad: 2 },
    { nombre: 'O-ring tapa', codigoSap: '11432371', cantidad: 1 },
    { nombre: 'Kit segmentos de retención', codigoSap: '—', cantidad: 1 },
  ] },
  { codigo: 'MF4', nombre: 'Falla en segmentos de retención', materiales: [
    { nombre: 'Kit segmentos de retención', codigoSap: '—', cantidad: 1 },
  ] },
  { codigo: 'MF5', nombre: 'Otro (cargar desde catálogo real)', materiales: [] },
]

export type TablaOutbox = 'avisos' | 'andamios' | 'marcas_upsert' | 'marcas_delete' | 'tapas_upsert' | 'tapas_delete'

export interface OutboxItem {
  id: string
  tabla: TablaOutbox
  payload: Record<string, unknown>
  createdAt: number
}

export interface MarcaFuga {
  id: string
  rack: number
  vasija: string
  componente: import('./rackLayout').ComponenteFuga
  creadoPor: string
  createdAt: number
  sincronizado: boolean
}

// --- Estado de tapas del rack ---
export type EstadoTapa = 'retirada' | 'pernos_rodados' | 'normalizada' | 'agripada' | 'aislada'

export interface EstadoTapaDef { codigo: EstadoTapa; nombre: string; color: string; texto: string }

// El "rojo" de las fallas es color COBRE (pedido del user).
export const COBRE = '#b5452c'

export const ESTADOS_TAPA: EstadoTapaDef[] = [
  { codigo: 'agripada', nombre: 'Agripada', color: COBRE, texto: '#ffffff' },
  { codigo: 'pernos_rodados', nombre: 'Pernos rodados', color: '#f59e0b', texto: '#4a2c00' },
  { codigo: 'normalizada', nombre: 'Normalizada', color: '#9a9a4e', texto: '#2b2b12' },
  { codigo: 'aislada', nombre: 'Aislada', color: '#d946ef', texto: '#ffffff' },
  { codigo: 'retirada', nombre: 'Retirada', color: '#86efac', texto: '#065f46' },
]

export const PERNOS_POR_TAPA = 3
export const SEGUROS_POR_TAPA = 3

export interface TapaEstado {
  id: string
  rack: number
  vasija: string
  tapaAgripada: boolean
  segurosAgripados: number[]
  pernosRodados: number[]
  marca: '' | 'normalizada' | 'aislada' | 'retirada'
  creadoPor: string
  createdAt: number
  sincronizado: boolean
}

// Color del rack = resumen de los hallazgos de la tapa.
export function estadoTapaDe(t: Pick<TapaEstado, 'tapaAgripada' | 'segurosAgripados' | 'pernosRodados' | 'marca'>): EstadoTapa {
  if (t.marca === 'aislada') return 'aislada'
  if (t.tapaAgripada || t.segurosAgripados.length > 0) return 'agripada'
  if (t.pernosRodados.length > 0) return 'pernos_rodados'
  if (t.marca === 'normalizada') return 'normalizada'
  return 'retirada'
}

export type EstadoTarjeta = 'Verde' | 'Amarilla' | 'Roja'

export interface Andamio {
  id: string
  folio: string
  lugar: string
  equipo: string
  descripcionUso: string
  temporalidad: 'dias' | 'trabajo'
  dias: number
  cantidadCuerpos: number
  fechaConstruccion: string
  estadoTarjeta: EstadoTarjeta
  inspeccionadoPor: string
  proximaInspeccion: string
  fotosAndamio: string[]
  fotosTarjeta: string[]
  subsecuenteGenerado: boolean
  correoRespaldo: string
  creadoPor: string
  createdAt: number
  sincronizado: boolean
}
