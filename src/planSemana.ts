// El plan maestro: la planilla "Planificacion" que vive en SharePoint.
//
// En el Excel son bloques semanales: una fila de título, una de fechas (7 días,
// uno cada 3 columnas), una con las HH libres del día, y después las
// actividades separadas en turno Día y turno Noche, con su HH al lado y la OT
// dos columnas a la derecha. Acá cada actividad es una fila con fecha y turno.
//
// No hay conexión automática con SharePoint —eso necesitaría que TI registre la
// app en el tenant de United— así que el ida y vuelta es por archivo: se carga
// el Excel y se vuelve a bajar.
import { supabase } from './supabase'

export type TurnoPlan = 'dia' | 'noche'

export interface LineaPlan {
  id: string
  fecha: string
  turno: TurnoPlan
  orden: number
  actividad: string
  hh: number | null
  ot: string
  titulo: string
  observaciones: string
}

/** Columnas del Excel: el día d empieza en D (4) y cada día ocupa 3 columnas. */
export const COL_ACTIVIDAD = (d: number) => 4 + d * 3
export const COL_HH = (d: number) => 5 + d * 3
export const COL_OT = (d: number) => 6 + d * 3
export const DIAS_SEMANA = 7

export const HH_DIA_POR_DEFECTO = 344

export function lunesDe(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00')
  const dif = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dif)
  return d.toISOString().slice(0, 10)
}

export function diasDeLaSemana(lunes: string): string[] {
  return Array.from({ length: DIAS_SEMANA }, (_, i) => {
    const d = new Date(lunes + 'T12:00:00')
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

export function nombreDia(fecha: string): string {
  return new Date(fecha + 'T12:00:00')
    .toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit', month: '2-digit' })
}

// ------------------------------------------------------------------- base

function aLinea(r: Record<string, unknown>): LineaPlan {
  return {
    id: String(r.id),
    fecha: String(r.fecha),
    turno: (r.turno as TurnoPlan) ?? 'dia',
    orden: Number(r.orden ?? 0),
    actividad: String(r.actividad ?? ''),
    hh: r.hh === null || r.hh === undefined ? null : Number(r.hh),
    ot: (r.ot as string | null) ?? '',
    titulo: (r.titulo as string | null) ?? '',
    observaciones: (r.observaciones as string | null) ?? '',
  }
}

export async function traerPlan(desde: string, hasta: string): Promise<LineaPlan[]> {
  const { data, error } = await supabase.from('plan_semana')
    .select('*').gte('fecha', desde).lte('fecha', hasta)
    .order('fecha').order('turno').order('orden')
  if (error) throw new Error(error.message)
  return (data ?? []).map(aLinea)
}

/** Las semanas que tienen algo cargado, de la más nueva a la más vieja. */
export async function traerSemanas(): Promise<{ lunes: string; lineas: number }[]> {
  const { data, error } = await supabase.from('plan_semana').select('fecha')
  if (error) throw new Error(error.message)
  const cuenta = new Map<string, number>()
  for (const r of data ?? []) {
    const l = lunesDe(String(r.fecha))
    cuenta.set(l, (cuenta.get(l) ?? 0) + 1)
  }
  return [...cuenta.entries()]
    .map(([lunes, lineas]) => ({ lunes, lineas }))
    .sort((a, b) => (a.lunes < b.lunes ? 1 : -1))
}

export async function guardarLinea(l: LineaPlan, quien: string): Promise<void> {
  const { error } = await supabase.from('plan_semana').upsert({
    id: l.id, fecha: l.fecha, turno: l.turno, orden: l.orden,
    actividad: l.actividad, hh: l.hh, ot: l.ot, titulo: l.titulo,
    observaciones: l.observaciones, creado_por: quien,
    actualizado_en: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

export async function borrarLinea(id: string): Promise<void> {
  const { error } = await supabase.from('plan_semana').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Carga masiva desde el Excel. Las semanas que trae el archivo se reemplazan
    enteras: si no, lo que se borró en la planilla quedaría de fantasma acá. */
export async function guardarMuchas(lineas: LineaPlan[], quien: string): Promise<number> {
  const fechas = lineas.map((l) => l.fecha).sort()
  if (fechas.length > 0) {
    const { error } = await supabase.from('plan_semana').delete()
      .gte('fecha', fechas[0]).lte('fecha', fechas[fechas.length - 1])
    if (error) throw new Error(error.message)
  }
  const filas = lineas.map((l) => ({
    id: l.id, fecha: l.fecha, turno: l.turno, orden: l.orden,
    actividad: l.actividad, hh: l.hh, ot: l.ot, titulo: l.titulo,
    observaciones: l.observaciones, creado_por: quien,
    actualizado_en: new Date().toISOString(),
  }))
  // de a 500: una carga completa son miles de líneas
  for (let i = 0; i < filas.length; i += 500) {
    const { error } = await supabase.from('plan_semana').upsert(filas.slice(i, i + 500))
    if (error) throw new Error(error.message)
  }
  return filas.length
}

export async function traerHHDia(): Promise<number> {
  const { data } = await supabase.from('plan_config').select('valor').eq('clave', 'hh_dia').maybeSingle()
  const n = Number(data?.valor)
  return Number.isFinite(n) && n > 0 ? n : HH_DIA_POR_DEFECTO
}

export async function guardarHHDia(valor: number, ): Promise<void> {
  await supabase.from('plan_config').upsert({ clave: 'hh_dia', valor: String(valor) })
}

// ------------------------------------------------------------- resúmenes

export function hhDe(lineas: LineaPlan[]): number {
  return lineas.reduce((n, l) => n + (l.hh ?? 0), 0)
}

export function lineasDe(plan: LineaPlan[], fecha: string, turno: TurnoPlan): LineaPlan[] {
  return plan.filter((l) => l.fecha === fecha && l.turno === turno).sort((a, b) => a.orden - b.orden)
}
