// La entrega de turno en el formato oficial de United, para mandarla como
// siempre: se rellena la MISMA planilla (PYC-EG-MEL-6001-01), que viaja con la
// app en `public/plantillas/entrega_turno.xlsx` — con su logo, sus textos fijos
// y los datos del contrato.
//
// ExcelJS pesa, así que se carga recién cuando alguien baja una entrega.
import type { Entrega } from './planDatos'
import { EQUIPOS } from './equiposFormato'

const BASE = import.meta.env.BASE_URL

/** Dónde va cada bloque en la plantilla (ver la hoja "Entrega de Turno"). */
const FILAS = {
  ots: { desde: 17, hasta: 59 },
  adicionales: { desde: 63, hasta: 79 },
  amenazas: { desde: 83, hasta: 92 },
  equipos: { desde: 97, hasta: 119 },
}

function nombreArchivo(e: Entrega): string {
  const quien = e.entrega.nombre.split(/\s+/)[0] || 'supervisor'
  return `PYC-EG-MEL-6001-01 Entrega de Turno ${e.semana || e.fecha} ${quien}.xlsx`
}

export async function bajarExcelEntrega(e: Entrega): Promise<void> {
  const [mod, plantilla] = await Promise.all([
    import('exceljs'),
    fetch(`${BASE}plantillas/entrega_turno.xlsx`).then((r) => {
      if (!r.ok) throw new Error('No se encontró la plantilla del formato.')
      return r.arrayBuffer()
    }),
  ])
  const ExcelJS = (mod as unknown as { default?: typeof import('exceljs') }).default ?? mod
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(plantilla)
  const ws = wb.getWorksheet('Entrega de Turno')
  if (!ws) throw new Error('La plantilla no trae la hoja "Entrega de Turno".')

  // ---- antecedentes de la entrega
  ws.getCell('D9').value = e.fecha
  ws.getCell('I9').value = e.semana
  ws.getCell('D10').value = e.entrega.nombre
  ws.getCell('I10').value = e.entrega.cargo
  ws.getCell('D11').value = e.recibe.nombre
  ws.getCell('I11').value = e.recibe.cargo

  /** Escribe una lista en su bloque. Lo que no entra se junta en la última
      fila disponible: mejor apretado que perdido. */
  const escribir = <T,>(
    filas: { desde: number; hasta: number },
    items: T[],
    poner: (f: number, item: T, n: number) => void,
    juntar: (a: T, b: T) => T,
  ) => {
    const caben = filas.hasta - filas.desde + 1
    const lista = items.length > caben
      ? [...items.slice(0, caben - 1), items.slice(caben - 1).reduce(juntar)]
      : items
    lista.forEach((item, i) => poner(filas.desde + i, item, i + 1))
  }

  escribir(FILAS.ots, e.ots, (f, o, n) => {
    ws.getCell(`B${f}`).value = n
    ws.getCell(`C${f}`).value = o.ot
    ws.getCell(`D${f}`).value = o.observaciones
    ws.getCell(`I${f}`).value = o.estado
  }, (a, b) => ({ ...a, observaciones: `${a.observaciones}\n${b.ot ? b.ot + ': ' : ''}${b.observaciones}` }))

  escribir(FILAS.adicionales, e.adicionales, (f, a, n) => {
    ws.getCell(`B${f}`).value = n
    ws.getCell(`C${f}`).value = a.descripcion
    ws.getCell(`I${f}`).value = a.estado
  }, (a, b) => ({ ...a, descripcion: `${a.descripcion}\n${b.descripcion}` }))

  escribir(FILAS.amenazas, e.amenazas, (f, a, n) => {
    ws.getCell(`B${f}`).value = n
    ws.getCell(`C${f}`).value = a.descripcion
  }, (a, b) => ({ descripcion: `${a.descripcion}\n${b.descripcion}` }))

  // los equipos van en su fila del catálogo, por número interno
  for (const l of e.equipos) {
    const i = EQUIPOS.findIndex((x) => x.interno === l.interno)
    if (i < 0) continue
    const f = FILAS.equipos.desde + i
    if (l.estado) ws.getCell(`G${f}`).value = l.estado
    if (l.observaciones) ws.getCell(`I${f}`).value = l.observaciones
    if (l.horometro) ws.getCell(`J${f}`).value = Number(l.horometro) || l.horometro
  }

  // ---- firmas
  ws.getCell('D122').value = e.entrega.nombre
  ws.getCell('D123').value = e.entrega.cargo
  ws.getCell('D124').value = e.entrega.run
  ws.getCell('H122').value = e.recibe.nombre
  ws.getCell('H123').value = e.recibe.cargo
  ws.getCell('H124').value = e.recibe.run

  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo(e)
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}
