// Función de Supabase "sincronizar-documentos": copia a la app el catálogo de
// check list y documentos del contrato CC6001 que Axel publica en
// registros-cc6001.pages.dev (ver sql/31_documentos.sql).
//
// El catálogo de Axel es:
//   · documents.json: los PDF que vienen con su sitio (pdfs/…);
//   · /api/state: lo que hizo después desde su panel (agregó, borró o editó).
// La app no puede leer /api/state ni /api/file desde el navegador (esa parte de
// su sitio no responde con CORS), por eso esto corre en el servidor.
//
// Baja solo lo nuevo o cambiado (por `version`), borra lo que Axel borró y
// corta antes del límite de tiempo: si quedan pendientes, se vuelve a llamar.
//
// Quién la puede correr: pg_cron (cabecera x-sync-token con el token del Vault,
// que valida la base) o una cuenta de planificación (es_editor_plan) desde el
// botón de la app. Se publica con verify_jwt apagado por pg_cron.
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY ya vienen puestas.
import { createClient } from 'npm:@supabase/supabase-js@2'

const ORIGEN = 'https://registros-cc6001.pages.dev'
const BUCKET = 'adjuntos'
const PRESUPUESTO_MS = 100_000

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function responder(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

interface ItemAxel {
  id: string
  category: string
  code?: string
  name: string
  file: string
  sizeKB?: number
  uploaded?: string
}
interface CatalogoAxel {
  updated?: string
  categories: { id: string; label: string }[]
  items: ItemAxel[]
}
interface EstadoAxel {
  added: ItemAxel[]
  deletedIds: string[]
  edits: Record<string, { category?: string; code?: string; name?: string }>
}

const ETIQUETAS: Record<string, string> = {
  checklist: 'Check List', protocolo: 'Protocolos', bos: 'BOS', declaracion: 'Declaración', otros: 'Otros',
}
const ORDEN = ['checklist', 'protocolo', 'bos', 'declaracion']

async function bajarJSON<T>(ruta: string): Promise<T> {
  const r = await fetch(ORIGEN + ruta, { headers: { 'cache-control': 'no-cache' } })
  if (!r.ok) throw new Error(`${ruta}: ${r.status}`)
  return await r.json() as T
}

/** Lo mismo que arma el sitio de Axel en su index.html: base − borrados,
    con las ediciones aplicadas, más lo agregado. */
function unir(cat: CatalogoAxel, est: EstadoAxel) {
  const borrados = new Set(est.deletedIds ?? [])
  const base = cat.items.filter((i) => !borrados.has(i.id)).map((i) => ({
    ...i, ...(est.edits?.[i.id] ?? {}),
    fuente: `${ORIGEN}/${i.file.replace(/^\//, '')}`,
    version: `${i.sizeKB ?? 0}-${cat.updated ?? ''}`,
  }))
  const agregados = (est.added ?? []).filter((i) => !borrados.has(i.id)).map((i) => ({
    ...i, ...(est.edits?.[i.id] ?? {}),
    fuente: `${ORIGEN}${i.file.startsWith('/') ? '' : '/'}${i.file}`,
    version: `${i.sizeKB ?? 0}-${i.uploaded ?? ''}`,
  }))
  const etiquetas = new Map(cat.categories.map((c) => [c.id, c.label]))
  return [...base, ...agregados].map((i) => {
    const pos = ORDEN.indexOf(i.category)
    return {
      id: i.id,
      categoria: i.category,
      categoria_nombre: etiquetas.get(i.category) ?? ETIQUETAS[i.category] ?? i.category,
      categoria_orden: pos >= 0 ? pos : i.category === 'otros' ? 999 : 500,
      codigo: i.code ?? '',
      nombre: i.name,
      ruta: `documentos/${i.id}.pdf`,
      kb: i.sizeKB ?? 0,
      version: i.version,
      fuente: i.fuente,
    }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // ¿Quién llama? pg_cron trae el token del Vault; la base dice si es el bueno.
  let permitido = false
  const token = req.headers.get('x-sync-token')
  if (token) {
    const { data } = await admin.rpc('token_sync_documentos_valido', { t: token })
    permitido = data === true
  }
  if (!permitido) {
    const jwt = req.headers.get('authorization') ?? ''
    if (jwt.startsWith('Bearer ')) {
      const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: jwt } },
      })
      const { data } = await usuario.rpc('es_editor_plan')
      permitido = data === true
    }
  }
  if (!permitido) return responder({ error: 'Solo planificación puede actualizar los documentos.' }, 403)

  const inicio = Date.now()
  try {
    const [cat, est] = await Promise.all([
      bajarJSON<CatalogoAxel>('/documents.json'),
      bajarJSON<EstadoAxel>('/api/state'),
    ])
    const lista = unir(cat, est)
    if (lista.length < 10) throw new Error(`El catálogo de Axel vino con ${lista.length} documentos: no se toca nada.`)

    const { data: actuales, error } = await admin.from('documentos').select('id, version, ruta')
    if (error) throw error
    const antes = new Map((actuales ?? []).map((d) => [d.id as string, d]))

    let nuevos = 0, actualizados = 0, soloDatos = 0, pendientes = 0
    const fallas: string[] = []
    for (const d of lista) {
      const previo = antes.get(d.id)
      if (previo && previo.version === d.version) {
        // mismo PDF: solo pueden haber cambiado el nombre o la categoría
        const { error: e } = await admin.from('documentos').update({
          categoria: d.categoria, categoria_nombre: d.categoria_nombre, categoria_orden: d.categoria_orden,
          codigo: d.codigo, nombre: d.nombre,
        }).eq('id', d.id)
        if (e) fallas.push(`${d.id}: ${e.message}`)
        else soloDatos++
        continue
      }
      if (Date.now() - inicio > PRESUPUESTO_MS) { pendientes++; continue }
      try {
        const r = await fetch(d.fuente)
        if (!r.ok) throw new Error(`bajar ${r.status}`)
        const bytes = new Uint8Array(await r.arrayBuffer())
        if (bytes.length < 100 || String.fromCharCode(...bytes.slice(0, 4)) !== '%PDF') throw new Error('no es un PDF')
        const { error: eSubir } = await admin.storage.from(BUCKET).upload(d.ruta, bytes, {
          contentType: 'application/pdf', upsert: true,
        })
        if (eSubir) throw eSubir
        const { error: eFila } = await admin.from('documentos').upsert({
          ...d, kb: Math.round(bytes.length / 1024), actualizado: new Date().toISOString(),
        })
        if (eFila) throw eFila
        if (previo) actualizados++
        else nuevos++
      } catch (e) {
        fallas.push(`${d.codigo || d.nombre}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // lo que Axel borró de su catálogo, se borra acá (solo si la lista vino bien)
    const vigentes = new Set(lista.map((d) => d.id))
    const sobran = [...antes.values()].filter((d) => !vigentes.has(d.id as string))
    if (sobran.length) {
      await admin.storage.from(BUCKET).remove(sobran.map((d) => d.ruta as string))
      await admin.from('documentos').delete().in('id', sobran.map((d) => d.id as string))
    }

    return responder({
      total: lista.length, nuevos, actualizados, soloDatos, borrados: sobran.length, pendientes, fallas,
      segundos: Math.round((Date.now() - inicio) / 1000),
    })
  } catch (e) {
    return responder({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
