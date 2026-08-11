// GENERADO por scripts/gen_manifold.py — no editar a mano.
// Fuente: "Manifold pvc lado descarga enumerados.pdf" (Planificación).
//
// El dibujo del detalle es el recorte del plano; estas son las zonas tocables,
// sacadas de la geometría vectorial del PDF (ámbar = stub end, celeste =
// tubing). Los 40 manifolds se dibujan igual salvo qué vasijas existen en su
// fila y de qué lado queda la columna verde, así que 7 recortes alcanzan.
// Todas las medidas van en puntos del PDF, con el origen arriba a la izquierda
// del recorte.

export const TILE = { w: 145.0, h: 53.0, n: 7 }
export const SPRITE = './manifold_detalle.png'

export type FilaTubing = 'arriba' | 'abajo'

/** Una pieza tocable. `brazo` 0-3 va de izquierda a derecha en el plano. */
export interface ZonaParte {
  fila: FilaTubing
  brazo: number
  x: number; y: number; w: number; h: number
}

export interface Arquetipo {
  /** Fila que ocupa dentro de la tira. */
  i: number
  /** Cuerpo central del manifold. */
  barra: [number, number, number, number]
  stubend: ZonaParte[]
  /** El brazo va al cuerpo central del manifold. Hoy NO se marca: se deja
      dibujado y ubicado por si más adelante hay que registrarlo. */
  brazo: ZonaParte[]
  /** El tubing es la manguerita del extremo, no la barra celeste. */
  tubing: ZonaParte[]
}

