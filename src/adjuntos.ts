// Los archivos que se cuelgan de una actividad: PDF, fotos, lo que sea.
//
// Sirven para cualquier cosa, no solo para la minuta: el `ambito` dice de qué
// lista viene ('minuta', 'seccion'…) y el `objetoId` de cuál actividad.
//
// El bucket es PRIVADO a propósito y los archivos se abren con un enlace
// firmado que dura 5 minutos: nadie llega a ellos con la URL suelta.
import { supabase } from './supabase'

export type AmbitoAdjunto = 'minuta' | 'seccion' | 'proyecto'

export interface Adjunto {
  id: string
  ambito: AmbitoAdjunto
  objetoId: string
  nombre: string
  ruta: string
  tipo: string
  tamano: number
  subidoPor: string
  subidoEn: string
}

const BUCKET = 'adjuntos'

function aAdjunto(r: Record<string, unknown>): Adjunto {
  return {
    id: String(r.id),
    ambito: ((r.ambito as AmbitoAdjunto | null) ?? 'minuta'),
    objetoId: String(r.objeto_id),
    nombre: String(r.nombre),
    ruta: String(r.ruta),
    tipo: (r.tipo as string | null) ?? '',
    tamano: Number(r.tamano ?? 0),
    subidoPor: (r.subido_por as string | null) ?? '',
    subidoEn: (r.subido_en as string | null) ?? '',
  }
}

export async function traerAdjuntos(ambito: AmbitoAdjunto, objetoId: string): Promise<Adjunto[]> {
  const { data, error } = await supabase.from('adjuntos')
    .select('*').eq('ambito', ambito).eq('objeto_id', objetoId).order('subido_en')
  if (error) throw new Error(error.message)
  return (data ?? []).map(aAdjunto)
}

/** Sube el archivo al bucket privado y lo cuelga de la actividad. */
export async function subirAdjunto(
  ambito: AmbitoAdjunto, objetoId: string, archivo: File, quien: string, nuevoId: () => string,
): Promise<void> {
  const id = nuevoId()
  const limpio = archivo.name.replace(/[^\w.\-]+/g, '_')
  const ruta = `${ambito}/${objetoId}/${id}-${limpio}`
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, archivo, {
    contentType: archivo.type || undefined,
    upsert: false,
  })
  if (error) throw new Error(error.message)
  const { error: e2 } = await supabase.from('adjuntos').insert({
    id, ambito, objeto_id: objetoId, nombre: archivo.name, ruta,
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
  const { error } = await supabase.from('adjuntos').delete().eq('id', a.id)
  if (error) throw new Error(error.message)
}

export function pesoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
