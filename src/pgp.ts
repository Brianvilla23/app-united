// PGP de supervisión: los cuatro registros diarios del turno, con foto.
//
// Cada registro (charla, fatiga, equipos, CIS) tiene sus 7 días —martes a
// lunes, la misma semana de la minuta— y a cada día se le cargan una o varias
// imágenes. El día con algo cargado se pinta verde.
//
// Funciona sin señal, como el resto de terreno: la foto se reduce y queda
// primero en el celular (base `united_pgp`); `subirPendientes` la sube al
// bucket privado (`pgp/…`) y deja su fila en `pgp_imagenes` (`sql/27`) en
// cuanto hay señal. Lo que cargaron otros se baja por semana, solo la fila;
// la imagen se pide con enlace firmado recién cuando se mira o se imprime.
import Dexie, { type Table } from 'dexie'
import { supabase } from './supabase'
import { uuid } from './util'
import { sumarDias } from './minuta'

export type RegistroPgp = 'charla' | 'fatiga' | 'equipos' | 'cis'

export const REGISTROS_PGP: { codigo: RegistroPgp; nombre: string; bajada: string; icono: string }[] = [
  { codigo: 'charla', nombre: 'Charla de inicio de turno', bajada: 'La charla firmada del día', icono: '🗣️' },
  { codigo: 'fatiga', nombre: 'Check list de fatiga y somnolencia', bajada: 'Uno por turno', icono: '😴' },
  { codigo: 'equipos', nombre: 'Check list de equipo y vehículo', bajada: 'Equipos y camionetas del turno', icono: '🚙' },
  { codigo: 'cis', nombre: 'Cartilla CIS', bajada: 'Cartilla del día', icono: '🦺' },
]

export const nombreRegistro = (r: RegistroPgp) =>
  REGISTROS_PGP.find((x) => x.codigo === r)?.nombre ?? r

export interface ImagenPgp {
  id: string
  registro: RegistroPgp
  /** AAAA-MM-DD: el día del turno al que pertenece, no el de la carga */
  dia: string
  /** JPEG reducido como data URL; vacío si la cargó otro y todavía no se pidió */
  imagen: string
  ancho: number
  alto: number
  subidoPor: string
  createdAt: number
  /** dónde queda en el bucket */
  ruta: string
  /** 0 = solo en este celular, esperando señal · 1 = ya está en la base */
  subido: 0 | 1
}

class BasePgp extends Dexie {
  imagenes!: Table<ImagenPgp, string>
  constructor() {
    super('united_pgp')
    this.version(1).stores({ imagenes: 'id, [registro+dia], registro, dia, subido' })
  }
}

export const dbPgp = new BasePgp()
const BUCKET = 'adjuntos'

/** Reduce la foto a 1600 px por lado: se lee bien una planilla escrita a mano
    y pesa ~250 KB en vez de los 4 MB que saca el teléfono. */
function aJpeg(archivo: File, max = 1600, calidad = 0.75): Promise<{ url: string; ancho: number; alto: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const src = URL.createObjectURL(archivo)
    img.onload = () => {
      let { width: w, height: h } = img
      const f = Math.min(1, max / Math.max(w, h))
      w = Math.round(w * f); h = Math.round(h * f)
      const lienzo = document.createElement('canvas')
      lienzo.width = w; lienzo.height = h
      const ctx = lienzo.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(src)
      resolve({ url: lienzo.toDataURL('image/jpeg', calidad), ancho: w, alto: h })
    }
    img.onerror = () => { URL.revokeObjectURL(src); reject(new Error(`No se pudo leer ${archivo.name}`)) }
    img.src = src
  })
}

export async function cargarImagenes(
  registro: RegistroPgp, dia: string, archivos: File[], quien: string,
): Promise<number> {
  let n = 0
  for (const a of archivos) {
    if (!a.type.startsWith('image/')) continue
    const { url, ancho, alto } = await aJpeg(a)
    const id = uuid()
    await dbPgp.imagenes.put({
      id, registro, dia, imagen: url, ancho, alto, subidoPor: quien, createdAt: Date.now(),
      ruta: `pgp/${registro}/${dia}/${id}.jpg`, subido: 0,
    })
    n++
  }
  void subirPendientes()
  return n
}

// ------------------------------------------------------------------ subir

let subiendo = false

/** Sube lo que quedó en el celular. Es idempotente: si la foto o la fila ya
    estaban arriba (un intento anterior se cortó a medias), cuenta como subida. */
export async function subirPendientes(): Promise<void> {
  if (subiendo || !navigator.onLine) return
  subiendo = true
  try {
    const pendientes = await dbPgp.imagenes.where('subido').equals(0).sortBy('createdAt')
    for (const p of pendientes) {
      const blob = await (await fetch(p.imagen)).blob()
      const { error: e1 } = await supabase.storage.from(BUCKET)
        .upload(p.ruta, blob, { contentType: 'image/jpeg', upsert: false })
      if (e1 && !/exist|duplicate/i.test(e1.message)) break
      const { error: e2 } = await supabase.from('pgp_imagenes').insert({
        id: p.id, registro: p.registro, dia: p.dia, ruta: p.ruta,
        ancho: p.ancho, alto: p.alto, subido_por: p.subidoPor,
      })
      if (e2 && e2.code !== '23505') break
      await dbPgp.imagenes.update(p.id, { subido: 1 })
    }
  } catch { /* sin señal a medio camino: el próximo ciclo sigue */ } finally {
    subiendo = false
  }
}

