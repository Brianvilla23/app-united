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

export type TablaOutbox =
  | 'avisos' | 'andamios' | 'marcas_upsert' | 'marcas_delete'
  | 'tapas_upsert' | 'tapas_delete' | 'historial' | 'item_upsert'

// Avance de las actividades que no usan el plano de tapas (venteos, manifold,
// pasos simples). Un registro por ítem marcado.
export interface ItemAvance {
  id: string          // `${actividad}-${lado}-${item}`
  actividad: string
  lado: LadoRack
  item: string        // id del venteo / manifold / vasija
  hecho: boolean
  datos: Record<string, unknown>
  creadoPor: string
  createdAt: number
  sincronizado: boolean
}

export function itemId(actividad: string, lado: LadoRack, item: string): string {
  return `${actividad}-${lado}-${item}`
}

/** `datos` de un manifold: qué piezas suyas ya están puestas.
    Stub end y tubing van por vasija, el manifold es la barra completa.
    Va como `type` y no como `interface` para que entre en el `datos:
    Record<string, unknown>` de ItemAvance. */
export type DatosManifold = {
  stubend?: string[]
  brazo?: string[]
  tubing?: string[]
  manifold?: boolean
}

// Registro de quién tocó qué y cuándo (trazabilidad del rack compartido).
export interface HistorialItem {
  id: string
  tipo: 'tapa' | 'fuga'
  lado: LadoRack
  rack: number
  vasija: string
  accion: string
  detalle: string
  quien: string
  createdAt: number
}

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

// Cada vasija tiene una tapa en cada extremo: son piezas distintas y se
// registran por separado. El plano de descarga es el espejo del de alimentación.
export type LadoRack = 'alimentacion' | 'descarga'

export const LADOS: { codigo: LadoRack; nombre: string; corto: string }[] = [
  { codigo: 'alimentacion', nombre: 'Lado alimentación', corto: 'Alimentación' },
  { codigo: 'descarga', nombre: 'Lado descarga', corto: 'Descarga' },
]

// El rack de tapas es siempre el 12 (es el único en intervención).
export const RACK_TAPAS = 12

export type EstadoTapa = 'aislada' | 'agripada' | 'seguros' | 'pernos' | 'pendiente' | 'retirada'

export interface EstadoTapaDef {
  codigo: EstadoTapa
  nombre: string
  color: string
  texto: string
  descripcion: string
}

export const AMBAR = '#d97706'

// Un color por tipo de falla. El orden del array ES el orden de prioridad:
// si una tapa tiene varias fallas a la vez, manda la primera de la lista
// (la más grave). El detalle completo se ve al abrir la tapa.
export const ESTADOS_TAPA: EstadoTapaDef[] = [
  { codigo: 'aislada',  nombre: 'Aislada',          color: '#2563eb', texto: '#ffffff', descripcion: 'Vasija fuera de servicio' },
  { codigo: 'agripada', nombre: 'Tapa agripada',    color: '#dc2626', texto: '#ffffff', descripcion: 'La tapa completa no sale' },
  { codigo: 'seguros',  nombre: 'Seguros triples',  color: '#facc15', texto: '#422006', descripcion: 'Uno o más seguros agripados' },
  { codigo: 'pernos',   nombre: 'Pernos rodados',   color: '#f59e0b', texto: '#ffffff', descripcion: 'Uno o más pernos parker rodados' },
  { codigo: 'pendiente', nombre: 'Pendiente retiro', color: '#7c3aed', texto: '#ffffff', descripcion: 'Seguros y pernos fuera, la tapa sigue adentro' },
  { codigo: 'retirada', nombre: 'Retirada',         color: '#22c55e', texto: '#052e16', descripcion: 'Tapa extraída sin problema' },
]

export const PERNOS_POR_TAPA = 3
export const SEGUROS_POR_TAPA = 3

