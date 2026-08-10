// Catálogo del Outage del Rack 12: qué actividades hay, en qué orden van y
// con qué diagrama se marca cada una.
//
// Fuente: hojas manuscritas de Brayan (29-07-2026) + planos de Planificación.
// El orden del array ES el orden de ejecución. Las marcadas `libre: true` se
// pueden hacer en cualquier momento sin frenar la secuencia.
import { TOTAL_VASIJAS } from './rackLayout'
import type { DatosManifold, LadoRack } from './types'
import { ARQUETIPOS, ARQUETIPO_DE, type FilaTubing } from './manifoldDetalle'

export type TipoDiagrama =
  | 'manifold'   // los 40 manifolds (10 filas × 4)
  | 'tapa'       // plano de 295 con seguros y pernos
  | 'simple'     // plano de 295, se marca hecho / no hecho
  | 'fugas'      // plano de 295 marcando el componente que filtra
  | 'venteo'     // los 6 venteos del rack

// --- pruebas de presión: dónde puede aparecer una fuga ---
export type ComponentePrueba =
  | 'tapon' | 'tapa' | 'interconector' | 'venteo' | 'manifold' | 'stubend' | 'tubing'

export interface ComponentePruebaDef {
  codigo: ComponentePrueba
  nombre: string
  /** 'vasija' = hay uno por vasija · 'rack' = son piezas sueltas del rack. */
  donde: 'vasija' | 'rack'
  /** Lados donde existe la pieza. El manifold y su tubing solo van en descarga. */
  lados: LadoRack[]
  detalle: string
}

const AMBOS: LadoRack[] = ['alimentacion', 'descarga']

export const COMPONENTES_PRUEBA: ComponentePruebaDef[] = [
  { codigo: 'tapon', nombre: 'Tapón', donde: 'vasija', lados: AMBOS, detalle: 'Al centro de la tapa' },
  { codigo: 'tapa', nombre: 'Tapa', donde: 'vasija', lados: AMBOS, detalle: 'O-ring o sello de la tapa' },
  { codigo: 'interconector', nombre: 'Interconector', donde: 'vasija', lados: AMBOS, detalle: 'Unión entre membranas' },
  { codigo: 'venteo', nombre: 'Venteo', donde: 'rack', lados: AMBOS, detalle: 'Venteos del semi rack' },
  { codigo: 'manifold', nombre: 'Manifold', donde: 'vasija', lados: ['descarga'], detalle: 'Barra PVC o su brazo' },
  { codigo: 'stubend', nombre: 'Stub end', donde: 'vasija', lados: ['descarga'], detalle: 'Extremo del tubing' },
  { codigo: 'tubing', nombre: 'Tubing', donde: 'vasija', lados: ['descarga'], detalle: 'Manguera del brazo' },
]

/** La de baja revisa lo básico; la de alta suma el manifold ya instalado. */
const EN_BAJA: ComponentePrueba[] = ['tapon', 'tapa', 'interconector', 'venteo']

export function componentesDe(
  actividad: string, lado: LadoRack, donde: 'vasija' | 'rack',
): ComponentePruebaDef[] {
  return COMPONENTES_PRUEBA.filter(
    (c) => (actividad === 'prueba_alta' || EN_BAJA.includes(c.codigo))
      && c.lados.includes(lado) && c.donde === donde,
  )
}

/** Venteos que se revisan en un lado. */
export function venteosDe(lado: LadoRack): Venteo[] {
  return VENTEOS.filter((v) => v.lado === lado)
}

/** Piezas que se marcan una por una dentro de un manifold. */
export type ParteManifold = 'stubend' | 'manifold' | 'tubing'

export const NOMBRE_PARTE: Record<ParteManifold, string> = {
  stubend: 'Stub end',
  manifold: 'Manifold',
  tubing: 'Tubing',
}

export interface Actividad {
  id: string
  nombre: string
  tipo: TipoDiagrama
  /** Lados sobre los que se ejecuta. */
  lados: LadoRack[]
  /** Sub-pasos dentro de la actividad, en orden. */
  pasos?: string[]
  /** Piezas del manifold que lleva esta actividad. Con `partes`, tocar un
      manifold abre su detalle en vez de marcarlo entero de una. */
  partes?: ParteManifold[]
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
    partes: ['manifold', 'tubing'],
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
    partes: ['stubend', 'manifold', 'tubing'],
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
  // la prueba revisa las vasijas del lado más los venteos de ese lado
  if (a.tipo === 'fugas') {
    return a.lados.reduce((n, l) => n + TOTAL_VASIJAS + venteosDe(l).length, 0)
  }
  // con piezas, el ítem es la pieza y no el manifold: instalar los 295 stub end
  // es trabajo real y tiene que verse en la barra
  if (a.partes) return a.lados.length * piezasPorLado(a.partes)
  const porLado = a.tipo === 'manifold' ? MANIFOLDS_POR_LADO : TOTAL_VASIJAS
  return porLado * a.lados.length
}

