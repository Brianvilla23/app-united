// Lectura y escritura de la planilla madre.
//
// Reglas de la casa, distintas al resto de la app a propósito:
//
//  - LEER: cualquiera. Se baja a Dexie para poder mirar el plan en planta sin
//    señal. Esa copia local es de solo lectura; nunca se sube de vuelta.
//  - ESCRIBIR el plan: solo los dos editores, con sesión iniciada, y se escribe
//    directo contra Supabase. No pasa por la cola de subida a propósito: si dos
//    personas editan la misma semana desde dos celulares, la cola subiría
//    cambios viejos encima de los nuevos horas después. Sin señal no se edita,
//    y la pantalla lo dice.
//  - SUGERIR: cualquiera, sin cuenta, y eso SÍ va por la cola, porque quien
//    sugiere está en terreno.
import { db } from './db'
import { supabase } from './supabase'
import { uuid } from './util'
import { quienSoy } from './identidad'
import { encolar } from './sync'
import type {
  ActividadPlan, EstadoPlan, EstadoSugerencia, SugerenciaPlan, TipoSugerencia, TurnoPlan,
} from './planTipos'
import { semanaISO, aFecha } from './planTipos'

type Fila = Record<string, unknown>

// Con una barra de senal, un fetch puede quedarse colgado minutos sin fallar ni
// responder. `navigator.onLine` no salva: dice que hay red, no que llegue. Sin
// un tope, la pantalla se queda en "Actualizando..." para siempre tapando el
// plan que SI esta guardado en el telefono. Se corta y se sigue con la copia
// local, que para mirar el plan en planta es exactamente lo que hace falta.
const TOPE_MS = 8000
const SIN_RESPUESTA = { data: null, error: { message: 'sin respuesta' } }

async function conTope<T>(promesa: PromiseLike<T>): Promise<T | typeof SIN_RESPUESTA> {
  let reloj: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race<T | typeof SIN_RESPUESTA>([
      promesa,
      new Promise((ok) => { reloj = setTimeout(() => ok(SIN_RESPUESTA), TOPE_MS) }),
    ])
  } finally {
    if (reloj) clearTimeout(reloj)
  }
}

function aActividad(r: Fila): ActividadPlan {
  return {
    id: String(r.id),
    fecha: String(r.fecha),
    anio: Number(r.anio),
    semana: Number(r.semana),
    turno: (r.turno as TurnoPlan) ?? 'Dia',
    actividad: String(r.actividad ?? ''),
    hh: r.hh === null || r.hh === undefined ? null : Number(r.hh),
    estado: (r.estado as EstadoPlan) ?? 'planificada',
    zona: (r.zona as string) ?? '',
    ot: (r.ot as string) ?? '',
    nota: (r.nota as string) ?? '',
    orden: Number(r.orden ?? 0),
    creadoPor: (r.creado_por as string) ?? '',
    actualizadoPor: (r.actualizado_por as string) ?? '',
    actualizadoEn: r.actualizado_en ? new Date(String(r.actualizado_en)).getTime() : 0,
  }
}

function aFilaSupabase(a: ActividadPlan): Fila {
  return {
    id: a.id, fecha: a.fecha, anio: a.anio, semana: a.semana, turno: a.turno,
    actividad: a.actividad, hh: a.hh, estado: a.estado, zona: a.zona || null,
    ot: a.ot || null, nota: a.nota || null, orden: a.orden,
    creado_por: a.creadoPor || null,
    actualizado_por: a.actualizadoPor || null,
    actualizado_en: new Date().toISOString(),
  }
}

function aSugerencia(r: Fila): SugerenciaPlan {
  return {
    id: String(r.id),
    fecha: (r.fecha as string) ?? null,
    anio: r.anio === null || r.anio === undefined ? null : Number(r.anio),
    semana: r.semana === null || r.semana === undefined ? null : Number(r.semana),
    actividadId: (r.actividad_id as string) ?? null,
    tipo: (r.tipo as TipoSugerencia) ?? 'comentario',
    texto: String(r.texto ?? ''),
    autor: String(r.autor ?? ''),
    estado: (r.estado as EstadoSugerencia) ?? 'pendiente',
    respuesta: (r.respuesta as string) ?? '',
    resueltoPor: (r.resuelto_por as string) ?? '',
    createdAt: r.created_at ? new Date(String(r.created_at)).getTime() : Date.now(),
  }
}

