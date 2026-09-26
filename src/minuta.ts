// La minuta de la semana: lo pendiente, lo que se está haciendo y lo cerrado.
//
// ⚠️ La semana de planificación **va de martes a lunes**, no es la semana
// corrida. Por eso todo se guarda contra el MARTES de inicio: el número de
// semana se calcula solo para mostrarlo.
import { supabase } from './supabase'
import { semanaDe } from './planDatos'

export type EstadoMinuta = 'pendiente' | 'en_curso' | 'lista'

export const ESTADOS_MINUTA: { codigo: EstadoMinuta; nombre: string; corto: string }[] = [
  { codigo: 'pendiente', nombre: 'Pendiente', corto: '·' },
  { codigo: 'en_curso', nombre: 'En curso', corto: '→' },
  { codigo: 'lista', nombre: 'Lista', corto: '✓' },
]

export interface TareaMinuta {
  id: string
  inicio: string
  titulo: string
  estado: EstadoMinuta
  proyectoId: string | null
  nota: string
  orden: number
  vieneDe: string | null
}

/** El martes de la semana a la que pertenece una fecha (martes → lunes). */
export function martesDe(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00')
  // 0 dom, 1 lun, 2 mar … : cuántos días hay que retroceder hasta el martes
  const atras = (d.getDay() + 5) % 7
  d.setDate(d.getDate() - atras)
  return d.toISOString().slice(0, 10)
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(fecha + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Los 7 días de la semana, de martes a lunes. */
export function diasDeLaSemana(inicio: string): string[] {
  return Array.from({ length: 7 }, (_, i) => sumarDias(inicio, i))
}

/** "Martes 22-09 → lunes 28-09 · W38". El formato va a mano y no con Intl:
    es-CL devuelve "22-9" aunque se le pida mes de dos dígitos. */
function diaMes(fecha: string): string {
  const [, m, d] = fecha.split('-')
  return `${d}-${m}`
}

export function rotuloSemana(inicio: string): string {
  return `Martes ${diaMes(inicio)} → lunes ${diaMes(sumarDias(inicio, 6))} · ${semanaDe(inicio)}`
}

export function esSemanaDeHoy(inicio: string): boolean {
  return inicio === martesDe(new Date().toISOString().slice(0, 10))
}

// ------------------------------------------------------------------- base

function aTarea(r: Record<string, unknown>): TareaMinuta {
  return {
    id: String(r.id),
    inicio: String(r.inicio),
    titulo: String(r.titulo ?? ''),
    estado: (r.estado as EstadoMinuta) ?? 'pendiente',
    proyectoId: (r.proyecto_id as string | null) ?? null,
    nota: (r.nota as string | null) ?? '',
    orden: Number(r.orden ?? 0),
    vieneDe: (r.viene_de as string | null) ?? null,
  }
}

export async function traerMinuta(inicio: string): Promise<TareaMinuta[]> {
  const { data, error } = await supabase.from('minuta_tareas')
    .select('*').eq('inicio', inicio).order('orden')
  if (error) throw new Error(error.message)
  return (data ?? []).map(aTarea)
}

/** Las semanas que ya tienen minuta, de la más nueva a la más vieja. */
export async function traerSemanas(): Promise<string[]> {
  const { data, error } = await supabase.from('minuta_tareas').select('inicio')
  if (error) throw new Error(error.message)
  return [...new Set((data ?? []).map((r) => String(r.inicio)))].sort().reverse()
}

export async function guardarTarea(t: TareaMinuta, quien: string): Promise<void> {
  const { error } = await supabase.from('minuta_tareas').upsert({
    id: t.id, inicio: t.inicio, titulo: t.titulo, estado: t.estado,
    proyecto_id: t.proyectoId, nota: t.nota, orden: t.orden, viene_de: t.vieneDe,
    creado_por: quien, actualizado_en: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

export async function borrarTarea(id: string): Promise<void> {
  const { error } = await supabase.from('minuta_tareas').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Trae a esta semana lo que quedó sin cerrar en la anterior. */
export async function arrastrarPendientes(
  inicio: string, quien: string, nuevoId: () => string,
): Promise<number> {
  const anterior = sumarDias(inicio, -7)
  const [previas, actuales] = await Promise.all([traerMinuta(anterior), traerMinuta(inicio)])
  const quedaron = previas.filter((t) => t.estado !== 'lista')
  const yaEstan = new Set(actuales.map((t) => t.titulo.trim().toLowerCase()))
  const nuevas = quedaron.filter((t) => !yaEstan.has(t.titulo.trim().toLowerCase()))
  let orden = actuales.length
  for (const t of nuevas) {
    orden += 1
    await guardarTarea({
      ...t, id: nuevoId(), inicio, orden, vieneDe: anterior, estado: t.estado,
    }, quien)
  }
  return nuevas.length
}

export function resumir(tareas: TareaMinuta[]): Record<EstadoMinuta, number> {
  const r: Record<EstadoMinuta, number> = { pendiente: 0, en_curso: 0, lista: 0 }
  for (const t of tareas) r[t.estado] += 1
  return r
}
