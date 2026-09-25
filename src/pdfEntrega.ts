// La planilla de entrega de turno: PDF para mandar por correo y CSV para Excel.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fechaCorta } from './fecha'
import { nombreTurno, type Entrega } from './planDatos'

function nombreBase(e: Entrega): string {
  return `Entrega_turno_${e.fecha}_${nombreTurno(e.turno)}_${e.supervisor.replace(/\s+/g, '')}`
}

export function generarPDFEntrega(e: Entrega): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const M = 16
  const W = doc.internal.pageSize.getWidth()
  let y = 18

  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(20)
  doc.text('UNITED', M, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110)
  doc.text('Planta Desaladora · Coloso', M, y + 5)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20)
  doc.text('Entrega de turno', M, y + 12)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
  doc.text(`${e.fecha} · Turno ${nombreTurno(e.turno)}`, W - M, y, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110)
  doc.text(`Emitido: ${fechaCorta()}`, W - M, y + 5, { align: 'right' })

  y += 16
  doc.setDrawColor(30); doc.setLineWidth(0.5); doc.line(M, y, W - M, y)
  y += 7

  const meta: [string, string][] = [
    ['Supervisor', e.supervisor],
    ['Área / frente', e.area || '—'],
    ['Dotación', e.dotacion ? String(e.dotacion) : '—'],
  ]
  autoTable(doc, {
    startY: y,
    body: meta,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
    margin: { left: M, right: M },
  })
  // @ts-expect-error autoTable deja la última posición en el doc
  y = (doc.lastAutoTable?.finalY ?? y) + 6

  const bloque = (titulo: string, texto: string) => {
    if (!texto.trim()) return
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(20)
    doc.text(titulo, M, y)
    y += 5
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(40)
    const lineas = doc.splitTextToSize(texto.trim(), W - 2 * M)
    for (const l of lineas) {
      if (y > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); y = 20 }
      doc.text(l, M, y)
      y += 5
    }
    y += 4
  }

  bloque('Lo que se hizo en el turno', e.hecho)
  bloque('Queda pendiente', e.pendiente)
  bloque('Novedades y seguridad', e.novedades)

  if (e.actividades.length > 0) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(20)
    doc.text('Actividades', M, y)
    y += 3
    autoTable(doc, {
      startY: y,
      head: [['Actividad', 'Estado']],
      body: e.actividades.map((a) => [a.proyecto ? `${a.proyecto} · ${a.titulo}` : a.titulo,
        a.estado === 'completada' ? 'Completada' : 'Pendiente']),
      styles: { fontSize: 9.5, cellPadding: 2 },
      headStyles: { fillColor: [192, 0, 0] },
      margin: { left: M, right: M },
    })
  }

  const H = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(130)
  doc.text('App United · entrega de turno', M, H - 10)
  doc.text(`Firmada por ${e.supervisor}`, W - M, H - 10, { align: 'right' })

  doc.save(`${nombreBase(e)}.pdf`)
}

/** CSV con `;` y BOM: Excel lo abre de una en los computadores de la planta. */
export function bajarCSVEntregas(entregas: Entrega[]): void {
  const limpio = (t: string) => `"${(t ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' / ')}"`
  const cab = ['FECHA', 'TURNO', 'SUPERVISOR', 'AREA', 'DOTACION', 'HECHO', 'PENDIENTE', 'NOVEDADES']
  const texto = [
    cab.join(';'),
    ...entregas.map((e) => [
      e.fecha, nombreTurno(e.turno), limpio(e.supervisor), limpio(e.area),
      e.dotacion ?? '', limpio(e.hecho), limpio(e.pendiente), limpio(e.novedades),
    ].join(';')),
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `Entregas_turno_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
