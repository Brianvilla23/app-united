// La planilla madre de planificación.
//
// Viene de `Semana de planificacion.xlsx`, que estaba armada por bloques: un
// bloque por semana, siete días en columnas de a tres, turno día arriba y turno
// noche debajo de una fila que dice NOCHE. Acá cada línea de esa planilla es un
// registro con su fecha real, y la semana se calcula: así el mismo dato sirve
// para ver una semana, un trimestre o el año, sin copiar bloques.

export type TurnoPlan = 'Dia' | 'Noche'
export const TURNOS: TurnoPlan[] = ['Dia', 'Noche']

export type EstadoPlan = 'planificada' | 'en_curso' | 'hecha' | 'postergada' | 'cancelada'

export const NOMBRE_ESTADO: Record<EstadoPlan, string> = {
  planificada: 'Planificada',
  en_curso: 'En curso',
  hecha: 'Hecha',
  postergada: 'Postergada',
  cancelada: 'Cancelada',
}

export const COLOR_ESTADO: Record<EstadoPlan, string> = {
  planificada: '#64748b',
  en_curso: '#2563eb',
  hecha: '#16a34a',
  postergada: '#d97706',
  cancelada: '#b91c1c',
}

export interface ActividadPlan {
  id: string
  fecha: string          // AAAA-MM-DD
  anio: number
  semana: number
  turno: TurnoPlan
  actividad: string
  hh: number | null
  estado: EstadoPlan
  zona: string
  ot: string
  nota: string
  orden: number
  creadoPor: string
  actualizadoPor: string
  actualizadoEn: number
}

export type TipoSugerencia = 'agregar' | 'cambiar' | 'quitar' | 'comentario'

export const NOMBRE_TIPO_SUG: Record<TipoSugerencia, string> = {
  agregar: 'Agregar algo',
  cambiar: 'Cambiar algo',
  quitar: 'Sacar algo',
  comentario: 'Comentario',
}

export type EstadoSugerencia = 'pendiente' | 'aceptada' | 'rechazada'

export interface SugerenciaPlan {
  id: string
  fecha: string | null
  anio: number | null
  semana: number | null
  actividadId: string | null
  tipo: TipoSugerencia
  texto: string
  autor: string
  estado: EstadoSugerencia
  respuesta: string
  resueltoPor: string
  createdAt: number
}

// ------------------------------------------------------------- fechas y semanas

const DIA_MS = 86_400_000

export function aFecha(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

export function aISO(f: Date): string {
  const mm = String(f.getMonth() + 1).padStart(2, '0')
  const dd = String(f.getDate()).padStart(2, '0')
  return `${f.getFullYear()}-${mm}-${dd}`
}

/** El lunes de la semana de esa fecha. La planilla siempre parte en lunes. */
export function lunesDe(f: Date): Date {
  const d = new Date(f.getFullYear(), f.getMonth(), f.getDate())
  const dow = (d.getDay() + 6) % 7 // lunes = 0
  d.setDate(d.getDate() - dow)
  return d
}

export function sumarDias(f: Date, n: number): Date {
  return new Date(f.getTime() + n * DIA_MS)
}

/** Semana y año ISO, el mismo número que usa la planilla ("Week 34"). */
export function semanaISO(f: Date): { anio: number; semana: number } {
  const d = new Date(Date.UTC(f.getFullYear(), f.getMonth(), f.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)) // al jueves de esa semana
  const anio = d.getUTCFullYear()
  const enero1 = new Date(Date.UTC(anio, 0, 1))
  const semana = Math.ceil(((d.getTime() - enero1.getTime()) / DIA_MS + 1) / 7)
  return { anio, semana }
}

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const DIAS_CORTO = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function diaYMes(iso: string): string {
  const f = aFecha(iso)
  return `${f.getDate()} ${MESES[f.getMonth()]}`
}

/** "17 – 23 ago 2026", para el encabezado de la semana. */
export function rangoSemana(lunes: Date): string {
  const dom = sumarDias(lunes, 6)
  const mismoMes = lunes.getMonth() === dom.getMonth()
  const ini = mismoMes ? `${lunes.getDate()}` : `${lunes.getDate()} ${MESES[lunes.getMonth()]}`
  return `${ini} – ${dom.getDate()} ${MESES[dom.getMonth()]} ${dom.getFullYear()}`
}

export function fechasDeSemana(lunes: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => aISO(sumarDias(lunes, i)))
}
