// Catálogo del Outage del Rack 12: qué actividades hay, en qué orden van y
// con qué diagrama se marca cada una.
//
// Fuente: hojas manuscritas de Brayan (29-07-2026) + planos de Planificación.
// El orden del array ES el orden de ejecución. Las marcadas `libre: true` se
// pueden hacer en cualquier momento sin frenar la secuencia.
import { TOTAL_VASIJAS } from './rackLayout'
import type { LadoRack } from './types'

export type TipoDiagrama =
  | 'manifold'   // los 40 manifolds (10 filas × 4)
  | 'tapa'       // plano de 295 con seguros y pernos
  | 'simple'     // plano de 295, se marca hecho / no hecho
  | 'fugas'      // plano de 295 marcando el componente que filtra
  | 'venteo'     // los 6 venteos del rack

/** Componentes donde puede aparecer una fuga, según la prueba. */
export const FUGAS_BAJA = ['tapon', 'tapa', 'interconector', 'venteo'] as const
export const FUGAS_ALTA = [...FUGAS_BAJA, 'manifold', 'stubend', 'tubing'] as const

export interface Actividad {
  id: string
  nombre: string
  tipo: TipoDiagrama
  /** Lados sobre los que se ejecuta. */
  lados: LadoRack[]
  /** Sub-pasos dentro de la actividad, en orden. */
  pasos?: string[]
  /** true = no forma parte de la cadena secuencial. */
  libre?: boolean
  /** true = es del rack completo, el lado no aplica (ej. las membranas). */
  sinLado?: boolean
  nota?: string
}

export const MANIFOLDS_POR_LADO = 40

export const ACTIVIDADES: Actividad[] = [
  {
    id: 'retiro_tapas_alim',
    nombre: 'Retiro de tapas · alimentación',
    tipo: 'tapa',
    lados: ['alimentacion'],
  },
  {
    id: 'codificacion',
    nombre: 'Codificación de manifold y tubing',
    tipo: 'manifold',
    lados: ['descarga'],
    pasos: ['Codificar manifold', 'Codificar tubing'],
    nota: 'Después de retirar las tapas de alimentación y antes de desarmar.',
  },
  {
    id: 'retiro_manifold',
    nombre: 'Retiro de manifold',
    tipo: 'manifold',
    lados: ['descarga'],
  },
  {
    id: 'retiro_tapas_desc',
    nombre: 'Retiro de tapas · descarga',
    tipo: 'tapa',
    lados: ['descarga'],
    nota: 'Va después de retirar el manifold.',
  },
  {
    id: 'retiro_membrana',
    sinLado: true,
    nombre: 'Retiro de membrana',
    tipo: 'simple',
    lados: ['alimentacion'],
  },
  {
    id: 'limpieza_interior',
    nombre: 'Limpieza de vasija interior',
    tipo: 'simple',
    lados: ['alimentacion', 'descarga'],
  },
  {
    id: 'instalacion_tapas_desc',
    nombre: 'Instalación de tapas · descarga',
    tipo: 'tapa',
    lados: ['descarga'],
  },
  {
    id: 'carguio_membrana',
    sinLado: true,
    nombre: 'Carguío de membrana',
    tipo: 'simple',
    lados: ['alimentacion'],
  },
  {
    id: 'instalacion_tapas_alim',
    nombre: 'Instalación de tapas · alimentación',
    tipo: 'tapa',
    lados: ['alimentacion'],
    pasos: ['Graduación de shim (mm)', 'Instalación de tapa'],
    nota: 'Lleva tapón al centro y se anota el shim en milímetros.',
  },
  {
    id: 'cambio_venteo',
    nombre: 'Cambio de venteo de baja y alta',
    tipo: 'venteo',
    lados: ['alimentacion', 'descarga'],
    libre: true,
    nota: 'Se puede hacer en cualquier momento.',
  },
  {
    id: 'prueba_baja',
    nombre: 'Prueba de baja',
    tipo: 'fugas',
    lados: ['alimentacion', 'descarga'],
    nota: 'Fugas: tapón, tapa, interconector de membrana y venteo.',
  },
  {
    id: 'limpieza_exterior',
    nombre: 'Limpieza exterior de vasijas',
    tipo: 'simple',
    lados: ['alimentacion', 'descarga'],
  },
  {
    id: 'instalacion_manifold',
    nombre: 'Instalación de manifold',
    tipo: 'manifold',
    lados: ['descarga'],
    pasos: ['Stub end', 'Manifold completo', 'Tubing en cada brazo'],
    nota: 'En ese orden. El tubing va detrás de cada brazo.',
  },
  {
    id: 'chequeo_general',
    nombre: 'Chequeo general',
    tipo: 'manifold',
    lados: ['descarga'],
    libre: true,
    nota: 'Control de calidad: americanas (o-ring, hilos) y manguera. No frena al resto.',
  },
  {
    id: 'prueba_alta',
    nombre: 'Prueba de alta',
    tipo: 'fugas',
    lados: ['alimentacion', 'descarga'],
    nota: 'Como la de baja, más manifold, stub end, tubing y venteo.',
  },
  {
    id: 'entrega_rack',
    nombre: 'Entrega de rack',
    tipo: 'simple',
    lados: ['alimentacion'],
    nota: 'Retiro de membranas y house keeping.',
  },
]

