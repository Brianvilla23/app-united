// La planilla del carguío de membranas, en el mismo formato que entregaba el
// escáner de membranas de United (escaner-membranas.pages.dev, `app.js` →
// `exportarExcel`): hoja CODIFICACION con una fila por vasija y sus 7 series,
// DETALLE con una fila por membrana y RESUMEN. Así lo que llega a United no
// cambia de forma por haber pasado el escaneo a esta app (18-10-2026).
import { CELDAS } from './rackLayout'
import { fechaCorta } from './fecha'
import { hoyISO } from './util'
import {
  MARCA_POR_DEFECTO, MARCAS, MEMBRANAS_POR_VASIJA, POSICIONES,
  membranaEn, puestas, tipoDePosicion, type DatosMembranas,
} from './membranas'

export interface VasijaCargada { vasija: string; datos: DatosMembranas }

const NOMBRE_PLANTA: Record<string, string> = { EWS: 'PLANTA RO EWS', CERO: 'PLANTA CERO' }

function nombreMarca(d: DatosMembranas): string {
  const m = d.marca ?? MARCA_POR_DEFECTO
  return MARCAS.find((x) => x.codigo === m)?.nombre ?? m
}

/** Quien escaneó: el escáner lo pedía como "mecánico"; acá cada lectura
    guarda quién la hizo, así que se juntan los nombres distintos. */
function mecanicos(d: DatosMembranas): string {
  const nombres = POSICIONES.map((p) => membranaEn(d, p)?.quien?.trim()).filter(Boolean) as string[]
  return [...new Set(nombres)].join(' / ')
}

function ultimaLectura(d: DatosMembranas): number | undefined {
  const ts = POSICIONES.map((p) => membranaEn(d, p)?.ts ?? 0).filter((t) => t > 0)
  return ts.length ? Math.max(...ts) : undefined
}

export async function bajarExcelMembranas(
  rack: number, planta: string, cargadas: VasijaCargada[],
): Promise<number> {
  const orden = new Map(CELDAS.map((c, i) => [c.id, i]))
  const celda = new Map(CELDAS.map((c) => [c.id, c]))
  const lista = cargadas
    .filter((v) => puestas(v.datos) > 0)
    .sort((a, b) => (orden.get(a.vasija) ?? 0) - (orden.get(b.vasija) ?? 0))
  if (!lista.length) throw new Error('Todavía no hay membranas escaneadas en este rack.')

  const mod = await import('exceljs')
  const ExcelJS = (mod as unknown as { default?: typeof import('exceljs') }).default ?? mod
  const wb = new ExcelJS.Workbook()
  const nombrePlanta = NOMBRE_PLANTA[planta] ?? planta
  const semi = (vasija: string) => ((celda.get(vasija)?.col ?? 0) <= 8 ? 'A' : 'B')
  const negrita = (fila: import('exceljs').Row) => { fila.font = { bold: true } }

  // Hoja 1 — formato de la planilla de codificación
  const h1 = wb.addWorksheet('CODIFICACION', { views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }] })
  h1.addRow(['CODIFICACIÓN DE MEMBRANAS — TRAZABILIDAD DE VASIJAS']).font = { bold: true, size: 13 }
  h1.mergeCells(1, 1, 1, 10)
  h1.addRow(['Generado', new Date().toLocaleString('es-CL'), '', 'Registros', lista.length])
  h1.addRow([])
  negrita(h1.addRow(['N° DE VASIJA', 'PLANTA', 'RACK', 'SEMI RACK',
    'MEMBRANA N° 7 / C6', 'MEMBRANA N° 6 / C6', 'MEMBRANA N° 5 / C6', 'MEMBRANA N° 4 / C6',
    'MEMBRANA N° 3 / C5', 'MEMBRANA N° 2 / C5', 'MEMBRANA N° 1 / C5',
    'MARCA', 'MECÁNICO', 'SUPERVISOR', 'FECHA', 'ESTADO', 'OBSERVACIÓN']))
  for (const { vasija, datos } of lista) {
    const ts = ultimaLectura(datos)
    h1.addRow([
      vasija, nombrePlanta, rack, semi(vasija),
      ...POSICIONES.map((p) => membranaEn(datos, p)?.serie ?? ''),
      nombreMarca(datos), mecanicos(datos), datos.supervisor ?? '',
      ts ? fechaCorta(ts) : '',
      puestas(datos) === MEMBRANAS_POR_VASIJA ? 'COMPLETO' : 'PARCIAL',
      datos.observacion ?? '',
    ])
  }
  ;[13, 16, 7, 11, 20, 20, 20, 20, 20, 20, 20, 15, 22, 22, 12, 12, 34]
    .forEach((w, i) => { h1.getColumn(i + 1).width = w })

  // Hoja 2 — una fila por membrana
  const h2 = wb.addWorksheet('DETALLE', { views: [{ state: 'frozen', ySplit: 1 }] })
  negrita(h2.addRow(['PLANTA', 'RACK', 'SEMI RACK', 'VASIJA', 'FILA', 'COLUMNA', 'POSICIÓN', 'TIPO',
    'N° DE SERIE', 'MARCA', 'MODELO', 'ORIGEN', 'MECÁNICO', 'SUPERVISOR', 'FECHA', 'REGISTRADO']))
  for (const { vasija, datos } of lista) {
    const c = celda.get(vasija)
    for (const p of POSICIONES) {
      const m = membranaEn(datos, p)
      if (!m?.serie) continue
      h2.addRow([
        nombrePlanta, rack, semi(vasija), vasija, c?.fila ?? '', c?.col ?? '', p, tipoDePosicion(p),
        m.serie, nombreMarca(datos), m.modelo ?? '', m.metodo === 'manual' ? 'Manual' : 'Cámara',
        m.quien ?? '', datos.supervisor ?? '', m.ts ? fechaCorta(m.ts) : '',
        m.ts ? new Date(m.ts).toLocaleString('es-CL') : '',
      ])
    }
  }
  ;[16, 7, 11, 9, 7, 9, 10, 7, 22, 14, 18, 10, 22, 22, 12, 22]
    .forEach((w, i) => { h2.getColumn(i + 1).width = w })

  // Hoja 3 — resumen
  const h3 = wb.addWorksheet('RESUMEN')
  negrita(h3.addRow(['PLANTA', 'RACK', 'VASIJAS REGISTRADAS', 'COMPLETAS', 'PARCIALES', 'MEMBRANAS']))
  const completas = lista.filter((v) => puestas(v.datos) === MEMBRANAS_POR_VASIJA).length
  h3.addRow([nombrePlanta, rack, lista.length, completas, lista.length - completas,
    lista.reduce((n, v) => n + puestas(v.datos), 0)])
  ;[18, 7, 22, 12, 12, 12].forEach((w, i) => { h3.getColumn(i + 1).width = w })

  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }))
  const a = document.createElement('a')
  a.href = url
  a.download = `Codificacion-Membranas-Rack${rack}-${hoyISO()}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 3000)
  return lista.length
}
