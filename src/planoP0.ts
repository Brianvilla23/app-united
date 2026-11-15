// Plano del Rack 4 de Planta 0 (Codeline 80E, 140 vasijas).
//
// Numeración del Excel "RACK PLANTA CERO": filas B-H y columnas 1-20 en cuatro
// bloques de 5 (A-1 = 1-5, A-2 = 6-10, B-1 = 11-15, B-2 = 16-20). Visto desde
// descarga queda el Semi Rack A a la izquierda (1→20); desde alimentación, el B
// (20→1). Es al revés que en los racks EWS, donde el espejado es descarga.
//
// Se dibuja como SVG en texto (y no con componentes) porque el mismo dibujo va a
// la pantalla y al PDF (`pdfDiagrama` lo vuelca tal cual), igual que PlanoRack.
//
// Dos dibujos:
//  · planoVasijas: la vasija como círculo, para las actividades de vasija
//    (membranas, limpieza, carguío, tapones, pruebas).
//  · planoPiezas: la pieza que se trabaja, con su detalle (codo inox con sus dos
//    piedmont, bajada PPR, tapa del plano Codeline). Lo retirado queda en
//    contorno punteado con un visto; lo instalado, en verde. Cada bloque tiene
//    su cabezal por fila y los dos bloques de un semi rack van soldados al
//    manifold común vertical que está entre ellos; al medio del rack no va nada.
//    Diseño acordado con Brayan el 14-11-2026.
import type { LadoRack } from './types'

export const FILAS_P0 = ['B', 'C', 'D', 'E', 'F', 'G', 'H']
export const COLUMNAS_P0 = 20
export const TOTAL_P0 = FILAS_P0.length * COLUMNAS_P0 // 140
export const VASIJAS_P0: string[] = FILAS_P0.flatMap((f) => Array.from({ length: 20 }, (_, i) => `${f}${i + 1}`))

export type VistaP0 = 'A' | 'B' | 'todo'
export type PiezaP0 = 'codo' | 'ppr' | 'tapa'
/** orig = sigue puesta · fuera = no está (retirada, o falta instalar) · nuevo = instalada · ais = vasija aislada */
export type EstadoPieza = 'orig' | 'fuera' | 'nuevo' | 'ais'
export interface ColorVasija { c: string; t: string; anillo?: boolean }

/** Posición en el plano (1-20, de izquierda a derecha) → columna real de la vasija. */
export function columnaEn(p: number, lado: LadoRack): number { return lado === 'alimentacion' ? 21 - p : p }
export function semiIzquierda(lado: LadoRack): 'A' | 'B' { return lado === 'alimentacion' ? 'B' : 'A' }
/** Orden de lectura de los semi racks en ese lado (el de la izquierda primero). */
export function ordenSemiP0(lado: LadoRack): ('A' | 'B')[] { return lado === 'alimentacion' ? ['B', 'A'] : ['A', 'B'] }
function rango(v: VistaP0, lado: LadoRack): [number, number] {
  if (v === 'todo') return [1, 20]
  return v === semiIzquierda(lado) ? [1, 10] : [11, 20]
}
function rotuloBloque(c1: number, c2: number): string {
  const mn = Math.min(c1, c2)
  return mn <= 5 ? 'A-1' : mn <= 10 ? 'A-2' : mn <= 15 ? 'B-1' : 'B-2'
}
const BLOQUES: [number, number][] = [[1, 5], [6, 10], [11, 15], [16, 20]]

function encabezado(lado: LadoRack, rg: [number, number], xc: (p: number) => number, ySemi: number, yBloque: number, fs: number): string {
  const izq = semiIzquierda(lado), der = izq === 'A' ? 'B' : 'A'
  let s = ''
  if (rg[0] <= 10) s += `<text x="${(xc(1) + xc(10)) / 2}" y="${ySemi}" text-anchor="middle" font-size="${fs}" font-weight="800" fill="#0f172a">SEMI RACK ${izq}</text>`
  if (rg[1] >= 11) s += `<text x="${(xc(11) + xc(20)) / 2}" y="${ySemi}" text-anchor="middle" font-size="${fs}" font-weight="800" fill="#0f172a">SEMI RACK ${der}</text>`
  for (const [a, b] of BLOQUES) {
    if (b < rg[0] || a > rg[1]) continue
    const c1 = columnaEn(a, lado), c2 = columnaEn(b, lado)
    s += `<text x="${(xc(a) + xc(b)) / 2}" y="${yBloque}" text-anchor="middle" font-size="${fs - 3}" font-weight="700" fill="#94a3b8">${rotuloBloque(c1, c2)} · ${c1}–${c2}</text>`
  }
  return s
}