export const ARQUETIPOS: Record<string, Arquetipo> = {
  'tipo1': {
    i: 0,
    barra: [18.0, 23.0, 112.8, 7.08],
    stubend: [
      { fila: 'abajo', brazo: 1, x: 46.44, y: 39.8, w: 3.96, h: 5.88 },
      { fila: 'abajo', brazo: 2, x: 73.32, y: 39.56, w: 3.84, h: 5.76 },
      { fila: 'abajo', brazo: 3, x: 98.88, y: 40.04, w: 3.84, h: 5.88 },
    ],
    brazo: [
      { fila: 'abajo', brazo: 1, x: 50.4, y: 36.08, w: 14.52, h: 8.28 },
      { fila: 'abajo', brazo: 2, x: 77.4, y: 35.72, w: 14.28, h: 8.28 },
      { fila: 'abajo', brazo: 3, x: 102.84, y: 35.6, w: 14.64, h: 8.28 },
    ],
    tubing: [
      { fila: 'abajo', brazo: 1, x: 62.28, y: 44.84, w: 4.68, h: 4.8 },
      { fila: 'abajo', brazo: 2, x: 88.56, y: 44.6, w: 4.68, h: 4.8 },
      { fila: 'abajo', brazo: 3, x: 114.72, y: 44.48, w: 4.68, h: 4.8 },
    ],
  },
  'tipo2': {
    i: 1,
    barra: [18.0, 23.0, 113.64, 7.2],
    stubend: [
      { fila: 'abajo', brazo: 0, x: 19.68, y: 40.4, w: 3.84, h: 5.52 },
      { fila: 'abajo', brazo: 1, x: 47.28, y: 40.28, w: 3.84, h: 5.52 },
      { fila: 'abajo', brazo: 2, x: 73.32, y: 39.56, w: 3.96, h: 5.88 },
    ],
    brazo: [
      { fila: 'abajo', brazo: 0, x: 23.52, y: 36.2, w: 15.0, h: 8.28 },
      { fila: 'abajo', brazo: 1, x: 51.12, y: 36.2, w: 13.8, h: 8.28 },
      { fila: 'abajo', brazo: 2, x: 77.52, y: 35.84, w: 15.0, h: 8.28 },
    ],
    tubing: [
      { fila: 'abajo', brazo: 0, x: 36.24, y: 45.08, w: 4.68, h: 4.56 },
      { fila: 'abajo', brazo: 1, x: 63.0, y: 45.08, w: 4.32, h: 4.68 },
      { fila: 'abajo', brazo: 2, x: 89.28, y: 44.96, w: 4.8, h: 4.56 },
    ],
  },
  'tipo3': {
    i: 2,
    barra: [18.0, 23.0, 112.92, 7.2],
    stubend: [
      { fila: 'abajo', brazo: 0, x: 19.68, y: 39.44, w: 3.96, h: 6.48 },
      { fila: 'abajo', brazo: 1, x: 46.56, y: 39.2, w: 3.96, h: 6.6 },
      { fila: 'abajo', brazo: 2, x: 73.44, y: 38.84, w: 3.84, h: 6.6 },
      { fila: 'abajo', brazo: 3, x: 98.88, y: 39.44, w: 3.96, h: 6.48 },
      { fila: 'arriba', brazo: 1, x: 45.96, y: 7.4, w: 3.84, h: 5.76 },
      { fila: 'arriba', brazo: 2, x: 72.36, y: 7.28, w: 3.84, h: 5.64 },
      { fila: 'arriba', brazo: 3, x: 99.12, y: 6.92, w: 3.96, h: 6.48 },
    ],
    brazo: [
      { fila: 'abajo', brazo: 0, x: 23.64, y: 36.2, w: 14.16, h: 8.28 },
      { fila: 'abajo', brazo: 1, x: 50.4, y: 36.2, w: 14.64, h: 8.28 },
      { fila: 'abajo', brazo: 2, x: 77.52, y: 35.84, w: 14.28, h: 8.28 },
      { fila: 'abajo', brazo: 3, x: 102.96, y: 35.72, w: 14.52, h: 8.28 },
      { fila: 'arriba', brazo: 1, x: 50.04, y: 8.72, w: 14.64, h: 8.16 },
      { fila: 'arriba', brazo: 2, x: 76.68, y: 8.6, w: 14.16, h: 8.16 },
      { fila: 'arriba', brazo: 3, x: 103.32, y: 8.24, w: 14.52, h: 8.16 },
    ],
    tubing: [
      { fila: 'abajo', brazo: 0, x: 35.64, y: 44.48, w: 4.68, h: 5.16 },
      { fila: 'abajo', brazo: 1, x: 62.4, y: 44.6, w: 4.68, h: 5.16 },
      { fila: 'abajo', brazo: 2, x: 88.68, y: 44.36, w: 4.68, h: 5.16 },
      { fila: 'abajo', brazo: 3, x: 114.84, y: 44.24, w: 4.68, h: 5.16 },
      { fila: 'arriba', brazo: 1, x: 61.8, y: 3.32, w: 4.8, h: 4.8 },
      { fila: 'arriba', brazo: 2, x: 88.2, y: 3.2, w: 4.68, h: 5.16 },
      { fila: 'arriba', brazo: 3, x: 115.08, y: 2.84, w: 4.68, h: 5.16 },
    ],
  },
  'tipo4': {
    i: 3,
    barra: [18.0, 23.0, 113.52, 6.72],
    stubend: [
      { fila: 'abajo', brazo: 0, x: 19.68, y: 38.96, w: 3.84, h: 6.6 },
      { fila: 'abajo', brazo: 1, x: 47.28, y: 38.84, w: 3.84, h: 6.6 },
      { fila: 'abajo', brazo: 2, x: 73.32, y: 38.48, w: 3.84, h: 6.6 },
      { fila: 'abajo', brazo: 3, x: 99.6, y: 39.08, w: 3.84, h: 6.48 },
      { fila: 'arriba', brazo: 0, x: 19.08, y: 7.28, w: 3.84, h: 5.76 },
      { fila: 'arriba', brazo: 1, x: 46.56, y: 7.04, w: 3.96, h: 5.76 },
      { fila: 'arriba', brazo: 2, x: 72.24, y: 6.8, w: 3.96, h: 5.76 },
    ],
    brazo: [
      { fila: 'abajo', brazo: 0, x: 23.52, y: 36.2, w: 15.0, h: 7.92 },
      { fila: 'abajo', brazo: 1, x: 51.12, y: 36.2, w: 14.16, h: 7.8 },
      { fila: 'abajo', brazo: 2, x: 77.4, y: 35.84, w: 15.0, h: 7.92 },
      { fila: 'abajo', brazo: 3, x: 103.56, y: 35.72, w: 13.92, h: 7.8 },
      { fila: 'arriba', brazo: 0, x: 23.28, y: 8.6, w: 15.0, h: 8.16 },
      { fila: 'arriba', brazo: 1, x: 50.76, y: 8.36, w: 14.52, h: 8.16 },
      { fila: 'arriba', brazo: 2, x: 76.56, y: 8.12, w: 15.0, h: 8.16 },
    ],
    tubing: [
      { fila: 'abajo', brazo: 0, x: 36.24, y: 43.88, w: 4.68, h: 4.92 },
      { fila: 'abajo', brazo: 1, x: 63.0, y: 44.0, w: 4.32, h: 4.92 },
      { fila: 'abajo', brazo: 2, x: 89.28, y: 43.76, w: 4.68, h: 5.04 },
      { fila: 'abajo', brazo: 3, x: 114.72, y: 44.0, w: 4.68, h: 5.4 },
      { fila: 'arriba', brazo: 0, x: 35.16, y: 3.32, w: 4.92, h: 4.8 },
      { fila: 'arriba', brazo: 1, x: 62.52, y: 2.96, w: 4.32, h: 4.8 },
      { fila: 'arriba', brazo: 2, x: 88.8, y: 2.84, w: 4.68, h: 4.92 },
    ],
  },
  'tipo5': {
    i: 4,
    barra: [18.0, 23.0, 113.28, 7.08],
    stubend: [
      { fila: 'abajo', brazo: 0, x: 19.68, y: 39.32, w: 3.96, h: 6.12 },
      { fila: 'abajo', brazo: 1, x: 46.92, y: 39.08, w: 3.84, h: 6.24 },
      { fila: 'abajo', brazo: 2, x: 73.44, y: 38.84, w: 3.84, h: 6.12 },
      { fila: 'arriba', brazo: 0, x: 19.08, y: 7.28, w: 3.96, h: 6.12 },
      { fila: 'arriba', brazo: 1, x: 46.32, y: 6.92, w: 3.84, h: 6.12 },
      { fila: 'arriba', brazo: 2, x: 72.36, y: 6.8, w: 3.96, h: 6.12 },
    ],
    brazo: [
      { fila: 'abajo', brazo: 0, x: 23.52, y: 36.08, w: 14.52, h: 7.92 },
      { fila: 'abajo', brazo: 1, x: 50.76, y: 36.08, w: 14.16, h: 7.92 },
      { fila: 'abajo', brazo: 2, x: 77.52, y: 35.72, w: 14.64, h: 7.92 },
      { fila: 'arriba', brazo: 0, x: 23.4, y: 8.6, w: 14.52, h: 8.52 },
      { fila: 'arriba', brazo: 1, x: 50.4, y: 8.24, w: 14.64, h: 8.52 },
      { fila: 'arriba', brazo: 2, x: 76.68, y: 8.12, w: 14.52, h: 8.52 },
    ],
    tubing: [
      { fila: 'abajo', brazo: 0, x: 35.88, y: 44.24, w: 4.68, h: 4.92 },
      { fila: 'abajo', brazo: 1, x: 62.76, y: 44.24, w: 4.44, h: 5.04 },
      { fila: 'abajo', brazo: 2, x: 89.04, y: 44.12, w: 4.68, h: 4.92 },
      { fila: 'arriba', brazo: 0, x: 34.8, y: 3.56, w: 4.92, h: 4.8 },
      { fila: 'arriba', brazo: 1, x: 62.16, y: 3.32, w: 4.56, h: 4.8 },
      { fila: 'arriba', brazo: 2, x: 88.56, y: 3.08, w: 4.68, h: 4.92 },
    ],
  },
  'tipo6': {
    i: 5,
    barra: [18.0, 23.0, 112.8, 7.08],
    stubend: [
      { fila: 'abajo', brazo: 0, x: 19.68, y: 40.04, w: 3.84, h: 5.76 },
      { fila: 'abajo', brazo: 1, x: 46.44, y: 39.8, w: 3.96, h: 5.88 },
      { fila: 'abajo', brazo: 2, x: 73.32, y: 39.56, w: 3.84, h: 5.76 },
      { fila: 'abajo', brazo: 3, x: 98.88, y: 40.04, w: 3.84, h: 5.88 },
      { fila: 'arriba', brazo: 0, x: 19.08, y: 7.64, w: 3.84, h: 6.48 },
      { fila: 'arriba', brazo: 1, x: 45.84, y: 7.28, w: 3.84, h: 6.48 },
      { fila: 'arriba', brazo: 2, x: 72.24, y: 7.16, w: 3.96, h: 6.48 },
      { fila: 'arriba', brazo: 3, x: 99.0, y: 6.8, w: 3.96, h: 6.48 },
    ],
    brazo: [
      { fila: 'abajo', brazo: 0, x: 23.52, y: 36.08, w: 14.16, h: 8.28 },
      { fila: 'abajo', brazo: 1, x: 50.4, y: 36.08, w: 14.52, h: 8.28 },
      { fila: 'abajo', brazo: 2, x: 77.4, y: 35.72, w: 14.28, h: 8.28 },
      { fila: 'abajo', brazo: 3, x: 102.84, y: 35.6, w: 14.64, h: 8.28 },
      { fila: 'arriba', brazo: 0, x: 23.28, y: 8.96, w: 14.28, h: 8.88 },
      { fila: 'arriba', brazo: 1, x: 49.92, y: 8.6, w: 14.64, h: 8.88 },
      { fila: 'arriba', brazo: 2, x: 76.56, y: 8.48, w: 14.16, h: 8.88 },
      { fila: 'arriba', brazo: 3, x: 103.2, y: 8.12, w: 14.52, h: 8.88 },
    ],
    tubing: [
      { fila: 'abajo', brazo: 0, x: 35.52, y: 44.72, w: 4.68, h: 4.8 },
      { fila: 'abajo', brazo: 1, x: 62.28, y: 44.84, w: 4.68, h: 4.8 },
      { fila: 'abajo', brazo: 2, x: 88.56, y: 44.6, w: 4.68, h: 4.8 },
      { fila: 'abajo', brazo: 3, x: 114.72, y: 44.48, w: 4.68, h: 4.8 },
      { fila: 'arriba', brazo: 0, x: 35.04, y: 4.28, w: 4.56, h: 4.8 },
      { fila: 'arriba', brazo: 1, x: 61.8, y: 3.92, w: 4.68, h: 4.8 },
      { fila: 'arriba', brazo: 2, x: 88.08, y: 3.8, w: 4.68, h: 4.8 },
      { fila: 'arriba', brazo: 3, x: 114.96, y: 3.44, w: 4.68, h: 4.8 },
    ],
  },
  'tipo7': {
    i: 6,
    barra: [18.0, 23.0, 113.64, 7.2],
    stubend: [
      { fila: 'abajo', brazo: 0, x: 19.68, y: 40.4, w: 3.84, h: 5.52 },
      { fila: 'abajo', brazo: 1, x: 47.28, y: 40.28, w: 3.84, h: 5.52 },
      { fila: 'abajo', brazo: 2, x: 73.32, y: 39.56, w: 3.96, h: 5.88 },
      { fila: 'abajo', brazo: 3, x: 99.6, y: 40.52, w: 3.96, h: 5.4 },
      { fila: 'arriba', brazo: 0, x: 19.08, y: 7.76, w: 3.84, h: 6.36 },
      { fila: 'arriba', brazo: 1, x: 46.68, y: 7.4, w: 3.84, h: 6.48 },
      { fila: 'arriba', brazo: 2, x: 72.36, y: 7.28, w: 3.84, h: 6.36 },
      { fila: 'arriba', brazo: 3, x: 99.84, y: 6.92, w: 3.84, h: 6.48 },
    ],
    brazo: [
      { fila: 'abajo', brazo: 0, x: 23.52, y: 36.2, w: 15.0, h: 8.28 },
      { fila: 'abajo', brazo: 1, x: 51.12, y: 36.2, w: 13.92, h: 8.28 },
      { fila: 'abajo', brazo: 2, x: 77.52, y: 35.84, w: 15.0, h: 8.28 },
      { fila: 'abajo', brazo: 3, x: 103.68, y: 35.72, w: 13.8, h: 8.28 },
      { fila: 'arriba', brazo: 0, x: 23.4, y: 9.08, w: 15.0, h: 9.24 },
      { fila: 'arriba', brazo: 1, x: 50.76, y: 8.72, w: 13.8, h: 9.24 },
      { fila: 'arriba', brazo: 2, x: 76.56, y: 8.6, w: 15.0, h: 9.24 },
      { fila: 'arriba', brazo: 3, x: 103.92, y: 8.24, w: 13.92, h: 9.24 },
    ],
    tubing: [
      { fila: 'abajo', brazo: 0, x: 36.24, y: 45.08, w: 4.8, h: 4.56 },
      { fila: 'abajo', brazo: 1, x: 63.0, y: 45.08, w: 4.32, h: 4.68 },
      { fila: 'abajo', brazo: 2, x: 89.4, y: 44.96, w: 4.68, h: 4.56 },
      { fila: 'abajo', brazo: 3, x: 114.72, y: 44.84, w: 4.68, h: 4.56 },
      { fila: 'arriba', brazo: 0, x: 35.88, y: 4.76, w: 4.56, h: 4.56 },
      { fila: 'arriba', brazo: 1, x: 62.52, y: 4.4, w: 4.32, h: 4.68 },
      { fila: 'arriba', brazo: 2, x: 88.8, y: 4.28, w: 4.68, h: 4.56 },
      { fila: 'arriba', brazo: 3, x: 114.96, y: 3.92, w: 4.68, h: 4.68 },
    ],
  },
}