/** Piezas que suman los 40 manifolds de un lado para estas partes. */
export function piezasPorLado(partes: ParteManifold[]): number {
  return MANIFOLDS.reduce((n, m) => n + resumirManifold(m.id, partes, {}).total, 0)
}

/** Diagramas ya construidos. El resto se muestra pero todavía no se puede abrir. */
// 'fugas' NO se enlaza al módulo de fugas existente: ese es del rack completo
// y marca otros componentes. Las pruebas de baja y alta llevan diagrama propio.
export const TIPOS_LISTOS: TipoDiagrama[] = ['tapa', 'venteo', 'simple', 'manifold', 'fugas']

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

// --- geometría del plano real de manifolds ---
// El diagrama que se muestra en la app ES el plano de Planificación
// ("Manifold pvc lado descarga enumerados.pdf") recortado a x 55-715, y 55-712,
// que es el recorte donde entran las 40 etiquetas completas.
// Sobre esa imagen van las zonas tocables, una por manifold.
export const PLANO_MF = { ancho: 660, alto: 657 }

/** y del centro de cada fila, ya trasladada al recorte. */
const Y_FILA: Record<string, number> = {
  A: 75, BC: 118, DE: 174, FG: 227, HI: 280, JK: 347, LM: 401, NO: 454, PQ: 512, RS: 564,
}

// Las dos columnas verdes del plano están en x 217-237 y 533-552 (originales).
// Cada barra va entre el borde del dibujo y su columna verde.
const X_COL: Record<number, [number, number]> = {
  1: [37, 162],   // 92-217 en el PDF (borde izq → columna verde B)
  2: [182, 303],  // 237-358 (columna verde B → centro)
  3: [350, 478],  // 405-533 (centro → columna verde A)
  4: [497, 627],  // 552-682 (columna verde A → borde der)
}

/**
 * A qué vasija le corresponde cada pieza del manifold.
 *
 * El plano de manifolds es LADO DESCARGA: de izquierda a derecha corren las
 * posiciones 1-16 y la vasija de la posición p es la columna 17-p (por eso el
 * Semi Rack B queda a la izquierda, igual que en el plano de tapas espejado).
 * Cada manifold cubre 4 posiciones y, si su fila son dos letras, la de arriba
 * es la primera. Verificado contra el PDF: las 295 piezas celestes y las 295
 * ámbar caen exactamente sobre las 295 vasijas del rack.
 */
export function vasijaDeParte(manifold: string, brazo: number, fila: FilaTubing): string {
  const letras = manifold.slice(0, -1)
  const col = Number(manifold.slice(-1))
  const columna = 17 - ((col - 1) * 4 + brazo + 1)
  const letra = letras.length === 1 ? letras : fila === 'arriba' ? letras[0] : letras[1]
  return `${letra}${columna}`
}

export interface VasijaDeManifold { vasija: string; brazo: number; fila: FilaTubing }

/** Las vasijas que cuelgan de un manifold, leídas como el plano: brazo por
    brazo de izquierda a derecha y, dentro de cada uno, la de arriba primero. */
export function vasijasDeManifold(manifold: string): VasijaDeManifold[] {
  return ARQUETIPOS[ARQUETIPO_DE[manifold]].tubing
    .map((z) => ({ vasija: vasijaDeParte(manifold, z.brazo, z.fila), brazo: z.brazo, fila: z.fila }))
    .sort((a, b) => a.brazo - b.brazo || (a.fila === 'arriba' ? -1 : 1))
}

export interface ResumenManifold { total: number; hechas: number; completo: boolean }

/** Cuántas piezas lleva el manifold en esta actividad y cuántas van puestas. */
export function resumirManifold(
  manifold: string, partes: ParteManifold[], datos: DatosManifold,
): ResumenManifold {
  const vasijas = vasijasDeManifold(manifold).map((v) => v.vasija)
  let total = 0, hechas = 0
  for (const parte of partes) {
    if (parte === 'manifold') {
      total += 1
      if (datos.manifold) hechas += 1
      continue
    }
    // se cruza contra las vasijas reales: así un dato viejo no infla el avance
    total += vasijas.length
    hechas += vasijas.filter((v) => datos[parte]?.includes(v)).length
  }
  return { total, hechas, completo: total > 0 && hechas === total }
}

export interface ZonaManifold { id: string; x: number; y: number; w: number; h: number }

export const ZONAS_MANIFOLD: ZonaManifold[] = MANIFOLDS.map((m) => {
  const [x0, x1] = X_COL[m.col]
  const yc = Y_FILA[m.fila]
  return { id: m.id, x: x0, y: yc - 19, w: x1 - x0, h: 38 }
})