// ---------------------------------------------------------------- vasijas
const CELL = 48, CELLX = 60, R = 19, MX = 26, MY = 52, GB = 26, GS = 54
function exV(p: number): number { let e = 0; if (p > 5) e += GB; if (p > 10) e += GS; if (p > 15) e += GB; return e }
function cxV(p: number): number { return MX + (p - 1) * CELLX + exV(p) + CELLX / 2 }
function cyV(i: number): number { return MY + i * CELL + CELL / 2 }
export const ANCHO_V = MX + 20 * CELLX + 2 * GB + GS + 14
export const ALTO_V = MY + FILAS_P0.length * CELL + 34
const VERDE = '#0e9f6e', GRIS = '#c3cad3', GRIS_B = '#9aa5b1'

export function planoVasijas(
  lado: LadoRack, v: VistaP0, color: (id: string) => ColorVasija | null, paraPdf = false,
): string {
  const rg = rango(v, lado)
  const x0 = v === 'todo' ? 0 : cxV(rg[0]) - R - 30, x1 = v === 'todo' ? ANCHO_V : cxV(rg[1]) + R + 16
  let s = `<svg viewBox="${x0} 0 ${x1 - x0} ${ALTO_V}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto">`
  s += encabezado(lado, rg, cxV, 30, 46, 13)
  for (const p of [5, 15]) {
    if (p + 1 < rg[0] || p > rg[1]) continue
    const px = (cxV(p) + cxV(p + 1)) / 2 - 8
    s += `<rect x="${px}" y="${MY - 6}" width="16" height="${FILAS_P0.length * CELL + 14}" fill="${GRIS}" stroke="${GRIS_B}" stroke-width="0.8"/>`
  }
  s += `<rect x="${cxV(rg[0]) - R - 14}" y="${MY + FILAS_P0.length * CELL + 8}" width="${cxV(rg[1]) - cxV(rg[0]) + 2 * R + 28}" height="15" rx="7.5" fill="${GRIS}" stroke="${GRIS_B}" stroke-width="0.8"/>`
  FILAS_P0.forEach((f, i) => {
    s += `<text x="${x0 + (v === 'todo' ? 9 : 4)}" y="${cyV(i) + 4}" font-size="11" font-weight="700" fill="#64748b">${f}</text>`
    for (let p = rg[0]; p <= rg[1]; p++) {
      const id = f + columnaEn(p, lado), tc = color(id), x = cxV(p), y = cyV(i)
      s += `<g data-v="${id}"${paraPdf ? '' : ' style="cursor:pointer"'}><circle cx="${x}" cy="${y}" r="${R}" fill="${tc ? tc.c : '#fff'}" stroke="${VERDE}" stroke-width="4.2"/>`
      if (tc?.anillo) s += `<circle cx="${x}" cy="${y}" r="9.5" fill="#f0b400" stroke="#8a6d03"/>`
      s += `<text x="${x}" y="${y + 4.5}" text-anchor="middle" font-size="${paraPdf ? 13.5 : 10.5}" font-weight="700" fill="${tc ? tc.t : '#0f172a'}">${id}</text></g>`
    }
  })
  return s + '</svg>'
}

// ---------------------------------------------------------------- piezas
const K = 1.25, CX2 = 88, CY2 = 122, MY2 = 62, GB2 = 34, GS2 = 70
function ex2(p: number): number { let e = 0; if (p > 5) e += GB2; if (p > 10) e += GS2; if (p > 15) e += GB2; return e }
function px2(p: number): number { return MX + (p - 1) * CX2 + ex2(p) + CX2 / 2 }
function py2(i: number): number { return MY2 + i * CY2 + 80 }
export const ANCHO_P = MX + 20 * CX2 + 2 * GB2 + GS2 + 14
export const ALTO_P = MY2 + FILAS_P0.length * CY2 + 64

