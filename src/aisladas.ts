// Vasijas aisladas del outage (18-10-2026, Brayan): se marcan en el carguío de
// membrana y "no se intervienen de ahí en adelante". Desde el carguío hasta la
// prueba de alta, la vasija aislada:
//  · se pinta azul (el mismo azul de la tapa aislada) y no se puede marcar;
//  · sale del total de la actividad, así el 100% sigue siendo alcanzable.
// Las actividades de ANTES del carguío no cambian: ahí la vasija sí se trabajó.
//
// Se guarda en `avance_item` como una actividad más (`vasija_aislada`, una fila
// por vasija y rack), igual que el cierre del outage: no necesita tabla nueva y
// viaja con la misma cola sin señal.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { encolar } from './sync'
import { quienSoy } from './identidad'
import { itemId, type LadoRack } from './types'
import { ACTIVIDADES } from './actividades'

export const AISLADA = 'vasija_aislada'
const LADO: LadoRack = 'alimentacion'
export const COLOR_AISLADA = { color: '#2563eb', texto: '#ffffff' }
export const SIN_AISLADAS: ReadonlySet<string> = new Set()

const DESDE = ACTIVIDADES.findIndex((a) => a.id === 'carguio_membrana')

/** ¿Esta actividad va del carguío en adelante? */
export function respetaAisladas(actividad: string): boolean {
  const i = ACTIVIDADES.findIndex((a) => a.id === actividad)
  return DESDE >= 0 && i >= DESDE
}

// `type` y no `interface` para que entre en el `datos: Record<string, unknown>`
export type DatosAislada = { quien?: string; fecha?: number }

/** Las vasijas aisladas del rack. */
export function useAisladas(rack: number): ReadonlySet<string> {
  const filas = useLiveQuery(
    () => db.items.where('[actividad+rack]').equals([AISLADA, rack]).toArray(), [rack],
  )
  if (!filas) return SIN_AISLADAS
  return new Set(filas.filter((f) => f.hecho).map((f) => f.item))
}

/** Las aisladas que cuentan para ESTA actividad (ninguna antes del carguío). */
export function useAisladasDe(actividad: string, rack: number): ReadonlySet<string> {
  const todas = useAisladas(rack)
  return respetaAisladas(actividad) ? todas : SIN_AISLADAS
}

export async function marcarAislada(rack: number, vasija: string, aislada: boolean): Promise<void> {
  const yo = quienSoy()
  const datos: DatosAislada = aislada ? { quien: yo, fecha: Date.now() } : {}
  await db.items.put({
    id: itemId(AISLADA, LADO, rack, vasija), actividad: AISLADA, lado: LADO, rack, item: vasija,
    hecho: aislada, datos, creadoPor: yo, createdAt: Date.now(), sincronizado: false,
  })
  await encolar('item_upsert', {
    actividad: AISLADA, lado: LADO, rack, item: vasija, hecho: aislada, datos, creado_por: yo,
  })
}
