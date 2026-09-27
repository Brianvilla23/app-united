// Control de ovalamiento de sideport.
//
// Cada vasija tiene su sideport NORTE y su sideport SUR, en cada lado del rack
// (alimentación y descarga). De cada una se anota si está buena, si queda
// pendiente de retiro o si está crítica para cambio, con su foto.
//
// Con eso queda la base de datos: qué sideport hay que cambiar, en qué vasija
// y con la foto que lo respalda.
import { supabase } from './supabase'
import type { LadoRack } from './types'

export type Sideport = 'norte' | 'sur'
export type EstadoSideport = 'ok' | 'pendiente' | 'critica'

/** Las sideport de cada vasija. Si algún día son cuatro, se agregan acá. */
export const SIDEPORTS: { codigo: Sideport; nombre: string }[] = [
  { codigo: 'norte', nombre: 'Norte' },
  { codigo: 'sur', nombre: 'Sur' },
]

// Los códigos que van a la base NO cambian; lo que cambia es cómo se llaman en
// pantalla, que es como lo dice Brayan en terreno.
export const ESTADOS_SIDEPORT: {
  codigo: EstadoSideport; nombre: string; corto: string; color: string
}[] = [
  { codigo: 'ok', nombre: 'Sin problema', corto: '✓', color: '#0e9f6e' },
  { codigo: 'pendiente', nombre: 'Pendiente cambio', corto: '!', color: '#eab308' },
  { codigo: 'critica', nombre: 'Cambio', corto: '✕', color: '#c00000' },
]

export const colorSideport = (e: EstadoSideport) =>
  ESTADOS_SIDEPORT.find((x) => x.codigo === e)?.color ?? '#c3cad3'

export const nombreSideport = (s: Sideport) =>
  SIDEPORTS.find((x) => x.codigo === s)?.nombre ?? s

export interface Ovalamiento {
  id: string
  rack: number
  lado: LadoRack
  vasija: string
  sideport: Sideport
  estado: EstadoSideport
  nota: string
  /** Ruta de la foto dentro del bucket. */
  foto: string | null
}

export const ovalId = (lado: string, rack: number, vasija: string, sideport: string) =>
  `${lado}-${rack}-${vasija}-${sideport}`

export function aOvalamiento(r: Record<string, unknown>): Ovalamiento {
  return {
    id: String(r.id),
    rack: Number(r.rack ?? 0),
    lado: ((r.lado as LadoRack | null) ?? 'alimentacion'),
    vasija: String(r.vasija ?? ''),
    sideport: ((r.sideport as Sideport | null) ?? 'norte'),
    estado: ((r.estado as EstadoSideport | null) ?? 'ok'),
    nota: (r.nota as string | null) ?? '',
    foto: (r.foto as string | null) ?? null,
  }
}

export function filaOvalamiento(o: Ovalamiento, quien: string): Record<string, unknown> {
  return {
    id: o.id, rack: o.rack, lado: o.lado, vasija: o.vasija, sideport: o.sideport,
    estado: o.estado, nota: o.nota, foto: o.foto,
    actualizado_por: quien, actualizado_en: new Date().toISOString(),
  }
}

// ------------------------------------------------------------------- fotos

const BUCKET = 'adjuntos'

/** Sube la foto de una sideport. Devuelve la ruta para guardarla en la fila. */
export async function subirFotoSideport(id: string, archivo: Blob, nombre: string): Promise<string> {
  const limpio = nombre.replace(/[^\w.\-]+/g, '_')
  const ruta = `sideports/${id}/${Date.now()}-${limpio}`
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, archivo, {
    contentType: archivo.type || 'image/jpeg',
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return ruta
}

/** Enlace temporal para verla: el bucket es privado. */
export async function enlaceFoto(ruta: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, 600)
  if (error || !data) throw new Error(error?.message ?? 'No se pudo abrir la foto.')
  return data.signedUrl
}

export async function borrarFotoSideport(ruta: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([ruta])
}

/** El resumen de un lado: cuántas sideport hay de cada estado. */
export function resumirOval(os: Ovalamiento[]): Record<EstadoSideport, number> {
  return {
    ok: os.filter((o) => o.estado === 'ok').length,
    pendiente: os.filter((o) => o.estado === 'pendiente').length,
    critica: os.filter((o) => o.estado === 'critica').length,
  }
}
