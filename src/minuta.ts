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
  /** Para cuándo tiene que estar. */
  cierre: string | null
  /** A quién se le pidió o con quién se coordina. */
  correo: string
  /** Con padre = subtarea de esa tarea. */
  padreId: string | null
}

/** Un archivo colgado de una tarea: PDF, foto, lo que sea. */
export interface Adjunto {
  id: string
  tareaId: string
  nombre: string
  ruta: string
  tipo: string
  tamano: number
  subidoPor: string
  subidoEn: string
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
    cierre: (r.cierre as string | null) ?? null,
    correo: (r.correo as string | null) ?? '',
    padreId: (r.padre_id as string | null) ?? null,
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
    cierre: t.cierre, correo: t.correo, padre_id: t.padreId,
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
  const quedaron = previas.filter((t) => t.estado !== 'lista' && !t.padreId)
  const yaEstan = new Set(actuales.map((t) => t.titulo.trim().toLowerCase()))
  const nuevas = quedaron.filter((t) => !yaEstan.has(t.titulo.trim().toLowerCase()))
  let orden = actuales.length
  for (const t of nuevas) {
    orden += 1
    await guardarTarea({
      ...t, id: nuevoId(), inicio, orden, vieneDe: anterior, estado: t.estado,
      padreId: null,   // las subtareas se arrastran con su madre, no sueltas
    }, quien)
  }
  return nuevas.length
}

export function resumir(tareas: TareaMinuta[]): Record<EstadoMinuta, number> {
  const r: Record<EstadoMinuta, number> = { pendiente: 0, en_curso: 0, lista: 0 }
  for (const t of tareas) r[t.estado] += 1
  return r
}

// ---------------------------------------------------------------- adjuntos

const BUCKET = 'adjuntos'

function aAdjunto(r: Record<string, unknown>): Adjunto {
  return {
    id: String(r.id), tareaId: String(r.tarea_id), nombre: String(r.nombre),
    ruta: String(r.ruta), tipo: (r.tipo as string | null) ?? '',
    tamano: Number(r.tamano ?? 0),
    subidoPor: (r.subido_por as string | null) ?? '',
    subidoEn: (r.subido_en as string | null) ?? '',
  }
}

export async function traerAdjuntos(tareaId: string): Promise<Adjunto[]> {
  const { data, error } = await supabase.from('minuta_adjuntos')
    .select('*').eq('tarea_id', tareaId).order('subido_en')
  if (error) throw new Error(error.message)
  return (data ?? []).map(aAdjunto)
}

/** Sube el archivo al bucket privado y lo cuelga de la tarea. */
export async function subirAdjunto(
  tareaId: string, archivo: File, quien: string, nuevoId: () => string,
): Promise<void> {
  const id = nuevoId()
  const limpio = archivo.name.replace(/[^\w.\-]+/g, '_')
  const ruta = `${tareaId}/${id}-${limpio}`
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, archivo, {
    contentType: archivo.type || undefined,
    upsert: false,
  })
  if (error) throw new Error(error.message)
  const { error: e2 } = await supabase.from('minuta_adjuntos').insert({
    id, tarea_id: tareaId, nombre: archivo.name, ruta,
    tipo: archivo.type, tamano: archivo.size, subido_por: quien,
  })
  if (e2) throw new Error(e2.message)
}

/** Enlace temporal para abrirlo: el bucket es privado a propósito. */
export async function enlaceAdjunto(ruta: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, 300)
  if (error || !data) throw new Error(error?.message ?? 'No se pudo abrir el archivo.')
  return data.signedUrl
}

export async function borrarAdjunto(a: Adjunto): Promise<void> {
  await supabase.storage.from(BUCKET).remove([a.ruta])
  const { error } = await supabase.from('minuta_adjuntos').delete().eq('id', a.id)
  if (error) throw new Error(error.message)
}

export function pesoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
