// La entrega de turno en PDF, con las mismas secciones del formato oficial.
// El Excel (`xlsxEntrega.ts`) es el que se manda; este PDF es para leerlo en el
// teléfono o pegarlo en un correo sin abrir Excel.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fechaCorta } from './fecha'
import { EQUIPOS } from './equiposFormato'
import { nombreTurno, type Entrega } from './planDatos'

const ROJO: [number, number, number] = [192, 0, 0]

function nombreBase(e: Entrega): string {
  const quien = (e.entrega.nombre || 'supervisor').split(/\s+/)[0]
  return `Entrega_turno_${e.fecha}_${e.semana || ''}_${quien}`.replace(/__+/g, '_')
}

export function generarPDFEntrega(e: Entrega): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const M = 14
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  let y = 18

  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(20)
  doc.text('ENTREGA DE TURNO PYC', M, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110)
  doc.text('United · Planta Desaladora Coloso', M, y + 4.5)
  doc.text('Código: PYC-EG-MEL-6001-01 · Rev. 00', W - M, y - 1, { align: 'right' })
  doc.text(`Emitido: ${fechaCorta()}`, W - M, y + 3.5, { align: 'right' })

  y += 9
  doc.setDrawColor(...ROJO); doc.setLineWidth(0.8); doc.line(M, y, W - M, y)
  y += 6

  autoTable(doc, {
    startY: y,
    body: [
      ['Contrato', 'INTEGRAL MEL/COLOSO  ·  9100002468', 'Centro de costo', '6001'],
      ['Fecha', `${e.fecha}  ·  turno ${nombreTurno(e.turno)}`, 'Semana', e.semana || '—'],
      ['Entrega el turno', `${e.entrega.nombre}${e.entrega.cargo ? ` · ${e.entrega.cargo}` : ''}`,
        'RUN', e.entrega.run || '—'],
      ['Recibe el turno', `${e.recibe.nombre || '—'}${e.recibe.cargo ? ` · ${e.recibe.cargo}` : ''}`,
        'RUN', e.recibe.run || '—'],
    ],
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.4 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 34 }, 2: { fontStyle: 'bold', cellWidth: 26 } },
    margin: { left: M, right: M },
  })
  // @ts-expect-error autoTable deja la última posición en el doc
  y = (doc.lastAutoTable?.finalY ?? y) + 5

  const tabla = (titulo: string, head: string[][], body: string[][]) => {
    if (body.length === 0) return
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(20)
    doc.text(titulo, M, y)
    y += 2
    autoTable(doc, {
      startY: y,
      head, body,
      styles: { fontSize: 8.5, cellPadding: 1.8, valign: 'top' },
      headStyles: { fillColor: ROJO, fontSize: 8.5 },
      margin: { left: M, right: M },
    })
    // @ts-expect-error idem
    y = (doc.lastAutoTable?.finalY ?? y) + 6
  }

  tabla('3.1 Órdenes de trabajo ejecutadas',
    [['Nº', 'OT', 'Observaciones', 'Estado']],
    e.ots.map((o, i) => [String(i + 1), o.ot, o.observaciones, o.estado]))

  tabla('3.2 Actividades adicionales / OT subsecuentes',
    [['Nº', 'Descripción', 'Estado']],
    e.adicionales.map((a, i) => [String(i + 1), a.descripcion, a.estado]))

  tabla('3.3 Amenazas',
    [['Nº', 'Descripción']],
    e.amenazas.map((a, i) => [String(i + 1), a.descripcion]))

  const equipos = e.equipos
    .map((l) => ({ l, eq: EQUIPOS.find((x) => x.interno === l.interno) }))
    .filter((x) => x.eq)
  tabla('3.4 Equipos',
    [['Equipo', 'Nº interno', 'Ubicación', 'Estado', 'Horómetro']],
    equipos.map(({ l, eq }) => [eq!.nombre, l.interno, eq!.ubicacion, l.estado || '—', l.horometro || '—']))

  // Lo que planificación anotó después, al revisarla en la minuta. Va acá y no
  // en el Excel: ese es el documento que firmó el supervisor y no se le mete
  // mano después.
  if (e.obsPlan) {
    tabla('Observación de planificación (posterior a la entrega)',
      [['Anotó', 'Observación']],
      [[e.obsPlanPor || '—', e.obsPlan]])
  }

  // ---- firmas
  if (y > H - 45) { doc.addPage(); y = 20 }
  y += 4
  autoTable(doc, {
    startY: y,
    head: [['Responsable de entregar el turno', 'Responsable de recibir el turno']],
    body: [
      [`Nombre: ${e.entrega.nombre}`, `Nombre: ${e.recibe.nombre || ''}`],
      [`Cargo: ${e.entrega.cargo || ''}`, `Cargo: ${e.recibe.cargo || ''}`],
      [`RUN: ${e.entrega.run || ''}`, `RUN: ${e.recibe.run || ''}`],
      ['Firma:', 'Firma:'],
    ],
    styles: { fontSize: 9, cellPadding: 3, minCellHeight: 8 },
    headStyles: { fillColor: [241, 245, 249], textColor: 20, fontSize: 9 },
    margin: { left: M, right: M },
  })

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(130)
  doc.text('App United · el Excel del formato oficial se baja desde la misma pantalla', M, H - 8)

  doc.save(`${nombreBase(e)}.pdf`)
}

/** CSV con `;` y BOM para mirar varias entregas juntas en Excel. */
export function bajarCSVEntregas(entregas: Entrega[]): void {
  const limpio = (t: string) => `"${(t ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' / ')}"`
  const cab = ['FECHA', 'SEMANA', 'TURNO', 'ENTREGA', 'RECIBE', 'OT', 'OBSERVACIONES', 'ESTADO']
  const filas: string[] = []
  for (const e of entregas) {
    const base = [e.fecha, e.semana, nombreTurno(e.turno), limpio(e.entrega.nombre), limpio(e.recibe.nombre)]
    if (e.ots.length === 0) filas.push([...base, '', '', ''].join(';'))
    for (const o of e.ots) filas.push([...base, o.ot, limpio(o.observaciones), o.estado].join(';'))
    for (const a of e.adicionales) filas.push([...base, 'adicional', limpio(a.descripcion), a.estado].join(';'))
    for (const a of e.amenazas) filas.push([...base, 'amenaza', limpio(a.descripcion), ''].join(';'))
  }
  const texto = [cab.join(';'), ...filas].join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `Entregas_turno_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
