// Planificación: proyectos, sus actividades y la entrega de turno.
//
// Es la única parte de la app con permisos DE VERDAD. El resto entra sin
// cuenta; acá hace falta correo y clave, y quién puede ver y escribir lo dice
// la tabla `plan_editores` en la base — no una lista en este archivo, que sería
// decoración porque el JavaScript de la app va publicado.
//
// La excepción es la entrega de turno: el supervisor la ESCRIBE sin cuenta,
// desde el celular y aunque esté sin señal (va por la cola de subida). Leerla y
// descargarla es de los editores.
import { supabase } from './supabase'

export type EstadoTarea = 'pendiente' | 'completada'
export type Turno = 'dia' | 'noche'

export const TURNOS: { codigo: Turno; nombre: string }[] = [
  { codigo: 'dia', nombre: 'Día' },
  { codigo: 'noche', nombre: 'Noche' },
]

export interface Proyecto {
  id: string
  nombre: string
  orden: number
  activo: boolean
}

export interface Tarea {
  id: string
  proyectoId: string
  /** null = actividad; con padre = subtarea de esa actividad. */
  padreId: string | null
  titulo: string
  estado: EstadoTarea
  desde: string | null
  hasta: string | null
  seguimiento: string | null
  orden: number
}

/** Las cuatro tablas del formato oficial PYC-EG-MEL-6001-01. */
export interface LineaOT {
  ot: string
  observaciones: string
  estado: string
}

export interface LineaAdicional {
  descripcion: string
  estado: string
}

export interface LineaAmenaza {
  descripcion: string
}

export interface LineaEquipo {
  /** Número interno del equipo en el formato (C-6701, VCLX-73…). */
  interno: string
  estado: string
  observaciones: string
  horometro: string
}

export interface Persona {
  nombre: string
  cargo: string
  run: string
}

export interface Entrega {
  id: string
  fecha: string
  /** La semana que informa el formato ("W35"). Se propone y se puede corregir. */
  semana: string
  turno: Turno
  entrega: Persona
  recibe: Persona
  ots: LineaOT[]
  adicionales: LineaAdicional[]
  amenazas: LineaAmenaza[]
  equipos: LineaEquipo[]
  creadoEn?: string
}

export const PERSONA_VACIA: Persona = { nombre: '', cargo: 'Supervisor de obra', run: '' }

/** La semana que United pone en el formato. En los dos casos que se pudieron
    comparar (01-09-2026 = W35 y la planilla W37 del 14-09) va una atrás de la
    semana ISO, así que se propone esa y el supervisor la corrige si no calza. */
export function semanaDe(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00')
  const jueves = new Date(d)
  jueves.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const enero = new Date(jueves.getFullYear(), 0, 4)
  const iso = 1 + Math.round(((jueves.getTime() - enero.getTime()) / 86400000 - 3 + ((enero.getDay() + 6) % 7)) / 7)
  const n = Math.max(1, iso - 1)
  return 'W' + String(n).padStart(2, '0')
}

// ---------------------------------------------------------------- sesión

/** Supabase contesta en inglés; acá se dice lo que pasó. */
function traducir(mensaje: string): string {
  if (/invalid login credentials/i.test(mensaje)) return 'Correo o clave incorrectos.'
  if (/email not confirmed/i.test(mensaje)) return 'La cuenta todavía no está confirmada.'
  if (/rate limit|too many/i.test(mensaje)) return 'Demasiados intentos. Espera un momento.'
  if (/failed to fetch|network/i.test(mensaje)) return 'Sin conexión: la planificación necesita señal.'
  return mensaje
}

export async function entrar(correo: string, clave: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave })
  if (error) throw new Error(traducir(error.message))
}

export async function salir(): Promise<void> {
  await supabase.auth.signOut()
}

export async function cambiarClave(nueva: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: nueva })
  if (error) throw new Error(traducir(error.message))
}

/** Lo decide la base, no la pantalla. */
export async function soyEditor(): Promise<boolean> {
  const { data, error } = await supabase.rpc('es_editor_plan')
  return !error && data === true
}

// ------------------------------------------------------------- proyectos

export async function traerProyectos(): Promise<Proyecto[]> {
  const { data, error } = await supabase.from('proyectos').select('*').order('orden')
  if (error) throw new Error(traducir(error.message))
  return (data ?? []).map((p) => ({
    id: p.id, nombre: p.nombre, orden: p.orden, activo: p.activo,
  }))
}

export async function guardarProyecto(p: Proyecto, quien: string): Promise<void> {
  const { error } = await supabase.from('proyectos').upsert({
    id: p.id, nombre: p.nombre, orden: p.orden, activo: p.activo, creado_por: quien,
  })
  if (error) throw new Error(traducir(error.message))
}

