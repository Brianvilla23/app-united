// Comentarios de una tarea: una bitácora con quién y cuándo (`sql/26`).
//
// A diferencia de "Seguimiento", que es un solo texto y se pisa, acá cada
// comentario queda. Sirve para cualquier lista, como los adjuntos: el `ambito`
// dice de cuál y el `objetoId` de qué tarea.
import { supabase } from './supabase'

export type AmbitoComentario = 'proyecto'

export interface Comentario {
  id: string
  objetoId: string
  texto: string
  autor: string
  creadoEn: string
}

function aComentario(r: Record<string, unknown>): Comentario {
  return {
    id: String(r.id),
    objetoId: String(r.objeto_id),
    texto: String(r.texto ?? ''),
    autor: (r.autor as string | null) ?? '',
    creadoEn: (r.creado_en as string | null) ?? '',
  }
}

/** Los comentarios de varias tareas de una vez, del más viejo al más nuevo. */
export async function traerComentarios(ambito: AmbitoComentario, ids: string[]): Promise<Comentario[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.from('comentarios')
    .select('*').eq('ambito', ambito).in('objeto_id', ids).order('creado_en')
  if (error) throw new Error(error.message)
  return (data ?? []).map(aComentario)
}

export async function comentar(
  ambito: AmbitoComentario, objetoId: string, texto: string, autor: string, id: string,
): Promise<void> {
  const { error } = await supabase.from('comentarios')
    .insert({ id, ambito, objeto_id: objetoId, texto, autor })
  if (error) throw new Error(error.message)
}

export async function borrarComentario(id: string): Promise<void> {
  const { error } = await supabase.from('comentarios').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** "12-10 14:35", en hora de Chile. */
export function cuandoComentario(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const p = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  return `${v('day')}-${v('month')} ${v('hour')}:${v('minute')}`
}
