// Las amenazas que reportan los supervisores, para monitorearlas desde la
// minuta de planificación.
//
// La amenaza vive en la entrega del supervisor y no se toca: ese documento ya
// se firmó. Acá se junta cada amenaza de la semana con el seguimiento que le
// hace planificación —en qué va y cómo se soluciona— usando un id estable
// (<id de la entrega>-<fila>), así que basta un upsert.
import { supabase } from './supabase'
import { sumarDias } from './minuta'
import { traerEntregasEntre } from './planDatos'

export type EstadoAmenaza = 'monitorear' | 'en_curso' | 'resuelta'

export const ESTADOS_AMENAZA: { codigo: EstadoAmenaza; nombre: string; corto: string }[] = [
  { codigo: 'monitorear', nombre: 'Por monitorear', corto: '!' },
  { codigo: 'en_curso', nombre: 'En curso', corto: '•' },
  { codigo: 'resuelta', nombre: 'Resuelta', corto: '✓' },
]

export interface Amenaza {
  id: string
  entregaId: string
  indice: number
  descripcion: string
  inicio: string
  estado: EstadoAmenaza
  solucion: string
  responsable: string
  /** De qué entrega vino, para ubicarla: "26-09 · Juan Molina". */
  origen: string
}

export function siguienteEstadoAmenaza(e: EstadoAmenaza): EstadoAmenaza {
  return e === 'monitorear' ? 'en_curso' : e === 'en_curso' ? 'resuelta' : 'monitorear'
}

/** Las amenazas de la semana: las que reportaron los supervisores, ya cruzadas
    con el seguimiento que tengan. Las que todavía no tienen seguimiento salen
    igual, en "por monitorear". */
export async function traerAmenazas(inicio: string): Promise<Amenaza[]> {
  const entregas = await traerEntregasEntre(inicio, sumarDias(inicio, 6), 'supervision')
  const dela: Amenaza[] = []
  for (const e of entregas) {
    e.amenazas.forEach((a, i) => {
      if (!a.descripcion?.trim()) return
      dela.push({
        id: `${e.id}-${i}`,
        entregaId: e.id,
        indice: i,
        descripcion: a.descripcion.trim(),
        inicio,
        estado: 'monitorear',
        solucion: '',
        responsable: '',
        origen: `${e.fecha} · ${e.entrega.nombre}`,
      })
    })
  }
  if (dela.length === 0) return []

  const { data, error } = await supabase.from('amenazas_seguimiento')
    .select('*').in('id', dela.map((a) => a.id))
  if (error) throw new Error(error.message)
  const seguimiento = new Map((data ?? []).map((r) => [String(r.id), r]))

  return dela.map((a) => {
    const s = seguimiento.get(a.id)
    if (!s) return a
    return {
      ...a,
      estado: ((s.estado as EstadoAmenaza | null) ?? 'monitorear'),
      solucion: (s.solucion as string | null) ?? '',
      responsable: (s.responsable as string | null) ?? '',
    }
  })
}

/** Guarda SOLO lo que cambió.
    ⚠️ Antes mandaba la fila entera y dos cambios seguidos se pisaban: al salir
    del texto de la solución y del responsable casi juntos, el segundo guardaba
    la copia vieja y borraba la solución. Mandando nada más el campo tocado, el
    `on conflict` deja los otros como estaban. */
export async function guardarAmenaza(
  a: Amenaza,
  cambio: Partial<Pick<Amenaza, 'estado' | 'solucion' | 'responsable'>>,
  quien: string,
): Promise<void> {
  const { error } = await supabase.from('amenazas_seguimiento').upsert({
    id: a.id, entrega_id: a.entregaId, indice: a.indice,
    descripcion: a.descripcion, inicio: a.inicio,
    ...cambio,
    actualizado_por: quien, actualizado_en: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

export function resumirAmenazas(as: Amenaza[]): Record<EstadoAmenaza, number> {
  return {
    monitorear: as.filter((a) => a.estado === 'monitorear').length,
    en_curso: as.filter((a) => a.estado === 'en_curso').length,
    resuelta: as.filter((a) => a.estado === 'resuelta').length,
  }
}
