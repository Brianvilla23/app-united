// Check list y documentos del contrato CC6001: el catálogo que Axel publica en
// registros-cc6001.pages.dev, copiado a la base por la función
// `sincronizar-documentos` (sql/31). Solo lo leen supervisión y planificación.
//
// Sin señal:
//  · el catálogo queda guardado en el celular (localStorage) cada vez que se
//    trae, así la lista se ve aunque no haya conexión;
//  · cada PDF que se abre queda guardado (Cache Storage) con su versión, y se
//    pueden guardar todos de una vez antes de bajar a planta.
import { supabase } from './supabase'
import { BASE, cargarScript } from './cargarScript'

export interface Documento {
  id: string
  categoria: string
  categoria_nombre: string
  categoria_orden: number
  codigo: string
  nombre: string
  ruta: string
  kb: number
  version: string
  actualizado: string
}

const BUCKET = 'adjuntos'
const CLAVE_CATALOGO = 'united_documentos'
const CACHE = 'united-documentos'

export function catalogoGuardado(): Documento[] {
  try { return JSON.parse(localStorage.getItem(CLAVE_CATALOGO) ?? '[]') as Documento[] } catch { return [] }
}

/** Trae el catálogo de la base y lo deja guardado. Sin señal devuelve el
    último guardado (y `enLinea: false`). */
export async function traerCatalogo(): Promise<{ docs: Documento[]; enLinea: boolean }> {
  const { data, error } = await supabase.from('documentos')
    .select('id, categoria, categoria_nombre, categoria_orden, codigo, nombre, ruta, kb, version, actualizado')
    .order('categoria_orden').order('nombre')
    // sin señal supabase-js reintenta varias veces antes de rendirse: con el
    // límite la pantalla pasa a "sin señal" en segundos y no queda esperando
    .abortSignal(AbortSignal.timeout(8000))
  if (error || !data) return { docs: catalogoGuardado(), enLinea: false }
  // una respuesta vacía con un catálogo guardado es más probable que sea un
  // problema de sesión que un catálogo borrado: no se pisa lo guardado
  if (data.length === 0 && catalogoGuardado().length) return { docs: catalogoGuardado(), enLinea: false }
  try { localStorage.setItem(CLAVE_CATALOGO, JSON.stringify(data)) } catch { /* sin espacio: igual se muestra */ }
  return { docs: data as Documento[], enLinea: true }
}

export interface Categoria { id: string; nombre: string; cuantos: number }

export function categoriasDe(docs: Documento[]): Categoria[] {
  const m = new Map<string, Categoria & { orden: number }>()
  for (const d of docs) {
    const c = m.get(d.categoria) ?? { id: d.categoria, nombre: d.categoria_nombre, cuantos: 0, orden: d.categoria_orden }
    c.cuantos++
    m.set(d.categoria, c)
  }
  return [...m.values()].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))
}

const sinTildes = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Busca por código o nombre, sin importar tildes ni mayúsculas, y con todas
    las palabras (como el buscador del sitio de Axel). */
export function buscar(docs: Documento[], texto: string, categoria: string | null): Documento[] {
  const palabras = sinTildes(texto).split(/\s+/).filter(Boolean)
  return docs.filter((d) => {
    if (categoria && d.categoria !== categoria) return false
    const donde = sinTildes(`${d.codigo} ${d.nombre}`)
    return palabras.every((p) => donde.includes(p))
  })
}

// --- el PDF, guardado en el celular ---

const claveCache = (d: Documento) => `${BASE}__documentos/${d.id}?v=${encodeURIComponent(d.version)}`

/** Los ids de los documentos que ya están guardados en ESTA versión. */
export async function guardadosEnCelular(docs: Documento[]): Promise<Set<string>> {
  if (!('caches' in window)) return new Set()
  const c = await caches.open(CACHE)
  const claves = new Set((await c.keys()).map((r) => r.url))
  return new Set(docs.filter((d) => claves.has(new URL(claveCache(d), location.href).href)).map((d) => d.id))
}

/** Los bytes del PDF: del celular si ya está, si no de la base (y queda
    guardado, borrando versiones viejas del mismo documento). */
export async function pdfDe(d: Documento): Promise<ArrayBuffer> {
  const c = 'caches' in window ? await caches.open(CACHE) : null
  const ya = await c?.match(claveCache(d))
  if (ya) return await ya.arrayBuffer()
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(d.ruta, 600)
  if (error || !data) throw new Error('Sin señal y este documento todavía no está guardado en el celular.')
  const r = await fetch(data.signedUrl)
  if (!r.ok) throw new Error('No se pudo bajar el documento.')
  const bytes = await r.arrayBuffer()
  if (c) {
    for (const viejo of await c.keys()) {
      if (new URL(viejo.url).pathname.endsWith(`/__documentos/${d.id}`)) await c.delete(viejo)
    }
    await c.put(claveCache(d), new Response(bytes.slice(0), { headers: { 'content-type': 'application/pdf' } }))
  }
  return bytes
}

