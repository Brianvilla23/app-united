// Las observaciones que planificación le deja al turno.
//
// Se escriben en la minuta de la semana y le aparecen al supervisor ya
// cargadas cuando llena su entrega. Cada una dice en qué cuadro del formato
// oficial va —3.2 actividades adicionales o 3.3 amenazas— porque la planilla
// está validada por calidad y no se le inventan secciones nuevas.
//
// ⚠️ Estas observaciones las puede LEER cualquiera: el supervisor no tiene
// cuenta. Acá va solo lo que planificación decide mandarle al turno.
import { supabase } from './supabase'

export type CuadroObs = 'adicional' | 'amenaza'

export const CUADROS: { codigo: CuadroObs; nombre: string; donde: string }[] = [
  { codigo: 'adicional', nombre: 'Actividad', donde: '3.2 Actividades adicionales' },
  { codigo: 'amenaza', nombre: 'Amenaza', donde: '3.3 Amenazas' },
]

export interface ObsTurno {
  id: string
  /** El martes de la semana de la minuta a la que pertenece. */
  inicio: string
  texto: string
  cuadro: CuadroObs
  tareaId: string | null
  creadoPor: string
}

function aObs(r: Record<string, unknown>): ObsTurno {
  return {
    id: String(r.id),
    inicio: String(r.inicio),
    texto: String(r.texto ?? ''),
    cuadro: (r.cuadro as CuadroObs) ?? 'adicional',
    tareaId: (r.tarea_id as string | null) ?? null,
    creadoPor: (r.creado_por as string | null) ?? '',
  }
}

/** Las de una semana, por su martes. */
export async function traerObs(inicio: string): Promise<ObsTurno[]> {
  const { data, error } = await supabase.from('turno_observaciones')
    .select('*').eq('inicio', inicio).order('creado_en')
  if (error) throw new Error(error.message)
  return (data ?? []).map(aObs)
}

/** Las que le tocan a una fecha: la semana de la minuta va de martes a lunes. */
export async function traerObsDeFecha(fecha: string): Promise<ObsTurno[]> {
  const d = new Date(fecha + 'T12:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 5) % 7))
  return traerObs(d.toISOString().slice(0, 10))
}

export async function guardarObs(o: ObsTurno): Promise<void> {
  const { error } = await supabase.from('turno_observaciones').upsert({
    id: o.id, inicio: o.inicio, texto: o.texto, cuadro: o.cuadro,
    tarea_id: o.tareaId, creado_por: o.creadoPor,
  })
  if (error) throw new Error(error.message)
}

export async function borrarObs(id: string): Promise<void> {
  const { error } = await supabase.from('turno_observaciones').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