// ------------------------------------------------------------------ bajar

export const CLAVE_ULTIMA_BAJADA = 'plan_ultima_bajada'

/** Baja el plan completo a Dexie. Devuelve false si no se pudo (sin señal). */
export async function bajarPlan(): Promise<boolean> {
  if (!navigator.onLine) return false
  const { data, error } = await conTope(
    supabase.from('plan_actividades').select('*'),
  )
  if (error || !data) return false
  await db.transaction('rw', db.plan, async () => {
    await db.plan.clear()
    await db.plan.bulkAdd(data.map(aActividad))
  })
  localStorage.setItem(CLAVE_ULTIMA_BAJADA, String(Date.now()))
  return true
}

export async function bajarSugerencias(): Promise<boolean> {
  if (!navigator.onLine) return false
  // Primero que suba lo que este celular tenga encolado, si no la bajada lo pisa.
  if (await db.outbox.where('tabla').equals('plan_sugerencia').count() > 0) return false
  const { data, error } = await conTope(
    supabase.from('plan_sugerencias').select('*').order('created_at', { ascending: false }).limit(400),
  )
  if (error || !data) return false
  await db.transaction('rw', db.sugerencias, async () => {
    await db.sugerencias.clear()
    await db.sugerencias.bulkAdd(data.map(aSugerencia))
  })
  return true
}

export async function bajarCatalogo(): Promise<string[]> {
  if (!navigator.onLine) return []
  const { data, error } = await conTope(
    supabase.from('plan_catalogo').select('actividad, veces').eq('activo', true)
      .order('veces', { ascending: false }),
  )
  if (error || !data) return []
  return data.map((r) => String(r.actividad))
}

export async function hhPorDia(): Promise<number> {
  const guardado = Number(localStorage.getItem('plan_hh_por_dia') ?? '')
  if (!navigator.onLine) return guardado || 344
  const { data } = await conTope(
    supabase.from('plan_config').select('valor').eq('clave', 'hh_por_dia').maybeSingle(),
  )
  const n = Number(data?.valor)
  if (n > 0) { localStorage.setItem('plan_hh_por_dia', String(n)); return n }
  return guardado || 344
}

// ----------------------------------------------------------------- escribir

export class SinPermiso extends Error {}
export class SinSenal extends Error {}

/** Crea o cambia una línea del plan. Solo editor con sesión y con señal. */
export async function guardarActividad(a: ActividadPlan): Promise<void> {
  if (!navigator.onLine) throw new SinSenal('Sin señal: el plan se edita conectado.')
  const fila = aFilaSupabase({ ...a, actualizadoPor: quienSoy() || a.actualizadoPor })
  const { error } = await supabase.from('plan_actividades').upsert(fila)
  if (error) throw traducir(error)
  await db.plan.put({ ...a, actualizadoPor: quienSoy() || a.actualizadoPor, actualizadoEn: Date.now() })
}

export async function borrarActividad(id: string): Promise<void> {
  if (!navigator.onLine) throw new SinSenal('Sin señal: el plan se edita conectado.')
  const { error } = await supabase.from('plan_actividades').delete().eq('id', id)
  if (error) throw traducir(error)
  await db.plan.delete(id)
}

/** Copia todas las líneas de una semana a otra. Es lo que antes se hacía
    duplicando el bloque en el Excel — de ahí salían las semanas con la fecha y
    el número del bloque de arriba. Acá la fecha se recalcula sola. */