export interface TapaEstado {
  id: string
  /** Retiro e instalación son actividades distintas sobre la misma vasija:
      cada una lleva su propio registro. */
  actividad: string
  lado: LadoRack
  rack: number
  vasija: string
  tapaAgripada: boolean
  segurosAgripados: number[]
  pernosRodados: number[]
  aislada: boolean
  /** Se sacaron los seguros triples y los pernos parker, pero la tapa sigue
      adentro: queda pendiente de retiro. */
  pendienteRetiro?: boolean
  /** Solo en la instalación de alimentación: tapón al centro del orificio. */
  tapon?: boolean
  /** Solo en la instalación: graduación del shim, en milímetros. */
  shimMm?: number | null
  creadoPor: string
  createdAt: number
  sincronizado: boolean
}

/** La instalación de tapas pide tapón central y shim; el retiro no. */
export function esInstalacion(actividad: string): boolean {
  return actividad.startsWith('instalacion_tapas')
}

/** En el retiro NO va la vasija aislada (ya no aplica) y sí va el pendiente
    de retiro; en la instalación es al revés. */
export function esRetiroTapas(actividad: string): boolean {
  return actividad.startsWith('retiro_tapas')
}

export function tapaId(actividad: string, lado: LadoRack, rack: number, vasija: string): string {
  return `${actividad}-${lado}-${rack}-${vasija}`
}

export type FallaTapa = Pick<
  TapaEstado, 'tapaAgripada' | 'segurosAgripados' | 'pernosRodados' | 'aislada' | 'pendienteRetiro'
>

/** Estado que manda para el color, según la prioridad de ESTADOS_TAPA.
    "Pendiente" va antes de "retirada" porque la tapa todavía está adentro,
    pero después de las fallas, que son lo grave. */
export function estadoTapaDe(t: FallaTapa): EstadoTapa {
  if (t.aislada) return 'aislada'
  if (t.tapaAgripada) return 'agripada'
  if (t.segurosAgripados.length > 0) return 'seguros'
  if (t.pernosRodados.length > 0) return 'pernos'
  if (t.pendienteRetiro) return 'pendiente'
  return 'retirada'
}

export function defEstadoTapa(codigo: EstadoTapa): EstadoTapaDef {
  return ESTADOS_TAPA.find((e) => e.codigo === codigo)!
}

/** Una tapa cuenta como extraída solo si salió limpia (sin falla y sin aislar). */
export function estaExtraida(t: FallaTapa): boolean {
  return estadoTapaDe(t) === 'retirada'
}

export interface ResumenTapas {
  total: number
  registradas: number
  porEstado: Record<EstadoTapa, number>
  extraidas: number
  porcentaje: number
}

/** Avance = extraídas sobre el total de vasijas del rack (no sobre las registradas). */
export function resumirTapas(tapas: FallaTapa[], totalVasijas: number): ResumenTapas {
  // sale de ESTADOS_TAPA y no de una lista escrita a mano: al agregar un estado
  // nuevo, el que faltara en el objeto quedaba en NaN en la leyenda
  const porEstado = Object.fromEntries(ESTADOS_TAPA.map((e) => [e.codigo, 0])) as Record<EstadoTapa, number>

  for (const t of tapas) porEstado[estadoTapaDe(t)]++
  const extraidas = porEstado.retirada
  return {
    total: totalVasijas,
    registradas: tapas.length,
    porEstado,
    extraidas,
    porcentaje: totalVasijas > 0 ? Math.round((extraidas / totalVasijas) * 1000) / 10 : 0,
  }
}

// Solo verde y roja: la amarilla se sacó el 11-08-2026 por decisión de Brayan.
// 'Amarilla' se conserva en el tipo porque puede haber actas viejas guardadas
// con ese valor y no hay que romperlas al mostrarlas.
export type EstadoTarjeta = 'Verde' | 'Roja' | 'Amarilla'
export const ESTADOS_TARJETA: EstadoTarjeta[] = ['Verde', 'Roja']

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
