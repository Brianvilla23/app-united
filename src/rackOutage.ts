// Qué racks sigue la app y cuál se está interviniendo.
//
// Hasta el outage del Rack 12 había un rack y uno solo: el número estaba
// escrito en el código (`RACK_TAPAS = 12`) y `avance_item` ni siquiera tenía
// columna de rack. El outage del Rack 3 (21-09-2026) obligó a sacarlo de ahí.
// Agregar un rack nuevo es agregar una línea en RACKS_OUTAGE.
import { createContext, useContext } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { encolar } from './sync'
import { quienSoy } from './identidad'
import { itemId, type LadoRack } from './types'
import { usePuedeEditar } from './permisos'

/** El manifold de descarga: barra de PVC o manifold flexible. Las piezas que
    se marcan son las mismas (stub end, brazo, tubing); cambia el material. */
export type TipoManifold = 'pvc' | 'flexible'

/** Qué tiene la tapa por fuera. En el Rack 12 hay que sacar seguros triples y
    pernos parker antes de la tapa, y cada uno se registra; en el Rack 3 la tapa
    no lleva nada de eso, así que el retiro es un toque y queda retirada
    (corrección de Brayan, 23-09-2026). La INSTALACIÓN es igual en los dos:
    lleva tapón al centro y shim en milímetros. */
export type TipoRetiroTapas = 'detallado' | 'simple'

export interface RackOutage {
  numero: number
  /** EWS son las Plantas 1, 2 y 3; EWSE la 4. El Rack 3 y el 12 son de EWS. */
  planta: string
  manifold: TipoManifold
  retiroTapas: TipoRetiroTapas
}

/** El primero de la lista es el outage en curso. */
export const RACKS_OUTAGE: RackOutage[] = [
  { numero: 3, planta: 'EWS', manifold: 'flexible', retiroTapas: 'simple' },
  { numero: 12, planta: 'EWS', manifold: 'pvc', retiroTapas: 'detallado' },
]

export const NOMBRE_MANIFOLD: Record<TipoManifold, string> = {
  pvc: 'manifold PVC',
  flexible: 'manifold flexible',
}

export const RACK_INICIAL = RACKS_OUTAGE[0].numero

export function rackDe(numero: number): RackOutage {
  return RACKS_OUTAGE.find((r) => r.numero === numero)
    ?? { numero, planta: 'EWS', manifold: 'pvc', retiroTapas: 'detallado' }
}

/** El rack que se está viendo. Todas las pantallas del outage leen de acá en
    vez de recibirlo por props pantalla por pantalla. */
export const RackContexto = createContext<number>(RACK_INICIAL)

export function useRack(): number {
  return useContext(RackContexto)
}

// --- cierre del outage ---
//
// Un outage que terminó NO se rellena ítem por ítem: eso inventaría registros
// que nadie marcó (por ejemplo 295 vasijas "revisadas sin fuga" en una prueba
// que sí tuvo fugas). Se guarda una sola marca de cierre: el rack pasa a verse
// terminado y queda de solo lectura, y lo registrado en terreno queda intacto.
export const OUTAGE_CERRADO = 'outage_cerrado'
const LADO_CIERRE: LadoRack = 'alimentacion'
const ITEM_CIERRE = 'outage'

// `type` y no `interface` para que entre en el `datos: Record<string, unknown>`
export type DatosCierre = { quien?: string; fecha?: number }

export function idCierre(rack: number): string {
  return itemId(OUTAGE_CERRADO, LADO_CIERRE, rack, ITEM_CIERRE)
}

/** Datos del cierre si el outage está cerrado; null si sigue abierto. */
export function useCierre(rack: number): DatosCierre | null {
  const g = useLiveQuery(() => db.items.get(idCierre(rack)), [rack])
  return g?.hecho ? ((g.datos as DatosCierre | undefined) ?? {}) : null
}

/** Los cierres de todos los racks, para el menú. */
export function useCierres(): Map<number, DatosCierre> {
  const filas = useLiveQuery(() => db.items.where('actividad').equals(OUTAGE_CERRADO).toArray(), []) ?? []
  return new Map(filas.filter((f) => f.hecho).map((f) => [f.rack, (f.datos as DatosCierre | undefined) ?? {}]))
}

export async function cerrarOutage(rack: number, cerrar: boolean): Promise<void> {
  const yo = quienSoy()
  const datos: DatosCierre = cerrar ? { quien: yo, fecha: Date.now() } : {}
  await db.items.put({
    id: idCierre(rack), actividad: OUTAGE_CERRADO, lado: LADO_CIERRE, rack, item: ITEM_CIERRE,
    hecho: cerrar, datos, creadoPor: yo, createdAt: Date.now(), sincronizado: false,
  })
  await encolar('item_upsert', {
    actividad: OUTAGE_CERRADO, lado: LADO_CIERRE, rack, item: ITEM_CIERRE,
    hecho: cerrar, datos, creado_por: yo,
  })
}

/** Para registrar avance del outage hacen falta dos cosas: estar en modo
    "registrar" y que el outage de ese rack siga abierto. */
export function usePuedeRegistrar(): boolean {
  const rack = useRack()
  const cerrado = useCierre(rack)
  return usePuedeEditar() && !cerrado
}