export async function copiarSemana(desdeLunes: Date, haciaLunes: Date): Promise<number> {
  if (!navigator.onLine) throw new SinSenal('Sin señal: el plan se edita conectado.')
  const desde = semanaISO(desdeLunes)
  const origen = await db.plan.where({ anio: desde.anio, semana: desde.semana }).toArray()
  if (origen.length === 0) return 0
  const dias = Math.round((haciaLunes.getTime() - desdeLunes.getTime()) / 86_400_000)
  const nuevas: ActividadPlan[] = origen.map((o) => {
    const f = new Date(aFecha(o.fecha).getTime() + dias * 86_400_000)
    const iso = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
    const { anio, semana } = semanaISO(f)
    return {
      ...o, id: uuid(), fecha: iso, anio, semana, estado: 'planificada' as EstadoPlan,
      creadoPor: quienSoy(), actualizadoPor: quienSoy(), actualizadoEn: Date.now(),
    }
  })
  const { error } = await supabase.from('plan_actividades').upsert(nuevas.map(aFilaSupabase))
  if (error) throw traducir(error)
  await db.plan.bulkPut(nuevas)
  await registrarPlan('copio', `${nuevas.length} líneas a la semana del ${nuevas[0].fecha}`, null, nuevas[0].fecha)
  return nuevas.length
}

/** Un error de RLS llega como un 401/403 sin explicación. Se traduce acá para
    que la pantalla pueda decir por qué no se guardó. */
function traducir(error: { message?: string; code?: string }): Error {
  const m = error.message ?? ''
  if (/row-level security|permission denied|JWT|not authorized/i.test(m) || error.code === '42501') {
    return new SinPermiso('Tu cuenta no está habilitada para editar el plan.')
  }
  return new Error(m || 'No se pudo guardar.')
}

export async function registrarPlan(
  accion: string, detalle: string, actividadId: string | null, fecha: string | null,
): Promise<void> {
  if (!navigator.onLine) return
  await supabase.from('plan_historial').insert({
    id: uuid(), actividad_id: actividadId, fecha, accion, detalle,
    quien: quienSoy() || 'sin identificar',
  })
}

// --------------------------------------------------------------- sugerencias

export async function enviarSugerencia(s: {
  tipo: TipoSugerencia; texto: string; fecha: string | null; actividadId: string | null
}): Promise<void> {
  const { anio, semana } = s.fecha
    ? semanaISO(aFecha(s.fecha))
    : { anio: null as number | null, semana: null as number | null }
  const item: SugerenciaPlan = {
    id: uuid(), fecha: s.fecha, anio, semana, actividadId: s.actividadId,
    tipo: s.tipo, texto: s.texto.trim(), autor: quienSoy() || 'sin identificar',
    estado: 'pendiente', respuesta: '', resueltoPor: '', createdAt: Date.now(),
  }
  await db.sugerencias.put(item)
  await encolar('plan_sugerencia', {
    id: item.id, fecha: item.fecha, anio: item.anio, semana: item.semana,
    actividad_id: item.actividadId, tipo: item.tipo, texto: item.texto,
    autor: item.autor, estado: item.estado,
    created_at: new Date(item.createdAt).toISOString(),
  })
}

export async function resolverSugerencia(
  id: string, estado: EstadoSugerencia, respuesta: string,
): Promise<void> {
  if (!navigator.onLine) throw new SinSenal('Sin señal: para responder hace falta conexión.')
  const { error } = await supabase.from('plan_sugerencias').update({
    estado, respuesta: respuesta || null, resuelto_por: quienSoy() || null,
    resuelto_en: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw traducir(error)
  await db.sugerencias.update(id, { estado, respuesta, resueltoPor: quienSoy() })
}

// ------------------------------------------------------------------ cuentas

export async function entrar(correo: string, clave: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave })
  if (error) {
    const m = error.message ?? ''
    throw new Error(/invalid login/i.test(m) ? 'Correo o clave incorrectos.' : m)
  }
}

export async function salir(): Promise<void> {
  await supabase.auth.signOut()
}

/** ¿La cuenta con sesión abierta está en la lista de editores del plan?
    Lo contesta la base, no la app: la misma respuesta que aplican las políticas. */
export async function soyEditor(): Promise<boolean> {
  const { data, error } = await supabase.rpc('es_editor_plan')
  return !error && data === true
}
