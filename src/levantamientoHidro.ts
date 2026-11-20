// Levantamiento Hidrolatina (20-11-2026, Brayan).
//
// Un link que abre cualquiera del personal, sin cuenta, para recorrer los 12
// racks y dejar anotado:
//  · lado DESCARGA: de qué tipo es cada uno de los 40 manifolds. Blanco es
//    Hidrolatina; gris es manifold de comando.
//  · lado ALIMENTACIÓN: qué vasijas están aisladas y cuáles tienen el tapón
//    interno del canastillo para cambio.
// Lo que no se marca también dice algo: queda como «sin revisar» en el status.
//
// Va en `avance_item` como tres actividades propias, igual que las aisladas del
// outage: no necesita tabla nueva y viaja con la misma cola sin señal. Son
// actividades APARTE de `vasija_aislada` a propósito: Brayan pidió que lo de
// acá no pase a los outage (20-11), es un registro para llevar a otra planilla.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { encolar } from './sync'
import { quienSoy } from './identidad'
import { itemId, type ItemAvance, type LadoRack } from './types'
import { CELDAS, RACKS } from './rackLayout'
import { MANIFOLDS } from './actividades'
import { hoyISO } from './util'

export const ACT_MANIFOLD = 'hidrolatina_manifold'
export const ACT_AISLADA = 'hidrolatina_aislada'
export const ACT_TAPON = 'hidrolatina_tapon'
export const ACTIVIDADES_HIDROLATINA = [ACT_MANIFOLD, ACT_AISLADA, ACT_TAPON]

/** El fragmento del link: app-united.pages.dev/#hidrolatina */
export const HASH_HIDROLATINA = '#hidrolatina'

export type ColorManifold = 'blanco' | 'gris'
export const TIPOS_MANIFOLD: { color: ColorManifold; nombre: string; tipo: string; relleno: string; texto: string }[] = [
  { color: 'blanco', nombre: 'Blanco', tipo: 'Hidrolatina', relleno: 'rgba(255,255,255,.93)', texto: '#0f172a' },
  { color: 'gris', nombre: 'Gris', tipo: 'Comando', relleno: 'rgba(71,85,105,.8)', texto: '#ffffff' },
]
export const tipoManifold = (c: ColorManifold) => TIPOS_MANIFOLD.find((t) => t.color === c)!

export type MarcaVasija = 'aislada' | 'tapon'
const ACT_DE: Record<MarcaVasija, string> = { aislada: ACT_AISLADA, tapon: ACT_TAPON }
export const NOMBRE_MARCA: Record<MarcaVasija, string> = {
  aislada: 'Vasija aislada',
  tapon: 'Tapón interno a cambiar',
}

// `type` y no `interface` para que entre en el `datos: Record<string, unknown>`
export type DatosHidrolatina = { color?: ColorManifold; quien?: string; fecha?: number }

export interface LevantamientoRack {
  manifolds: Map<string, ColorManifold>
  aisladas: Set<string>
  tapones: Set<string>
}

const VACIO: LevantamientoRack = { manifolds: new Map(), aisladas: new Set(), tapones: new Set() }

function armar(filas: ItemAvance[]): LevantamientoRack {
  const r: LevantamientoRack = { manifolds: new Map(), aisladas: new Set(), tapones: new Set() }
  for (const f of filas) {
    if (!f.hecho) continue
    if (f.actividad === ACT_MANIFOLD) {
      const c = (f.datos as DatosHidrolatina).color
      if (c === 'blanco' || c === 'gris') r.manifolds.set(f.item, c)
    } else if (f.actividad === ACT_AISLADA) r.aisladas.add(f.item)
    else if (f.actividad === ACT_TAPON) r.tapones.add(f.item)
  }
  return r
}

/** Lo levantado en un rack. */
export function useLevantamiento(rack: number): LevantamientoRack {
  const filas = useLiveQuery(
    () => db.items.where('actividad').anyOf(ACTIVIDADES_HIDROLATINA).filter((i) => i.rack === rack).toArray(),
    [rack],
  )
  return filas ? armar(filas) : VACIO
}

async function guardar(actividad: string, lado: LadoRack, rack: number, item: string, hecho: boolean, extra: DatosHidrolatina = {}) {
  const yo = quienSoy()
  // al desmarcar se guarda igual, con hecho = false: así queda quién lo sacó
  const datos: DatosHidrolatina = { ...extra, quien: yo, fecha: Date.now() }
  await db.items.put({
    id: itemId(actividad, lado, rack, item), actividad, lado, rack, item,
    hecho, datos, creadoPor: yo, createdAt: Date.now(), sincronizado: false,
  })
  await encolar('item_upsert', { actividad, lado, rack, item, hecho, datos, creado_por: yo })
}

/** `null` = borrar lo marcado en ese manifold. */
export function marcarManifold(rack: number, manifold: string, color: ColorManifold | null): Promise<void> {
  return guardar(ACT_MANIFOLD, 'descarga', rack, manifold, color !== null, color ? { color } : {})
}

