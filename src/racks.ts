// Qué outages conoce la app y con qué catálogo de actividades trabaja cada uno.
//
// Hasta el Rack 3 existía un solo outage y el rack estaba escrito a mano en
// media docena de archivos (`RACK_TAPAS = 12`, los títulos, el nombre de los
// PDF). Acá queda en un solo lugar: la pantalla del outage recibe el rack y se
// lo pasa a los diagramas, y `avance_item` lo guarda en su propia columna
// (migración `sql/07_rack_en_avance_item.sql`).
import { ACTIVIDADES, type Actividad } from './actividades'
import { ACTIVIDADES_RACK3 } from './actividadesRack3'

export interface Outage {
  rack: number
  /** Planta a la que pertenece el rack: sale del encabezado de la Carta Gantt. */
  planta: string
  /** Alcance que cubre el catálogo, para que nadie espere lo que no está. */
  alcance: string
  ventana: string
  actividades: Actividad[]
  /** false = ya terminó; se sigue pudiendo abrir para consultar el historial. */
  abierto: boolean
}

export const OUTAGES: Outage[] = [
  {
    rack: 3,
    planta: 'EWS Planta 1',
    alcance: 'Cambio de membrana',
    ventana: '22/09 → 03/10/2026',
    actividades: ACTIVIDADES_RACK3,
    abierto: true,
  },
  {
    rack: 12,
    planta: 'EWS',
    alcance: 'Outage completo',
    ventana: '29/07 → 21/09/2026',
    actividades: ACTIVIDADES,
    abierto: false,
  },
]

/** El outage en el que está trabajando la cuadrilla hoy. */
export const OUTAGE_ACTIVO = OUTAGES[0]

export function outageDe(rack: number): Outage {
  return OUTAGES.find((o) => o.rack === rack) ?? OUTAGE_ACTIVO
}

/** Nombre del rack tal como se rotula en pantalla y en los PDF. */
export function rotuloRack(rack: number): string {
  return `Rack ${rack}`
}