/** Cuántos ítems tiene una actividad (para calcular su avance). */
export function itemsDe(a: Actividad): number {
  if (a.tipo === 'venteo') return VENTEOS.filter((v) => a.lados.includes(v.lado)).length
  const porLado = a.tipo === 'manifold' ? MANIFOLDS_POR_LADO : TOTAL_VASIJAS
  return porLado * a.lados.length
}

/** Diagramas ya construidos. El resto se muestra pero todavía no se puede abrir. */
// 'fugas' NO se enlaza al módulo de fugas existente: ese es del rack completo
// y marca otros componentes. Las pruebas de baja y alta llevan diagrama propio.
export const TIPOS_LISTOS: TipoDiagrama[] = ['tapa', 'venteo', 'simple', 'manifold']

// --- los 6 venteos del rack ---
// 2 en alimentación (uno por semi rack, al medio), 2 en descarga, y 2 más
// de baja presión también en descarga (uno por semi rack).
export interface Venteo {
  id: string
  lado: LadoRack
  semiRack: 'A' | 'B'
  presion: 'alta' | 'baja'
}

export const VENTEOS: Venteo[] = [
  { id: 'alim-A-alta', lado: 'alimentacion', semiRack: 'A', presion: 'alta' },
  { id: 'alim-B-alta', lado: 'alimentacion', semiRack: 'B', presion: 'alta' },
  { id: 'desc-A-alta', lado: 'descarga', semiRack: 'A', presion: 'alta' },
  { id: 'desc-B-alta', lado: 'descarga', semiRack: 'B', presion: 'alta' },
  { id: 'desc-A-baja', lado: 'descarga', semiRack: 'A', presion: 'baja' },
  { id: 'desc-B-baja', lado: 'descarga', semiRack: 'B', presion: 'baja' },
]

/** Actividad bloqueada: falta terminar alguna secuencial anterior. */
export function estaBloqueada(i: number, avance: (id: string) => number): boolean {
  const a = ACTIVIDADES[i]
  if (a.libre) return false
  return ACTIVIDADES.slice(0, i).some((prev) => !prev.libre && avance(prev.id) < 100)
}

// --- layout de los 40 manifolds ---
// 10 filas (cada manifold cubre dos filas de vasijas) × 4 columnas.
// Las columnas 1 y 4 van en los extremos; 2 y 3 al centro, pegadas al hueco.
// Verificado contra "Manifold pvc lado descarga enumerados.pdf".
export const FILAS_MANIFOLD = ['A', 'BC', 'DE', 'FG', 'HI', 'JK', 'LM', 'NO', 'PQ', 'RS'] as const

export interface CeldaManifold { fila: string; col: number; id: string }

export const MANIFOLDS: CeldaManifold[] = FILAS_MANIFOLD.flatMap((f) =>
  [1, 2, 3, 4].map((c) => ({ fila: f, col: c, id: `${f}${c}` })),
)