function visto(x: number, y: number, color: string): string {
  return `<g><circle cx="${x}" cy="${y}" r="6.5" fill="${color}" stroke="#fff" stroke-width="1.5"/><path d="M${x - 3} ${y} l2 2.4 l4 -4.6" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`
}
interface ColInox { tubo: string; borde: string; luz: string; ac: string; acL: string }
const INOX: ColInox = { tubo: '#9eabba', borde: '#3f4a57', luz: '#dde3ea', ac: '#2f3842', acL: '#7d8896' }
const INOX_N: ColInox = { tubo: '#4ade80', borde: '#166534', luz: '#bbf7d0', ac: '#14532d', acL: '#86efac' }
function acople(x: number, y: number, c: ColInox): string {
  return `<g><rect x="${x - 9}" y="${y - 3.5}" width="18" height="7" rx="2" fill="${c.ac}"/><line x1="${x - 9}" y1="${y}" x2="${x + 9}" y2="${y}" stroke="${c.acL}" stroke-width="0.8"/><rect x="${x - 13}" y="${y - 2}" width="4" height="4" rx="1" fill="${c.ac}"/><rect x="${x + 9}" y="${y - 2}" width="4" height="4" rx="1" fill="${c.ac}"/></g>`
}

/** Codo inox visto de frente: baja de su salida en el cabezal (piedmont superior)
    y en la tapa dobla hacia adentro sobre el puerto feed/conc. (piedmont inferior). */
export function codoSVG(x: number, y: number, st: EstadoPieza, tenue: boolean, conVisto: boolean): string {
  if (st === 'ais') return ''
  const top = y - 44, yb = y - 8
  if (st === 'fuera') {
    return `<g opacity="${tenue ? 0.12 : 1}"><rect x="${x - 4.5}" y="${top}" width="9" height="${yb - top}" rx="4.5" fill="#eef1f5" stroke="#64748b" stroke-width="1.4" stroke-dasharray="3.5 2.5"/>`
      + `<circle cx="${x}" cy="${yb}" r="6.5" fill="#eef1f5" stroke="#64748b" stroke-width="1.4" stroke-dasharray="3 2"/>`
      + `<rect x="${x - 9}" y="${top + 5}" width="18" height="6" rx="2" fill="none" stroke="#64748b" stroke-width="1.1" stroke-dasharray="2.5 2"/>`
      + (conVisto && !tenue ? visto(x + 14, top + 16, '#475569') : '') + '</g>'
  }
  const c = st === 'nuevo' ? INOX_N : INOX
  return `<g opacity="${tenue ? 0.14 : 1}">`
    + `<path d="M${x} ${top} V${yb}" stroke="${c.borde}" stroke-width="10" stroke-linecap="round"/>`
    + `<path d="M${x} ${top} V${yb}" stroke="${c.tubo}" stroke-width="7" stroke-linecap="round"/>`
    + `<path d="M${x - 1.6} ${top + 2} V${yb - 4}" stroke="${c.luz}" stroke-width="1.6" stroke-linecap="round"/>`
    + acople(x, top + 8, c)
    + `<circle cx="${x}" cy="${yb}" r="7.5" fill="${c.tubo}" stroke="${c.borde}" stroke-width="2"/>`
    + `<circle cx="${x}" cy="${yb}" r="7.5" fill="none" stroke="${c.ac}" stroke-width="2.6" stroke-dasharray="9 3"/>`
    + `<circle cx="${x - 2}" cy="${yb - 2}" r="1.8" fill="${c.luz}"/>`
    + (st === 'nuevo' && !tenue ? visto(x + 14, top + 16, '#16a34a') : '') + '</g>'
}