export function marcarVasija(rack: number, vasija: string, marca: MarcaVasija, si: boolean): Promise<void> {
  return guardar(ACT_DE[marca], 'alimentacion', rack, vasija, si)
}

// ------------------------------------------------------------ Excel

function fechaHora(ms?: number): string {
  if (!ms) return ''
  const d = new Date(ms)
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${dos(d.getDate())}-${dos(d.getMonth() + 1)}-${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}`
}

/** La planilla del levantamiento, para pasarla a la planilla de Planificación:
    STATUS por rack, MANIFOLDS (los 40 de cada rack, también los sin revisar) y
    VASIJAS (solo las marcadas: lo que no está, no está aislado ni tiene tapón). */
export async function bajarExcelHidrolatina(): Promise<void> {
  const filas = await db.items.where('actividad').anyOf(ACTIVIDADES_HIDROLATINA).toArray()
  const por = new Map<string, ItemAvance>(filas.map((f) => [f.id, f]))

  const mod = await import('exceljs')
  const ExcelJS = (mod as unknown as { default?: typeof import('exceljs') }).default ?? mod
  const wb = new ExcelJS.Workbook()
  const encabezado = (ws: import('exceljs').Worksheet, cols: { header: string; key: string; width: number }[]) => {
    ws.columns = cols
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC00000' } }
    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }

  const status = wb.addWorksheet('STATUS')
  encabezado(status, [
    { header: 'Rack', key: 'rack', width: 8 },
    { header: 'Hidrolatina (blanco)', key: 'blanco', width: 20 },
    { header: 'Comando (gris)', key: 'gris', width: 16 },
    { header: 'Manifolds sin revisar', key: 'sin', width: 20 },
    { header: 'Vasijas aisladas', key: 'ais', width: 16 },
    { header: 'Tapón interno a cambiar', key: 'tap', width: 22 },
    { header: 'Manifolds sin revisar (lista)', key: 'lista', width: 60 },
  ])
  const mf = wb.addWorksheet('MANIFOLDS')
  encabezado(mf, [
    { header: 'Rack', key: 'rack', width: 8 },
    { header: 'Manifold', key: 'manifold', width: 11 },
    { header: 'Color', key: 'color', width: 10 },
    { header: 'Tipo', key: 'tipo', width: 14 },
    { header: 'Registró', key: 'quien', width: 24 },
    { header: 'Fecha', key: 'fecha', width: 18 },
  ])
  const vs = wb.addWorksheet('VASIJAS')
  encabezado(vs, [
    { header: 'Rack', key: 'rack', width: 8 },
    { header: 'Vasija', key: 'vasija', width: 9 },
    { header: 'Aislada', key: 'ais', width: 10 },
    { header: 'Tapón interno a cambiar', key: 'tap', width: 22 },
    { header: 'Registró', key: 'quien', width: 24 },
    { header: 'Fecha', key: 'fecha', width: 18 },
  ])

  for (const rack of RACKS) {
    let blanco = 0, gris = 0, ais = 0, tap = 0
    const sinRevisar: string[] = []
    for (const m of MANIFOLDS) {
      const f = por.get(itemId(ACT_MANIFOLD, 'descarga', rack, m.id))
      const d = (f?.datos ?? {}) as DatosHidrolatina
      const color = f?.hecho ? d.color : undefined
      if (color === 'blanco') blanco++
      else if (color === 'gris') gris++
      else sinRevisar.push(m.id)
      mf.addRow({
        rack, manifold: m.id,
        color: color ? tipoManifold(color).nombre : 'Sin revisar',
        tipo: color ? tipoManifold(color).tipo : '',
        quien: color ? d.quien ?? '' : '', fecha: color ? fechaHora(d.fecha) : '',
      })
    }
    for (const c of CELDAS) {
      const a = por.get(itemId(ACT_AISLADA, 'alimentacion', rack, c.id))
      const t = por.get(itemId(ACT_TAPON, 'alimentacion', rack, c.id))
      const esA = !!a?.hecho, esT = !!t?.hecho
      if (!esA && !esT) continue
      if (esA) ais++
      if (esT) tap++
      const ultimo = [a, t].filter((x) => x?.hecho).sort((x, y) =>
        Number((y!.datos as DatosHidrolatina).fecha ?? 0) - Number((x!.datos as DatosHidrolatina).fecha ?? 0))[0]
      const d = (ultimo?.datos ?? {}) as DatosHidrolatina
      vs.addRow({ rack, vasija: c.id, ais: esA ? 'Sí' : '', tap: esT ? 'Sí' : '', quien: d.quien ?? '', fecha: fechaHora(d.fecha) })
    }
    status.addRow({
      rack, blanco, gris, sin: sinRevisar.length, ais, tap,
      lista: sinRevisar.length === MANIFOLDS.length ? 'Todos' : sinRevisar.join(', '),
    })
  }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `Levantamiento Hidrolatina ${hoyISO()}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
