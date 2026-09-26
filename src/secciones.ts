// Las secciones de Planificación: las cinco de siempre y las que se agreguen
// desde la app.
//
// Las de siempre son `tipo: 'fija'` —cada una tiene su pantalla hecha— y solo
// se les puede cambiar el nombre, la bajada y el ícono. Las nuevas guardan lo
// suyo en `plan_seccion_items` y las dibuja una sola pantalla genérica:
//   · 'lista' → cosas por hacer, se marcan como en la minuta
//   · 'tabla' → filas con las columnas que se hayan definido
import { supabase } from './supabase'

export type TipoSeccion = 'fija' | 'lista' | 'tabla'
export type TipoCampo = 'texto' | 'parrafo' | 'numero' | 'fecha' | 'si_no'

export const TIPOS_CAMPO: { codigo: TipoCampo; nombre: string }[] = [
  { codigo: 'texto', nombre: 'Texto corto' },
  { codigo: 'parrafo', nombre: 'Texto largo' },
  { codigo: 'numero', nombre: 'Número' },
  { codigo: 'fecha', nombre: 'Fecha' },
  { codigo: 'si_no', nombre: 'Sí / No' },
]

export const ICONOS = ['📋', '🔧', '🧰', '⚠️', '📦', '🚚', '🧪', '🧯', '📈', '🗂️', '🛠️', '💧']

export interface Campo {
  clave: string
  nombre: string
  tipo: TipoCampo
}

export interface Seccion {
  id: string
  nombre: string
  bajada: string
  icono: string
  tipo: TipoSeccion
  campos: Campo[]
  orden: number
  activa: boolean
}

export interface ItemSeccion {
  id: string
  seccionId: string
  datos: Record<string, string | number | boolean>
  estado: string
  orden: number
}

/** Las de siempre, por si la base no contesta: la app no se queda en blanco. */
export const SECCIONES_BASE: Seccion[] = [
  { id: 'minuta', nombre: 'Minuta de la semana', bajada: 'Lo pendiente, lo que se está haciendo y lo cerrado', icono: '📌', tipo: 'fija', campos: [], orden: 10, activa: true },
  { id: 'plan', nombre: 'Plan maestro', bajada: 'La planilla semanal con sus HH, día y noche', icono: '🗓️', tipo: 'fija', campos: [], orden: 20, activa: true },
  { id: 'proyectos', nombre: 'Proyectos', bajada: 'Actividades y subtareas de cada frente', icono: '🏗️', tipo: 'fija', campos: [], orden: 30, activa: true },
  { id: 'entrega-propia', nombre: 'Nuestra entrega de turno', bajada: 'La del área de planificación: se llena, se baja y se manda', icono: '📝', tipo: 'fija', campos: [], orden: 40, activa: true },
  { id: 'entregas', nombre: 'Entregas de supervisión', bajada: 'Las que mandan los supervisores, para leer y bajar', icono: '📥', tipo: 'fija', campos: [], orden: 50, activa: true },
]

function aSeccion(r: Record<string, unknown>): Seccion {
  return {
    id: String(r.id),
    nombre: String(r.nombre ?? ''),
    bajada: (r.bajada as string | null) ?? '',
    icono: (r.icono as string | null) ?? '📋',
    tipo: ((r.tipo as TipoSeccion | null) ?? 'lista'),
    campos: Array.isArray(r.campos) ? (r.campos as Campo[]) : [],
    orden: Number(r.orden ?? 100),
    activa: r.activa !== false,
  }
}

export async function traerSecciones(): Promise<Seccion[]> {
  const { data, error } = await supabase.from('plan_secciones')
    .select('*').eq('activa', true).order('orden')
  if (error) throw new Error(error.message)
  const secciones = (data ?? []).map(aSeccion)
  return secciones.length > 0 ? secciones : SECCIONES_BASE
}

export async function guardarSeccion(s: Seccion, quien: string): Promise<void> {
  const { error } = await supabase.from('plan_secciones').upsert({
    id: s.id, nombre: s.nombre, bajada: s.bajada, icono: s.icono,
    tipo: s.tipo, campos: s.campos, orden: s.orden, activa: s.activa,
    creado_por: quien,
  })
  if (error) throw new Error(error.message)
}

/** Las fijas no se borran: tienen su pantalla. Las nuevas sí. */
export async function borrarSeccion(id: string): Promise<void> {
  const { error } = await supabase.from('plan_secciones').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Una clave de columna a partir del nombre que escribió el usuario. */
export function claveDe(nombre: string): string {
  const limpio = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return limpio || 'campo'
}

// ------------------------------------------------------------------ items

function aItem(r: Record<string, unknown>): ItemSeccion {
  return {
    id: String(r.id),
    seccionId: String(r.seccion_id),
    datos: (r.datos as Record<string, string | number | boolean>) ?? {},
    estado: String(r.estado ?? 'pendiente'),
    orden: Number(r.orden ?? 0),
  }
}

export async function traerItems(seccionId: string): Promise<ItemSeccion[]> {
  const { data, error } = await supabase.from('plan_seccion_items')
    .select('*').eq('seccion_id', seccionId).order('orden')
  if (error) throw new Error(error.message)
  return (data ?? []).map(aItem)
}

export async function guardarItem(i: ItemSeccion, quien: string): Promise<void> {
  const { error } = await supabase.from('plan_seccion_items').upsert({
    id: i.id, seccion_id: i.seccionId, datos: i.datos,
    estado: i.estado, orden: i.orden, creado_por: quien,
  })
  if (error) throw new Error(error.message)
}

export async function borrarItem(id: string): Promise<void> {
  const { error } = await supabase.from('plan_seccion_items').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
