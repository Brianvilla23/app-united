import { db } from './db'
import { supabase } from './supabase'
import { uuid } from './util'
import type { Aviso, Andamio, TablaOutbox } from './types'

// ---------- encolar operaciones (outbox) ----------

export async function encolar(tabla: TablaOutbox, payload: Record<string, unknown>): Promise<void> {
  await db.outbox.add({ id: uuid(), tabla, payload, createdAt: Date.now() })
  void drenar()
}

export function avisoARow(a: Aviso): Record<string, unknown> {
  return {
    id: a.id, folio: a.folio, titulo: a.titulo, tipo: a.tipo, prioridad: a.prioridad,
    zona: a.zona, equipo: a.equipo, descripcion: a.descripcion, modo_falla: a.modoFalla,
    materiales: a.materiales, dotacion: a.dotacion, horas: a.horas, detencion: a.detencion,
    fecha_trabajo: a.fechaTrabajo, hse: a.hse, correo_respaldo: a.correoRespaldo,
    fotos_count: a.fotos.length, creado_por: a.creadoPor,
    created_at: new Date(a.createdAt).toISOString(),
  }
}

export function andamioARow(a: Andamio): Record<string, unknown> {
  return {
    id: a.id, folio: a.folio, lugar: a.lugar, equipo: a.equipo,
    descripcion_uso: a.descripcionUso, temporalidad: a.temporalidad, dias: a.dias,
    cantidad_cuerpos: a.cantidadCuerpos, fecha_construccion: a.fechaConstruccion,
    estado_tarjeta: a.estadoTarjeta, inspeccionado_por: a.inspeccionadoPor,
    proxima_inspeccion: a.proximaInspeccion, subsecuente_generado: a.subsecuenteGenerado,
    correo_respaldo: a.correoRespaldo,
    fotos_count: a.fotosAndamio.length + a.fotosTarjeta.length,
    creado_por: a.creadoPor, created_at: new Date(a.createdAt).toISOString(),
  }
}

// ---------- drenar: subir lo pendiente ----------

let drenando = false

export async function drenar(): Promise<void> {
  if (drenando || !navigator.onLine) return
  drenando = true
  try {
    const items = await db.outbox.orderBy('createdAt').toArray()
    for (const it of items) {
      let error: unknown = null
      if (it.tabla === 'avisos') {
        ({ error } = await supabase.from('avisos').upsert(it.payload))
        if (!error) await db.avisos.update(String(it.payload.id), { sincronizado: true })
      } else if (it.tabla === 'andamios') {
        ({ error } = await supabase.from('andamios').upsert(it.payload))
        if (!error) await db.andamios.update(String(it.payload.id), { sincronizado: true })
      } else if (it.tabla === 'marcas_upsert') {
        ({ error } = await supabase.from('marcas_fuga').upsert(it.payload))
      } else if (it.tabla === 'marcas_delete') {
        ({ error } = await supabase.from('marcas_fuga').delete()
          .match({ rack: it.payload.rack, vasija: it.payload.vasija, componente: it.payload.componente }))
      }
      if (error) break // sin señal o error del servidor: reintenta en el próximo ciclo
      await db.outbox.delete(it.id)
    }
  } finally {
    drenando = false
  }
}

// ---------- pull del diagrama compartido ----------

export async function pullMarcas(): Promise<void> {
  if (!navigator.onLine) return
  const pendientes = await db.outbox.where('tabla').anyOf(['marcas_upsert', 'marcas_delete']).count()
  if (pendientes > 0) return // primero subir lo local, después bajar
  const { data, error } = await supabase.from('marcas_fuga').select('*')
  if (error || !data) return
  await db.transaction('rw', db.marcas, async () => {
    await db.marcas.clear()
    await db.marcas.bulkAdd(data.map((r) => ({
      id: `${r.rack}-${r.vasija}-${r.componente}`,
      rack: r.rack,
      vasija: r.vasija,
      componente: r.componente,
      creadoPor: r.creado_por ?? '',
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      sincronizado: true,
    })))
  })
}

// ---------- ciclo de sincronización ----------

let iniciado = false

export function iniciarSync(): void {
  if (iniciado) return
  iniciado = true
  void drenar().then(pullMarcas)
  window.addEventListener('online', () => { void drenar().then(pullMarcas) })
  setInterval(() => { void drenar().then(pullMarcas) }, 45_000)
}
