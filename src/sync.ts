import { db } from './db'
import { supabase } from './supabase'
import { uuid } from './util'
import { quienSoy } from './identidad'
import { tapaId, itemId } from './types'
import type { Aviso, Andamio, TablaOutbox, HistorialItem, LadoRack } from './types'

// ---------- historial (trazabilidad) ----------

/** Deja registro local + encola la subida. Nunca bloquea la acción del usuario. */
export async function registrar(
  tipo: HistorialItem['tipo'], lado: LadoRack, rack: number, vasija: string, accion: string, detalle = '',
): Promise<void> {
  const item: HistorialItem = {
    id: uuid(), tipo, lado, rack, vasija, accion, detalle,
    quien: quienSoy() || 'sin identificar', createdAt: Date.now(),
  }
  await db.historial.add(item)
  await encolar('historial', {
    id: item.id, tipo: item.tipo, lado: item.lado, rack: item.rack, vasija: item.vasija,
    accion: item.accion, detalle: item.detalle, quien: item.quien,
    created_at: new Date(item.createdAt).toISOString(),
  })
}

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
// Si se encola algo MIENTRAS estamos subiendo, esa llamada a drenar() se va sin
// hacer nada por el candado. Antes eso dejaba la cola esperando hasta el ciclo
// de 45 s (se veía como "↑ 62 por subir" un rato largo). Ahora queda anotado y
// damos otra vuelta al terminar.
let otraVuelta = false

export async function drenar(): Promise<void> {
  if (!navigator.onLine) return
  if (drenando) { otraVuelta = true; return }
  drenando = true
  try {
    let seguir = true
    while (seguir) {
      otraVuelta = false
      const huboError = await subirPendientes()
      // repetir solo si entró algo nuevo y la subida venía bien: si el servidor
      // está fallando, no insistimos en bucle y esperamos al próximo ciclo
      seguir = otraVuelta && !huboError
    }
  } finally {
    drenando = false
  }
}

/** Sube la cola en orden. Devuelve true si se cortó por un error. */
async function subirPendientes(): Promise<boolean> {
  {
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
          .match({ lado: it.payload.lado ?? 'alimentacion', rack: it.payload.rack, vasija: it.payload.vasija, componente: it.payload.componente }))
      } else if (it.tabla === 'tapas_upsert') {
        ({ error } = await supabase.from('estado_tapas').upsert(it.payload))
        if (!error) {
          const id = tapaId(String(it.payload.actividad ?? 'retiro_tapas_alim'), it.payload.lado as LadoRack, Number(it.payload.rack), String(it.payload.vasija))
          await db.tapas.update(id, { sincronizado: true })
        }
      } else if (it.tabla === 'tapas_delete') {
        ({ error } = await supabase.from('estado_tapas').delete()
          .match({ actividad: it.payload.actividad ?? 'retiro_tapas_alim', lado: it.payload.lado, rack: it.payload.rack, vasija: it.payload.vasija }))
      } else if (it.tabla === 'item_upsert') {
        ({ error } = await supabase.from('avance_item').upsert(it.payload))
        if (!error) {
          const id = itemId(it.payload.actividad as string, it.payload.lado as LadoRack, String(it.payload.item))
          await db.items.update(id, { sincronizado: true })
        }
      } else if (it.tabla === 'historial') {
        // upsert por id: si la respuesta se perdió, el reintento no duplica
        ({ error } = await supabase.from('historial').upsert(it.payload))
      }
      if (error) return true // sin señal o error del servidor: reintenta en el próximo ciclo
      await db.outbox.delete(it.id)
    }
  }
  return false
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

export async function pullTapas(): Promise<void> {
  if (!navigator.onLine) return
  const pend = await db.outbox.where('tabla').anyOf(['tapas_upsert', 'tapas_delete']).count()
  if (pend > 0) return
  const { data, error } = await supabase.from('estado_tapas').select('*')
  if (error || !data || data.length === 0) return // no pisar la data local con una tabla vacía
  await db.transaction('rw', db.tapas, async () => {
    await db.tapas.clear()
    await db.tapas.bulkAdd(data.map((r) => {
      const lado = (r.lado as LadoRack | null) ?? 'alimentacion'
      const actividad = (r.actividad as string | null) ?? 'retiro_tapas_alim'
      return {
        id: tapaId(actividad, lado, r.rack, r.vasija),
        actividad,
        lado,
        rack: r.rack,
        vasija: r.vasija,
        tapaAgripada: !!r.tapa_agripada,
        segurosAgripados: (r.seguros_agripados as number[] | null) ?? [],
        pernosRodados: (r.pernos_rodados as number[] | null) ?? [],
        aislada: !!r.aislada,
        creadoPor: r.creado_por ?? '',
        createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
        sincronizado: true,
      }
    }))
  })
}

export async function pullHistorial(): Promise<void> {
  if (!navigator.onLine) return
  if (await db.outbox.where('tabla').equals('historial').count() > 0) return
  const { data, error } = await supabase.from('historial')
    .select('*').order('created_at', { ascending: false }).limit(300)
  if (error || !data || data.length === 0) return
  await db.transaction('rw', db.historial, async () => {
    await db.historial.clear()
    await db.historial.bulkAdd(data.map((r) => ({
      id: r.id,
      tipo: r.tipo as HistorialItem['tipo'],
      lado: (r.lado as LadoRack | null) ?? 'alimentacion',
      rack: r.rack,
      vasija: r.vasija,
      accion: r.accion,
      detalle: r.detalle ?? '',
      quien: r.quien ?? '',
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    })))
  })
}

export async function pullItems(): Promise<void> {
  if (!navigator.onLine) return
  if (await db.outbox.where('tabla').equals('item_upsert').count() > 0) return
  const { data, error } = await supabase.from('avance_item').select('*')
  if (error || !data) return
  await db.transaction('rw', db.items, async () => {
    await db.items.clear()
    await db.items.bulkAdd(data.map((r) => ({
      id: itemId(r.actividad, r.lado, r.item),
      actividad: r.actividad,
      lado: r.lado,
      item: r.item,
      hecho: !!r.hecho,
      datos: (r.datos as Record<string, unknown>) ?? {},
      creadoPor: r.creado_por ?? '',
      createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      sincronizado: true,
    })))
  })
}

// ---------- ciclo de sincronización ----------

let iniciado = false

function ciclo(): void {
  void drenar().then(() => { void pullMarcas(); void pullTapas(); void pullHistorial(); void pullItems() })
}

export function iniciarSync(): void {
  if (iniciado) return
  iniciado = true
  ciclo()
  window.addEventListener('online', ciclo)
  setInterval(ciclo, 45_000)
}
