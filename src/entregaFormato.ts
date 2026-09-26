// Cómo se titula el documento según el área que entrega el turno.
//
// El formato es el mismo (PYC-EG-MEL-6001-01), pero el encabezado dice de quién
// es la entrega: la de terreno es la de los supervisores y la otra es la del
// área de planificación.
import type { AreaEntrega } from './planDatos'

export function tituloFormato(area: AreaEntrega): string {
  return area === 'supervision' ? 'ENTREGA DE TURNO SUPERVISORES' : 'ENTREGA DE TURNO PYC'
}
