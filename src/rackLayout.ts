// Layout real del PDF "Vasijas lado Alimentación enumeradas" (295 vasijas).
// Semi Rack A = columnas 1-8 · Semi Rack B = columnas 9-16 · filas A-S.
// Filas A y B: solo 2-7 y 10-15. Fila C: 2-16. Filas D-S: 1-16.

export const FILAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S'] as const

function colsPara(fila: string): number[] {
  if (fila === 'A' || fila === 'B') return [2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15]
  if (fila === 'C') return [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
  return Array.from({ length: 16 }, (_, i) => i + 1)
}

export interface CeldaVasija { fila: string; col: number; id: string }

export const CELDAS: CeldaVasija[] = FILAS.flatMap((f) =>
  colsPara(f).map((c) => ({ fila: f, col: c, id: `${f}${c}` })),
)

export type ComponenteFuga = 'UN' | 'US' | 'SN' | 'SS' | 'T' | 'C'

// Un solo color de marca para TODO: amarillo = fuga (regla del user).
// Las victaulic del dibujo base van en plomo para que la marca resalte.
export const MARCA = '#f0b400'
export const MARCA_BORDE = '#8a6d03'
export const PLOMO = '#a8b0ba'
export const PLOMO_BORDE = '#7d8794'

export interface ComponenteDef { codigo: ComponenteFuga; nombre: string; posicion: string }

export const COMPONENTES: ComponenteDef[] = [
  { codigo: 'UN', nombre: 'Victaulic norte', posicion: 'cople derecho' },
  { codigo: 'US', nombre: 'Victaulic sur', posicion: 'cople izquierdo' },
  { codigo: 'SN', nombre: 'Sideport norte', posicion: 'barra derecha' },
  { codigo: 'SS', nombre: 'Sideport sur', posicion: 'barra izquierda' },
  { codigo: 'T', nombre: 'Tapón', posicion: 'centro' },
  { codigo: 'C', nombre: 'Canastillo', posicion: 'anillo interior' },
]

// tramos contiguos de cañería por fila (cortan en los postes: 4|5, 8|9, 12|13)
export function runsPara(fila: string): number[][] {
  const cols = colsPara(fila)
  const rangos: [number, number][] = [[1, 4], [5, 8], [9, 12], [13, 16]]
  return rangos
    .map(([lo, hi]) => cols.filter((c) => c >= lo && c <= hi))
    .filter((r) => r.length > 0)
}

// --- geometría del diagrama ---
export const CELL = 48
export const MX = 26   // margen izq (letras de fila)
export const MY = 52   // margen sup (título + semi racks)

export function extraX(col: number): number {
  return (col > 4 ? 18 : 0) + (col > 8 ? 30 : 0) + (col > 12 ? 18 : 0)
}
export function cx(col: number): number { return MX + (col - 1) * CELL + extraX(col) + CELL / 2 }
export function cy(filaIdx: number): number { return MY + filaIdx * CELL + CELL / 2 }

export const ANCHO = MX + 16 * CELL + 18 + 30 + 18 + 10
export const ALTO = MY + FILAS.length * CELL + 36

// postes (centros de las bandas entre columnas)
export const POSTE1_X = MX + 4 * CELL + 1
export const POSTE2_X = MX + 12 * CELL + 18 + 30 + 1
export const POSTE_W = 16