// ------------------------------------------------- actividades y subtareas

function aTarea(r: Record<string, unknown>): Tarea {
  return {
    id: String(r.id),
    proyectoId: String(r.proyecto_id),
    padreId: (r.padre_id as string | null) ?? null,
    titulo: String(r.titulo),
    estado: (r.estado as EstadoTarea) ?? 'pendiente',
    desde: (r.desde as string | null) ?? null,
    hasta: (r.hasta as string | null) ?? null,
    seguimiento: (r.seguimiento as string | null) ?? null,
    orden: Number(r.orden ?? 0),
  }
}

export async function traerTareas(proyectoId?: string): Promise<Tarea[]> {
  let q = supabase.from('plan_tareas').select('*').order('orden')
  if (proyectoId) q = q.eq('proyecto_id', proyectoId)
  const { data, error } = await q
  if (error) throw new Error(traducir(error.message))
  return (data ?? []).map(aTarea)
}

export async function guardarTarea(t: Tarea, quien: string): Promise<void> {
  const { error } = await supabase.from('plan_tareas').upsert({
    id: t.id,
    proyecto_id: t.proyectoId,
    padre_id: t.padreId,
    titulo: t.titulo,
    estado: t.estado,
    desde: t.desde,
    hasta: t.hasta,
    seguimiento: t.seguimiento,
    orden: t.orden,
    creado_por: quien,
    actualizado_en: new Date().toISOString(),
  })
  if (error) throw new Error(traducir(error.message))
}

export async function borrarTarea(id: string): Promise<void> {
  const { error } = await supabase.from('plan_tareas').delete().eq('id', id)
  if (error) throw new Error(traducir(error.message))
}

/** Una actividad con sus subtareas, en el orden en que se cargaron. */
export interface ActividadConSubtareas {
  actividad: Tarea
  subtareas: Tarea[]
}

export function armarArbol(tareas: Tarea[]): ActividadConSubtareas[] {
  const padres = tareas.filter((t) => !t.padreId).sort((a, b) => a.orden - b.orden)
  return padres.map((actividad) => ({
    actividad,
    subtareas: tareas.filter((t) => t.padreId === actividad.id).sort((a, b) => a.orden - b.orden),
  }))
}

/** Una actividad cuenta como completada cuando lo están ella y sus subtareas. */
export function estaLista(a: ActividadConSubtareas): boolean {
  return a.actividad.estado === 'completada'
    && a.subtareas.every((s) => s.estado === 'completada')
}

// ---------------------------------------------------------- entrega de turno

export function filaEntrega(e: Entrega): Record<string, unknown> {
  return {
    id: e.id, fecha: e.fecha, semana: e.semana, turno: e.turno,
    entrega_nombre: e.entrega.nombre, entrega_cargo: e.entrega.cargo, entrega_run: e.entrega.run,
    recibe_nombre: e.recibe.nombre, recibe_cargo: e.recibe.cargo, recibe_run: e.recibe.run,
    ots: e.ots, adicionales: e.adicionales, amenazas: e.amenazas, equipos: e.equipos,
  }
}

export async function traerEntregas(dias = 60): Promise<Entrega[]> {
  const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10)
  const { data, error } = await supabase.from('entregas_turno')
    .select('*').gte('fecha', desde).order('fecha', { ascending: false }).order('turno')
  if (error) throw new Error(traducir(error.message))
  return (data ?? []).map(aEntrega)
}

export function aEntrega(r: Record<string, unknown>): Entrega {
  const lista = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
  return {
    id: String(r.id),
    fecha: String(r.fecha),
    semana: (r.semana as string | null) ?? '',
    turno: ((r.turno as Turno | null) ?? 'dia'),
    entrega: {
      nombre: (r.entrega_nombre as string | null) ?? '',
      cargo: (r.entrega_cargo as string | null) ?? '',
      run: (r.entrega_run as string | null) ?? '',
    },
    recibe: {
      nombre: (r.recibe_nombre as string | null) ?? '',
      cargo: (r.recibe_cargo as string | null) ?? '',
      run: (r.recibe_run as string | null) ?? '',
    },
    ots: lista<LineaOT>(r.ots),
    adicionales: lista<LineaAdicional>(r.adicionales),
    amenazas: lista<LineaAmenaza>(r.amenazas),
    equipos: lista<LineaEquipo>(r.equipos),
    creadoEn: (r.creado_en as string | null) ?? undefined,
  }
}

export function nombreTurno(t: Turno): string {
  return TURNOS.find((x) => x.codigo === t)?.nombre ?? t
}
