// La entrega de turno de planificación en PDF y en Excel.
//
// No usa la plantilla PYC: esa es la de los supervisores. Esta es la de
// planificación y sale de la minuta, así que tiene su propia hoja, con la
// misma cara de United (logo, bandas rojas) y sus cuatro bloques.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { rotuloSemana } from './minuta'
import { BLOQUES, type EntregaPlan } from './entregaPlan'
import { logoUnited } from './logoPdf'

const ROJO: [number, number, number] = [192, 0, 0]
const GRIS: [number, number, number] = [105, 106, 109]
const M = 12

/** jsPDF usa Helvetica con codificación WinAnsi y la flecha "→" sale como
    basura: en el PDF se cambia por un guion. */
const sinFlechas = (t: string) => t.replace(/→/g, '-')

/** "Nombre · Cargo", sin dejar el punto colgando si falta el nombre. */
const quienCon = (p: { nombre: string; cargo: string }) =>
  [p.nombre.trim(), p.cargo.trim()].filter(Boolean).join(' · ')

const nombreArchivo = (e: EntregaPlan) =>
  `Entrega de turno Planificacion ${e.inicio} ${(e.entrega.nombre || '').split(/\s+/)[0]}`.trim()


export async function pdfEntregaPlan(e: EntregaPlan): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const W = doc.internal.pageSize.getWidth()
  const ancho = W - M * 2
  const logo = await logoUnited()
  const finY = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? M

  autoTable(doc, {
    startY: M,
    body: [['', 'ENTREGA DE TURNO PLANIFICACIÓN', `Semana:\n${sinFlechas(rotuloSemana(e.inicio))}`]],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, valign: 'middle', lineColor: [120, 120, 120], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 42, minCellHeight: 16 },
      1: { halign: 'center', fontStyle: 'bold', fontSize: 14 },
      2: { cellWidth: 52, fontSize: 7.5 },
    },
    margin: { left: M, right: M },
    didDrawCell: (d) => {
      if (d.section === 'body' && d.column.index === 0 && logo) {
        doc.addImage(logo, 'JPEG', d.cell.x + 8, d.cell.y + (d.cell.height - 7) / 2, 26, 7)
      }
    },
  })

  const banda = (texto: string, color: [number, number, number], sep = 3) => {
    autoTable(doc, {
      startY: finY() + sep,
      body: [[texto]],
      theme: 'grid',
      styles: {
        fontSize: 9.5, fontStyle: 'bold', halign: 'center', textColor: 255,
        fillColor: color, cellPadding: 1.8, lineColor: [120, 120, 120], lineWidth: 0.2,
      },
      margin: { left: M, right: M },
    })
  }

  banda('Antecedentes', ROJO)
  autoTable(doc, {
    startY: finY(),
    body: [
      ['Fecha de la entrega:', e.fecha, 'Semana:', sinFlechas(rotuloSemana(e.inicio))],
      ['Entrega el turno:', quienCon(e.entrega), 'Recibe el turno:', quienCon(e.recibe)],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.6, lineColor: [120, 120, 120], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold', fillColor: [232, 232, 233] },
      1: { cellWidth: 55 },
      2: { cellWidth: 33, fontStyle: 'bold', fillColor: [232, 232, 233] },
      3: { cellWidth: ancho - 38 - 55 - 33 },
    },
    margin: { left: M, right: M },
  })

  for (const b of BLOQUES) {
    const filas = e[b.clave]
    banda(`${b.nombre} (${filas.length})`, GRIS, 4)
    autoTable(doc, {
      startY: finY(),
      head: [['Nº', 'Detalle', 'De dónde viene']],
      body: filas.length > 0
        ? filas.map((l, i) => [i + 1, l.titulo, l.detalle])
        : [['', 'Sin nada en este bloque', '']],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.6, valign: 'top', lineColor: [120, 120, 120], lineWidth: 0.2 },
      headStyles: { fillColor: [141, 143, 145], textColor: 20, fontStyle: 'bold', fontSize: 8, halign: 'center' },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 58 } },
      margin: { left: M, right: M },
    })
  }

  autoTable(doc, {
    startY: finY() + 6,
    head: [['Responsable de entregar el turno', 'Responsable de recibir el turno']],
    body: [
      [`Nombre: ${e.entrega.nombre}`, `Nombre: ${e.recibe.nombre || ''}`],
      [`Cargo: ${e.entrega.cargo || ''}`, `Cargo: ${e.recibe.cargo || ''}`],
      ['Firma:', 'Firma:'],
    ],
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.4, minCellHeight: 9, lineColor: [120, 120, 120], lineWidth: 0.2 },
    headStyles: { fillColor: ROJO, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 9 },
    columnStyles: { 0: { cellWidth: ancho / 2 }, 1: { cellWidth: ancho / 2 } },
    margin: { left: M, right: M },
  })

  const paginas = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(120)
    doc.text('Entrega de turno · área de planificación · sale de la minuta de la semana',
      M, doc.internal.pageSize.getHeight() - 6)
    doc.text(`Página ${p} de ${paginas}`, W - M, doc.internal.pageSize.getHeight() - 6, { align: 'right' })
  }
  doc.save(`${nombreArchivo(e)}.pdf`)
}

export async function excelEntregaPlan(e: EntregaPlan): Promise<void> {
  const mod = await import('exceljs')
  const ExcelJS = (mod as unknown as { default?: typeof import('exceljs') }).default ?? mod
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Entrega planificación')
  ws.getColumn(1).width = 6
  ws.getColumn(2).width = 70
  ws.getColumn(3).width = 38

  const banda = (texto: string, color: string) => {
    const f = ws.rowCount + 1
    ws.mergeCells(f, 1, f, 3)
    const c = ws.getCell(f, 1)
    c.value = texto
    c.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    c.alignment = { horizontal: 'center' }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } }
    return f
  }

  ws.addRow(['ENTREGA DE TURNO PLANIFICACIÓN'])
  ws.mergeCells(1, 1, 1, 3)
  ws.getCell(1, 1).font = { bold: true, size: 14 }
  ws.getCell(1, 1).alignment = { horizontal: 'center' }

  banda('Antecedentes', 'FFC00000')
  ws.addRow(['', 'Fecha de la entrega', e.fecha])
  ws.addRow(['', 'Semana', rotuloSemana(e.inicio)])
  ws.addRow(['', 'Entrega el turno', quienCon(e.entrega)])
  ws.addRow(['', 'Recibe el turno', quienCon(e.recibe)])

  for (const b of BLOQUES) {
    const filas = e[b.clave]
    banda(`${b.nombre} (${filas.length})`, 'FF696A6D')
    const cab = ws.addRow(['Nº', 'Detalle', 'De dónde viene'])
    cab.font = { bold: true }
    cab.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8D8F91' } }
    })
    filas.forEach((l, i) => {
      const fila = ws.addRow([i + 1, l.titulo, l.detalle])
      fila.getCell(2).alignment = { wrapText: true, vertical: 'top' }
    })
    if (filas.length === 0) ws.addRow(['', 'Sin nada en este bloque', ''])
  }

  banda('Firmas', 'FFC00000')
  ws.addRow(['', 'Entrega el turno', e.entrega.nombre])
  ws.addRow(['', 'Recibe el turno', e.recibe.nombre || ''])
  ws.addRow(['', 'Firma', ''])

  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombreArchivo(e)}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}