interface ColPpr { tubo: string; borde: string; luz: string; fit: string }
const PPR: ColPpr = { tubo: '#efe9dc', borde: '#8f8877', luz: '#fffdf6', fit: '#d9d0ba' }
const PPR_N: ColPpr = { tubo: '#4ade80', borde: '#166534', luz: '#bbf7d0', fit: '#22c55e' }
function hexagono(cx0: number, cy0: number, r: number, giro = Math.PI / 6): string {
  return [0, 1, 2, 3, 4, 5].map((i) => {
    const a = giro + i * Math.PI / 3
    return `${(cx0 + r * Math.cos(a)).toFixed(1)},${(cy0 + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
}

/** Bajada PPR: sale del puerto de permeado al centro de la tapa, sube en diagonal y entra al manifold PPR de la fila. */
export function pprSVG(x: number, y: number, st: EstadoPieza, tenue: boolean, conVisto: boolean): string {
  if (st === 'ais') return ''
  const ex = x + 17, ey = y - 15, my = y - 34
  const d = `M${x} ${y} L${ex} ${ey} L${ex} ${my}`
  if (st === 'fuera') {
    return `<g opacity="${tenue ? 0.12 : 1}"><path d="${d}" stroke="#f3f1ec" stroke-width="10" fill="none" stroke-linejoin="round" stroke-linecap="round"/><path d="${d}" stroke="#7c7566" stroke-width="1.5" stroke-dasharray="3.5 2.5" fill="none"/>`
      + `<circle cx="${ex}" cy="${ey}" r="6" fill="none" stroke="#7c7566" stroke-width="1.2" stroke-dasharray="2.5 2"/>`
      + (conVisto && !tenue ? visto(ex + 12, ey - 6, '#57534e') : '') + '</g>'
  }
  const c = st === 'nuevo' ? PPR_N : PPR
  return `<g opacity="${tenue ? 0.14 : 1}">`
    + `<path d="${d}" stroke="${c.borde}" stroke-width="12" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`
    + `<path d="${d}" stroke="${c.tubo}" stroke-width="8.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`
    + `<path d="M${x + 2} ${y - 3} L${ex - 1.5} ${ey - 1} M${ex - 2} ${ey - 3} L${ex - 2} ${my + 4}" stroke="${c.luz}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
    + `<rect x="${ex - 7}" y="${ey - 7}" width="14" height="14" rx="4" fill="${c.fit}" stroke="${c.borde}" stroke-width="1.2"/>`
    + `<line x1="${ex - 7}" y1="${ey}" x2="${ex + 7}" y2="${ey}" stroke="${c.borde}" stroke-width="0.8"/>`
    + `<polygon points="${hexagono(x, y, 6.5)}" fill="${c.fit}" stroke="${c.borde}" stroke-width="1.2"/>`
    + `<rect x="${ex - 8}" y="${my - 1}" width="16" height="7" rx="2" fill="${c.fit}" stroke="${c.borde}" stroke-width="1"/>`
    + (st === 'nuevo' && !tenue ? visto(ex + 12, ey - 6, '#16a34a') : '') + '</g>'
}

/** Tapa vista de frente, simple: aro de fibra, cabezal negro, puerto feed/conc. y al centro tapón (alim.) o puerto de permeado (desc.). */
function tapaSimple(x: number, y: number, lado: LadoRack, ais: boolean): string {
  return `<circle cx="${x}" cy="${y}" r="16" fill="#efe6cf" stroke="#bfb498" stroke-width="1.2"/>`
    + `<circle cx="${x}" cy="${y}" r="12.8" fill="${ais ? '#2563eb' : '#2b3038'}"/><circle cx="${x}" cy="${y}" r="11" fill="none" stroke="${ais ? '#93c5fd' : '#535a63'}" stroke-width="1"/>`
    + (lado === 'alimentacion'
      ? `<polygon points="${hexagono(x, y, 3.6, 0)}" fill="#d5dbe2"/>`
      : `<circle cx="${x}" cy="${y}" r="3.4" fill="#d6dade" stroke="#9aa2ab" stroke-width="0.8"/>`)
    + `<circle cx="${x}" cy="${y - 8}" r="3.2" fill="#a9b2bc" stroke="#6b7480" stroke-width="0.8"/>`
}

/** Tapa con su detalle (plano Codeline 80E): placa de apoyo negra, anillo de retención
    con la abertura abajo, puerto feed/conc. arriba y al centro tapón o puerto de permeado.
    Retirada: contorno punteado y la vasija hueca con la membrana adentro. */
export function tapaSVG(x: number, y: number, lado: LadoRack, st: EstadoPieza, conVisto: boolean): string {
  let s = `<circle cx="${x}" cy="${y}" r="16" fill="#efe6cf" stroke="#bfb498" stroke-width="1.2"/>`
  if (st === 'ais') return s + `<circle cx="${x}" cy="${y}" r="12.8" fill="#2563eb"/><circle cx="${x}" cy="${y}" r="11" fill="none" stroke="#93c5fd" stroke-width="1"/>`
  if (st === 'fuera') {
    s += `<circle cx="${x}" cy="${y}" r="12.8" fill="#5b636e"/><circle cx="${x}" cy="${y}" r="10.2" fill="#dfe4e9"/><circle cx="${x}" cy="${y}" r="4.2" fill="none" stroke="#9aa3ad" stroke-width="1"/><circle cx="${x}" cy="${y}" r="1.8" fill="#7b8794"/>`
      + `<circle cx="${x}" cy="${y}" r="12.8" fill="none" stroke="#334155" stroke-width="1.4" stroke-dasharray="3.2 2.4"/>`
    return s + (conVisto ? visto(x + 14, y - 13, '#475569') : '')
  }
  const r = 11.3, a1 = (90 + 14) * Math.PI / 180, a2 = (90 - 14) * Math.PI / 180
  const p1 = `${(x + r * Math.cos(a1)).toFixed(1)} ${(y + r * Math.sin(a1)).toFixed(1)}`
  const p2 = `${(x + r * Math.cos(a2)).toFixed(1)} ${(y + r * Math.sin(a2)).toFixed(1)}`
  s += `<circle cx="${x}" cy="${y}" r="12.8" fill="#2b3038"/>`
    + `<path d="M${p1} A${r} ${r} 0 1 1 ${p2}" fill="none" stroke="#b9c1ca" stroke-width="1.6"/>`
    + `<rect x="${x - 4.6}" y="${y + 9.2}" width="2.2" height="3" rx="0.6" fill="#b9c1ca"/><rect x="${x + 2.4}" y="${y + 9.2}" width="2.2" height="3" rx="0.6" fill="#b9c1ca"/>`
    + `<circle cx="${x}" cy="${y - 7.5}" r="3" fill="#a9b2bc" stroke="#6b7480" stroke-width="0.8"/>`
    + (lado === 'alimentacion'
      ? `<polygon points="${hexagono(x, y, 3.8, 0)}" fill="#d5dbe2" stroke="#8d96a1" stroke-width="0.6"/><circle cx="${x}" cy="${y}" r="1.4" fill="#9aa3ad"/>`
      : `<circle cx="${x}" cy="${y}" r="3.6" fill="#d6dade" stroke="#9aa2ab" stroke-width="0.8"/><circle cx="${x}" cy="${y}" r="1.5" fill="#8d96a1"/>`)
  if (st === 'nuevo') s += `<circle cx="${x}" cy="${y}" r="14.4" fill="none" stroke="#22c55e" stroke-width="2.6"/>` + visto(x + 14, y - 13, '#16a34a')
  return s
}

export interface EstadoPiezaFn { (id: string): EstadoPieza; retiro: boolean }

export function planoPiezas(
  lado: LadoRack, v: VistaP0, pieza: PiezaP0, estado: EstadoPiezaFn, paraPdf = false,
): string {
  const rg = rango(v, lado)
  const x0 = v === 'todo' ? 0 : px2(rg[0]) - 52, x1 = v === 'todo' ? ANCHO_P : px2(rg[1]) + 56
  let s = `<svg viewBox="${x0} 0 ${x1 - x0} ${ALTO_P}" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto">`
  s += encabezado(lado, rg, px2, 24, 44, 14)
  const conPPR = lado === 'descarga'
  // cada bloque tiene su cabezal por fila; los dos bloques del semi rack llegan
  // soldados al manifold común vertical que está entre ellos
  const segs: [number, number, 'izq' | 'der'][] = [[1, 5, 'izq'], [6, 10, 'der'], [11, 15, 'izq'], [16, 20, 'der']]
  const vx = (p: number) => (px2(p) + px2(p + 1)) / 2
  const yTop = py2(0) - 52 * K - 14, yBot = py2(FILAS_P0.length - 1) + 20
  FILAS_P0.forEach((f, i) => {
    const y = py2(i), hy = y - 52 * K, py = y - 40 * K
    s += `<text x="${x0 + (v === 'todo' ? 9 : 4)}" y="${y + 4}" font-size="12" font-weight="700" fill="#64748b">${f}</text>`
    for (const [a, b, lado2] of segs) {
      if (b < rg[0] || a > rg[1]) continue
      const xi = lado2 === 'izq' ? px2(a) - 34 : vx(a - 1), xf = lado2 === 'izq' ? vx(b) : px2(b) + 34
      s += `<g opacity="${pieza === 'codo' ? 1 : 0.32}"><rect x="${xi}" y="${hy - 7}" width="${xf - xi}" height="14" rx="7" fill="#aab5c2" stroke="#4d5a69" stroke-width="1.3"/><line x1="${xi + 6}" y1="${hy - 3}" x2="${xf - 6}" y2="${hy - 3}" stroke="#e2e8f0" stroke-width="1.8"/>`
      for (let q = a; q <= b; q++) if (q >= rg[0] && q <= rg[1]) s += `<rect x="${px2(q) - 5}" y="${hy + 5}" width="10" height="6" fill="#8d99a8" stroke="#4d5a69" stroke-width="0.9"/>`
      s += '</g>'
      if (conPPR) {
        s += `<g opacity="${pieza === 'ppr' ? 1 : 0.3}"><rect x="${xi}" y="${py - 8}" width="${xf - xi}" height="16" rx="8" fill="#ece6d8" stroke="#8f8877" stroke-width="1.3"/><line x1="${xi + 7}" y1="${py - 4}" x2="${xf - 7}" y2="${py - 4}" stroke="#fffdf6" stroke-width="2"/></g>`
      }
    }
    for (let p = rg[0]; p <= rg[1]; p++) {
      const id = f + columnaEn(p, lado), x = px2(p), st = estado(id), ais = st === 'ais'
      const retirada = estado.retiro && st === 'fuera'
      const hecho = retirada || st === 'nuevo'
      const escala = pieza === 'tapa' ? 1.8 : K
      s += `<g data-v="${id}"${paraPdf ? '' : ' style="cursor:pointer"'}>`
      if (!paraPdf) s += `<rect x="${x - CX2 / 2 + 2}" y="${hy - 10}" width="${CX2 - 4}" height="${CY2 - 8}" fill="#ffffff" fill-opacity="0"/>`
      s += `<g transform="translate(${x} ${y}) scale(${escala}) translate(${-x} ${-y})">`
      if (pieza === 'tapa') s += tapaSVG(x, y, lado, st, retirada)
      else {
        s += tapaSimple(x, y, lado, ais)
        if (pieza === 'codo') { if (conPPR) s += pprSVG(x, y, 'orig', true, false); s += codoSVG(x, y, st, false, retirada) }
        else { s += codoSVG(x, y, 'orig', true, false); s += pprSVG(x, y, st, false, retirada) }
      }
      const colorTxt = ais ? '#1e40af' : hecho ? (st === 'nuevo' ? '#15803d' : '#475569') : '#0f172a'
      s += `</g><text x="${x}" y="${y + (pieza === 'tapa' ? 46 : 38)}" text-anchor="middle" font-size="${paraPdf ? 14 : 12}" font-weight="${hecho ? 800 : 700}" fill="${colorTxt}"${retirada ? ' text-decoration="line-through"' : ''}>${id}</text></g>`
    }
  })
  // manifold común vertical de cada semi rack: ahí llegan soldados los cabezales de sus dos bloques
  for (const p of [5, 15]) {
    if (p + 1 < rg[0] || p > rg[1]) continue
    const x = vx(p)
    s += `<rect x="${x - 11}" y="${yTop}" width="22" height="${yBot - yTop}" rx="11" fill="#a3afbd" stroke="#3f4a57" stroke-width="1.4"/><line x1="${x - 5}" y1="${yTop + 10}" x2="${x - 5}" y2="${yBot - 10}" stroke="#e2e8f0" stroke-width="2.2"/>`
    FILAS_P0.forEach((_, i) => {
      const hy = py2(i) - 52 * K
      s += `<ellipse cx="${x - 11}" cy="${hy}" rx="2.2" ry="7.5" fill="#6b7684"/><ellipse cx="${x + 11}" cy="${hy}" rx="2.2" ry="7.5" fill="#6b7684"/>`
    })
    s += `<text x="${x}" y="${yBot + 16}" text-anchor="middle" font-size="10" font-weight="700" fill="#64748b">común</text>`
  }
  return s + '</svg>'
}

/** Ícono de la pieza para la leyenda, con el mismo dibujo del plano. */
export function iconoPieza(pieza: PiezaP0, st: EstadoPieza, conVisto: boolean, lado: LadoRack): string {
  if (pieza === 'tapa') return `<svg width="40" height="40" viewBox="-19 -19 40 40">${tapaSVG(0, 0, lado, st, conVisto)}</svg>`
  return `<svg width="38" height="46" viewBox="-16 -50 46 66">${tapaSimple(0, 0, pieza === 'ppr' ? 'descarga' : 'alimentacion', false)}${pieza === 'codo' ? codoSVG(0, 0, st, false, conVisto) : pprSVG(0, 0, st, false, conVisto)}</svg>`
}