/** Qué recorte le toca a cada manifold. */
export const ARQUETIPO_DE: Record<string, string> = {
  A1: 'tipo1',
  A2: 'tipo2',
  A3: 'tipo1',
  A4: 'tipo2',
  BC1: 'tipo3',
  BC2: 'tipo4',
  BC3: 'tipo3',
  BC4: 'tipo5',
  DE1: 'tipo6',
  DE2: 'tipo7',
  DE3: 'tipo6',
  DE4: 'tipo7',
  FG1: 'tipo6',
  FG2: 'tipo7',
  FG3: 'tipo6',
  FG4: 'tipo7',
  HI1: 'tipo6',
  HI2: 'tipo7',
  HI3: 'tipo6',
  HI4: 'tipo7',
  JK1: 'tipo6',
  JK2: 'tipo7',
  JK3: 'tipo6',
  JK4: 'tipo7',
  LM1: 'tipo6',
  LM2: 'tipo7',
  LM3: 'tipo6',
  LM4: 'tipo7',
  NO1: 'tipo6',
  NO2: 'tipo7',
  NO3: 'tipo6',
  NO4: 'tipo7',
  PQ1: 'tipo6',
  PQ2: 'tipo7',
  PQ3: 'tipo6',
  PQ4: 'tipo7',
  RS1: 'tipo6',
  RS2: 'tipo7',
  RS3: 'tipo6',
  RS4: 'tipo7',
}
