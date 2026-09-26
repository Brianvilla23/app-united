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

// ------------------------------------------------------- la semana del plan
// ⚠️ Ojo: la MINUTA va de martes a lunes, como trabaja Brayan. El PLAN MAESTRO
// no: la planilla de United arma sus bloques de LUNES A DOMINGO y los numera
// con la semana ISO ("Week 46" = la que empieza el lunes 09-11-2026). Se
// respeta el número de la planilla para poder hablar el mismo idioma en las
// reuniones.

/** El lunes de la semana en que cae esa fecha. */
export function lunesDe(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

/** El número de semana ISO, el mismo que usa la planilla. */
export function semanaISO(fecha: string): number {
  // todo al mediodía: así el cambio de hora no corre la cuenta un día
  const lunes = new Date(lunesDe(fecha) + 'T12:00:00')
  const anio = new Date(lunes.getTime() + 3 * 86400000).getFullYear()   // manda el jueves
  const cuatro = new Date(anio, 0, 4, 12)
  const lunesUno = new Date(cuatro)
  lunesUno.setDate(cuatro.getDate() - ((cuatro.getDay() + 6) % 7))
  return Math.round((lunes.getTime() - lunesUno.getTime()) / (7 * 86400000)) + 1
}

/** "21-09". A mano, porque el formato corto del navegador da "21/9". */
const diaMes = (f: string) => `${f.slice(8, 10)}-${f.slice(5, 7)}`

/** "Week 46 · lunes 09-11 → domingo 15-11", igual que la planilla. */
export function rotuloSemanaPlan(inicio: string): string {
  const fin = new Date(inicio + 'T12:00:00')
  fin.setDate(fin.getDate() + 6)
  return `Week ${semanaISO(inicio)} · lunes ${diaMes(inicio)} → domingo ${diaMes(fin.toISOString().slice(0, 10))}`
}

export function esSemanaPlanDeHoy(inicio: string): boolean {
  return inicio === lunesDe(new Date().toISOString().slice(0, 10))
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

/** Las semanas que tienen algo cargado (por su lunes), de la más nueva a la
    más vieja. Sirve para saltar a una semana con datos: después de cargar un
    archivo viejo, la semana de hoy puede estar vacía y parece que no cargó. */
export async function traerSemanasCargadas(): Promise<{ inicio: string; lineas: number }[]> {
  const cuenta = new Map<string, number>()
  // ⚠️ Supabase entrega 1.000 filas por consulta y el plan tiene miles: hay que
  // pedirlas por tandas o se pierden semanas enteras de la lista.
  for (let p = 0; p < 50; p++) {
    const { data, error } = await supabase.from('plan_semana')
      .select('fecha').order('fecha').order('id')
      .range(p * 1000, p * 1000 + 999)
    if (error) throw new Error(error.message)
    for (const r of data ?? []) {
      const clave = lunesDe(String(r.fecha))
      cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1)
    }
    if (!data || data.length < 1000) break
  }
  return [...cuenta.entries()]
    .map(([inicio, lineas]) => ({ inicio, lineas }))
    .sort((a, b) => (a.inicio < b.inicio ? 1 : -1))
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
