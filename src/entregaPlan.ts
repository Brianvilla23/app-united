// La entrega de turno del área de PLANIFICACIÓN.
//
// No es la de los supervisores: esta sale de la minuta de la semana y se
// ordena por estado, como la pidió Brayan —
//   · lo que se hizo        → Tareas realizadas
//   · lo que quedó a medias → Actividades en seguimiento
//   · lo que sigue abierto  → Pendientes
// Al guardarla queda una foto de esa semana, porque la minuta sigue viva.
import { supabase } from './supabase'
import { martesDe, sumarDias, traerMinuta, type TareaMinuta } from './minuta'
import { traerObs } from './turnoObs'
import { traerProyectos } from './planDatos'

export interface LineaEntregaPlan {
  titulo: string
  /** El proyecto o el origen, para ubicarla de una. */
  detalle: string
}

export interface EntregaPlan {
  id: string
  /** El martes de la semana de la minuta. */
  inicio: string
  fecha: string
  entrega: { nombre: string; cargo: string }
  recibe: { nombre: string; cargo: string }
  realizadas: LineaEntregaPlan[]
  seguimiento: LineaEntregaPlan[]
  pendientes: LineaEntregaPlan[]
  observaciones: LineaEntregaPlan[]
  creadoPor?: string
}

export const BLOQUES: { clave: keyof Pick<EntregaPlan, 'realizadas' | 'seguimiento' | 'pendientes' | 'observaciones'>; nombre: string; bajada: string }[] = [
  { clave: 'realizadas', nombre: 'Tareas realizadas', bajada: 'Lo que quedó listo esta semana' },
  { clave: 'seguimiento', nombre: 'Actividades en seguimiento', bajada: 'Lo que se empezó y no se terminó' },
  { clave: 'pendientes', nombre: 'Pendientes', bajada: 'Lo que sigue esperando' },
  { clave: 'observaciones', nombre: 'Observaciones', bajada: 'Lo que hay que decir aparte' },
]

function aEntrega(r: Record<string, unknown>): EntregaPlan {
  const lista = (v: unknown): LineaEntregaPlan[] => (Array.isArray(v) ? (v as LineaEntregaPlan[]) : [])
  return {
    id: String(r.id),
    inicio: String(r.inicio),
    fecha: String(r.fecha),
    entrega: { nombre: (r.entrega_nombre as string) ?? '', cargo: (r.entrega_cargo as string) ?? '' },
    recibe: { nombre: (r.recibe_nombre as string) ?? '', cargo: (r.recibe_cargo as string) ?? '' },
    realizadas: lista(r.realizadas),
    seguimiento: lista(r.seguimiento),
    pendientes: lista(r.pendientes),
    observaciones: lista(r.observaciones),
    creadoPor: (r.creado_por as string | null) ?? undefined,
  }
}

/** Arma la entrega de una semana con lo que hay hoy en la minuta. */
export async function armarDesdeLaMinuta(inicio: string): Promise<{
  realizadas: LineaEntregaPlan[]
  seguimiento: LineaEntregaPlan[]
  pendientes: LineaEntregaPlan[]
  observaciones: LineaEntregaPlan[]
}> {
  const [tareas, obs, proyectos] = await Promise.all([
    traerMinuta(inicio),
    traerObs(inicio).catch(() => []),
    traerProyectos().catch(() => []),
  ])
  const nombreProyecto = (id: string | null) => proyectos.find((p) => p.id === id)?.nombre ?? ''

  const linea = (t: TareaMinuta): LineaEntregaPlan => {
    const partes = [nombreProyecto(t.proyectoId)]
    const hijas = tareas.filter((x) => x.padreId === t.id)
    if (hijas.length > 0) partes.push(`${hijas.length} subtareas`)
    if (t.cierre) partes.push(`cierra ${t.cierre}`)
    if (t.nota) partes.push(t.nota)
    return { titulo: t.titulo, detalle: partes.filter(Boolean).join(' · ') }
  }

  const madres = tareas.filter((t) => !t.padreId)
  return {
    realizadas: madres.filter((t) => t.estado === 'lista').map(linea),
    seguimiento: madres.filter((t) => t.estado === 'en_curso').map(linea),
    pendientes: madres.filter((t) => t.estado === 'pendiente').map(linea),
    observaciones: obs.map((o) => ({
      titulo: o.texto,
      detalle: o.cuadro === 'amenaza' ? 'Amenaza' : 'Observación',
    })),
  }
}

export async function traerEntregasPlan(): Promise<EntregaPlan[]> {
  const { data, error } = await supabase.from('entregas_planificacion')
    .select('*').order('inicio', { ascending: false }).order('fecha', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(aEntrega)
}

export async function guardarEntregaPlan(e: EntregaPlan, quien: string): Promise<void> {
  const { error } = await supabase.from('entregas_planificacion').upsert({
    id: e.id, inicio: e.inicio, fecha: e.fecha,
    entrega_nombre: e.entrega.nombre, entrega_cargo: e.entrega.cargo,
    recibe_nombre: e.recibe.nombre, recibe_cargo: e.recibe.cargo,
    realizadas: e.realizadas, seguimiento: e.seguimiento,
    pendientes: e.pendientes, observaciones: e.observaciones,
    creado_por: quien,
  })
  if (error) throw new Error(error.message)
}

export async function borrarEntregaPlan(id: string): Promise<void> {
  const { error } = await supabase.from('entregas_planificacion').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Agrupa por semana, de la más nueva a la más vieja. */
export function porSemana(entregas: EntregaPlan[]): { inicio: string; entregas: EntregaPlan[] }[] {
  const mapa = new Map<string, EntregaPlan[]>()
  for (const e of entregas) mapa.set(e.inicio, [...(mapa.get(e.inicio) ?? []), e])
  return [...mapa.entries()]
    .map(([inicio, suyas]) => ({ inicio, entregas: suyas }))
    .sort((a, b) => (a.inicio < b.inicio ? 1 : -1))
}

export const semanaDeHoy = () => martesDe(new Date().toISOString().slice(0, 10))
export const finDeSemana = (inicio: string) => sumarDias(inicio, 6)