/** Arranca una sola vez con la app: sube al volver la señal y cada minuto,
    aunque nadie esté mirando la pantalla del PGP. */
let iniciado = false
export function iniciarPgp(): void {
  if (iniciado) return
  iniciado = true
  void Dexie.delete('united_pgp_prueba').catch(() => {}) // la base de la prueba del 08-10
  void subirPendientes()
  window.addEventListener('online', () => { void subirPendientes() })
  setInterval(() => { void subirPendientes() }, 60_000)
}

// ------------------------------------------------------------------ bajar

/** Trae lo que cargó toda la supervisión en esa semana. Respeta lo que este
    celular todavía no sube, y saca lo que otro borró. */
export async function bajarSemana(inicio: string): Promise<void> {
  const fin = sumarDias(inicio, 6)
  const { data, error } = await supabase.from('pgp_imagenes')
    .select('*').gte('dia', inicio).lte('dia', fin).order('creado_en')
  if (error) throw new Error(error.message)
  const remotas = new Map((data ?? []).map((r) => [String(r.id), r]))
  await dbPgp.transaction('rw', dbPgp.imagenes, async () => {
    const locales = await dbPgp.imagenes.where('dia').between(inicio, fin, true, true).toArray()
    for (const l of locales) if (l.subido === 1 && !remotas.has(l.id)) await dbPgp.imagenes.delete(l.id)
    const yaEstan = new Set(locales.map((l) => l.id))
    for (const [id, r] of remotas) {
      if (yaEstan.has(id)) continue
      await dbPgp.imagenes.put({
        id, registro: r.registro as RegistroPgp, dia: String(r.dia), imagen: '',
        ancho: Number(r.ancho ?? 1200), alto: Number(r.alto ?? 1600),
        subidoPor: (r.subido_por as string | null) ?? '',
        createdAt: Date.parse(String(r.creado_en)) || Date.now(),
        ruta: String(r.ruta), subido: 1,
      })
    }
  })
}

// ------------------------------------------------------------------ mirar

const enlaces = new Map<string, { url: string; vence: number }>()

/** La imagen para mostrarla: la del celular si está, o un enlace firmado. */
export async function urlImagen(i: ImagenPgp): Promise<string> {
  if (i.imagen) return i.imagen
  const c = enlaces.get(i.ruta)
  if (c && c.vence > Date.now()) return c.url
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(i.ruta, 600)
  if (error || !data) throw new Error(error?.message ?? 'No se pudo abrir la imagen.')
  enlaces.set(i.ruta, { url: data.signedUrl, vence: Date.now() + 540_000 })
  return data.signedUrl
}

/** Para el PDF hacen falta los bytes: se bajan las que faltan y quedan
    guardadas en el celular para la próxima. */
export async function conDatos(imgs: ImagenPgp[]): Promise<ImagenPgp[]> {
  const out: ImagenPgp[] = []
  for (const i of imgs) {
    if (i.imagen) { out.push(i); continue }
    const blob = await (await fetch(await urlImagen(i))).blob()
    const imagen = await new Promise<string>((res, rej) => {
      const r = new FileReader()
      r.onload = () => res(String(r.result))
      r.onerror = () => rej(new Error('No se pudo leer la imagen.'))
      r.readAsDataURL(blob)
    })
    await dbPgp.imagenes.update(i.id, { imagen })
    out.push({ ...i, imagen })
  }
  return out
}

export async function imagenesDe(registro: RegistroPgp, dias: string[]): Promise<ImagenPgp[]> {
  const todas = await dbPgp.imagenes.where('registro').equals(registro).toArray()
  return todas
    .filter((i) => dias.includes(i.dia))
    .sort((a, b) => a.dia.localeCompare(b.dia) || a.createdAt - b.createdAt)
}

// ------------------------------------------------------------------ borrar

/** Lo que no ha subido se borra del celular y listo. Lo que ya está en la base
    lo decide la base: sin cuenta, solo dentro de las 24 h de cargado. */
export async function borrarImagen(i: ImagenPgp): Promise<void> {
  if (i.subido === 1) {
    if (!navigator.onLine) throw new Error('Para borrar una foto que ya subió hace falta señal.')
    const { data, error } = await supabase.from('pgp_imagenes').delete().eq('id', i.id).select('id')
    if (error) throw new Error(error.message)
    if (!data?.length) {
      throw new Error('Esta foto se cargó hace más de 24 horas: solo planificación la puede borrar.')
    }
    await supabase.storage.from(BUCKET).remove([i.ruta])
  }
  await dbPgp.imagenes.delete(i.id)
}