/** Guarda en el celular todos los que falten. Devuelve cuántos no se pudieron. */
export async function guardarTodos(
  docs: Documento[], avance: (hechos: number, total: number) => void,
): Promise<number> {
  const ya = await guardadosEnCelular(docs)
  const faltan = docs.filter((d) => !ya.has(d.id))
  let hechos = 0, fallas = 0
  avance(0, faltan.length)
  for (const d of faltan) {
    try { await pdfDe(d) } catch { fallas++ }
    avance(++hechos, faltan.length)
  }
  return fallas
}

/** Planificación: trae ahora lo nuevo del sitio de Axel (sin esperar la
    corrida diaria de la madrugada). */
export async function sincronizarAhora(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('sincronizar-documentos', { body: {} })
  if (error) {
    const cuerpo = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(cuerpo?.error ?? error.message)
  }
  const r = data as { total: number; nuevos: number; actualizados: number; borrados: number; pendientes: number; fallas: string[] }
  const partes = [`${r.total} documentos`]
  if (r.nuevos) partes.push(`${r.nuevos} nuevos`)
  if (r.actualizados) partes.push(`${r.actualizados} actualizados`)
  if (r.borrados) partes.push(`${r.borrados} quitados`)
  if (r.pendientes) partes.push(`${r.pendientes} quedan para la próxima vuelta`)
  if (r.fallas?.length) partes.push(`${r.fallas.length} con problemas`)
  return partes.join(' · ')
}

// --- visor: PDF.js, el mismo que usa el sitio de Axel ---

interface PdfPagina {
  getViewport: (o: { scale: number }) => { width: number; height: number }
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown; intent?: string }) => { promise: Promise<void> }
}
export interface PdfDoc { numPages: number; getPage: (n: number) => Promise<PdfPagina>; destroy: () => Promise<void> }
interface PdfJs {
  GlobalWorkerOptions: { workerSrc: string }
  getDocument: (o: { data: Uint8Array }) => { promise: Promise<PdfDoc> }
}
declare global { interface Window { pdfjsLib?: PdfJs } }

async function cargarPdfjs(): Promise<PdfJs> {
  if (!window.pdfjsLib) await cargarScript(`${BASE}vendor/pdf.min.js`)
  if (!window.pdfjsLib) throw new Error('No se pudo cargar el visor de PDF.')
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${BASE}vendor/pdf.worker.min.js`
  return window.pdfjsLib
}

export async function abrirPdf(bytes: ArrayBuffer): Promise<PdfDoc> {
  const pdfjs = await cargarPdfjs()
  // copia: PDF.js se queda con el buffer y el mismo se usa para imprimir
  return await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise
}

/** Dibuja una página en un canvas a `ancho` px de CSS. */
export async function dibujarPagina(doc: PdfDoc, n: number, ancho: number, densidad: number): Promise<HTMLCanvasElement> {
  const pagina = await doc.getPage(n)
  const base = pagina.getViewport({ scale: 1 })
  const escala = ancho / base.width
  const vp = pagina.getViewport({ scale: escala * densidad })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(vp.width)
  canvas.height = Math.round(vp.height)
  canvas.style.width = `${Math.round(base.width * escala)}px`
  canvas.style.height = `${Math.round(base.height * escala)}px`
  // intent 'print': no depende de requestAnimationFrame, así no queda a medias
  // si el celular cambia de aplicación (lección del sitio de Axel)
  await pagina.render({ canvasContext: canvas.getContext('2d')!, viewport: vp, intent: 'print' }).promise
  return canvas
}

/** Imprime el documento entero, una hoja por página y cada una con su
    orientación (hay documentos que mezclan vertical y horizontal). */
export async function imprimir(bytes: ArrayBuffer): Promise<void> {
  const doc = await abrirPdf(bytes)
  const area = document.createElement('div')
  area.id = 'area-impresion-doc'
  const orientaciones = new Set<string>()
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const pagina = await doc.getPage(i)
      const base = pagina.getViewport({ scale: 1 })
      const horizontal = base.width > base.height
      orientaciones.add(horizontal ? 'H' : 'V')
      const canvas = await dibujarPagina(doc, i, Math.min(1400, base.width * 3), 1)
      const img = new Image()
      img.src = canvas.toDataURL('image/jpeg', 0.92)
      await img.decode().catch(() => undefined)
      canvas.width = canvas.height = 0
      const hoja = document.createElement('div')
      hoja.className = 'hoja-impresion ' + (horizontal ? 'horizontal' : 'vertical')
      hoja.appendChild(img)
      area.appendChild(hoja)
    }
  } finally {
    void doc.destroy()
  }
  const estilo = document.createElement('style')
  estilo.id = 'estilo-impresion-doc'
  estilo.textContent = orientaciones.size > 1
    ? '@page { margin: 6mm; }'
    : `@page { size: ${orientaciones.has('H') ? 'landscape' : 'portrait'}; margin: 6mm; }`
  document.head.appendChild(estilo)
  document.body.appendChild(area)
  document.body.classList.add('imprimiendo-doc')
  const limpiar = () => {
    document.body.classList.remove('imprimiendo-doc')
    area.remove()
    estilo.remove()
    window.removeEventListener('afterprint', limpiar)
  }
  window.addEventListener('afterprint', limpiar)
  window.print()
}
