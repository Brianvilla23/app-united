import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Aviso } from './types'

const CC_FIJO = 'brayan.villalobos.c@gmail.com'

export function generarPDF(a: Aviso): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const M = 16
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  let y = 18

  // ---- Encabezado ----
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(20)
  doc.text('UNITED', M, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110)
  doc.text('Planta Desaladora · Coloso', M, y + 5)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20)
  doc.text('Informe técnico de aviso', M, y + 12)

  doc.setFontSize(12)
  doc.text(a.folio, W - M, y, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110)
  doc.text(`Emitido: ${new Date().toLocaleDateString('es-CL')}`, W - M, y + 5, { align: 'right' })

  y += 16
  doc.setDrawColor(30); doc.setLineWidth(0.5); doc.line(M, y, W - M, y)
  y += 7

  // ---- Metadatos ----
  const meta: [string, string][] = [
    ['Título de la actividad', a.titulo],
    ['Tipo de aviso', a.tipo],
    ['Prioridad', a.prioridad],
    ['Zona', a.zona],
    ['Equipo / activo', a.equipo],
    ['Fecha del trabajo', a.fechaTrabajo],
    ['Detención de equipo', a.detencion ? 'Sí' : 'No'],
    ['Dotación', `${a.dotacion} personas`],
    ['Horas requeridas', `${a.horas} h`],
    ['Modo de falla', a.modoFalla || '—'],
  ]
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.4, valign: 'top' },
    columnStyles: {
      0: { textColor: 120, cellWidth: 45 },
      1: { textColor: 20, fontStyle: 'bold' },
    },
    body: meta.map((m) => [m[0], m[1] || '—']),
    margin: { left: M, right: M },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5

  const section = (title: string) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(20)
    doc.text(title, M, y); y += 1.5
    doc.setDrawColor(210); doc.setLineWidth(0.2); doc.line(M, y, W - M, y); y += 5
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(40)
  }

  // ---- Descripción ----
  section('Descripción del trabajo')
  const desc = doc.splitTextToSize(a.descripcion || '—', W - 2 * M)
  doc.text(desc, M, y); y += desc.length * 4.6 + 4

  // ---- Materiales ----
  section('Materiales utilizados')
  autoTable(doc, {
    startY: y,
    head: [['Material', 'Código SAP', 'Cant.']],
    body: a.materiales.length
      ? a.materiales.map((m) => [m.nombre, m.codigoSap, String(m.cantidad)])
      : [['—', '—', '—']],
    theme: 'striped',
    headStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 2: { halign: 'right', cellWidth: 18 } },
    margin: { left: M, right: M },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5

  // ---- HSE ----
  section('Seguridad (HSE)')
  const hse = doc.splitTextToSize(a.hse || '—', W - 2 * M)
  doc.text(hse, M, y); y += hse.length * 4.6 + 4

  // ---- Evidencia ----
  if (a.fotos.length) {
    section('Evidencia fotográfica')
    let x = M
    const fw = 52, fh = 39
    for (const f of a.fotos) {
      if (x + fw > W - M) { x = M; y += fh + 4 }
      if (y + fh > H - 28) { doc.addPage(); y = 18 }
      try { doc.addImage(f, 'JPEG', x, y, fw, fh) } catch { /* foto inválida */ }
      x += fw + 4
    }
    y += fh + 6
  }

  // ---- Firma / pie ----
  const footY = Math.max(y + 6, H - 26)
  doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(M, footY, M + 52, footY)
  doc.setFontSize(8.5); doc.setTextColor(70)
  doc.text(`${a.creadoPor} · Supervisor`, M, footY + 4)
  doc.setFontSize(7.5); doc.setTextColor(130)
  doc.text(`Respaldo: ${a.correoRespaldo || '—'}`, W - M, footY - 1, { align: 'right' })
  doc.text(`cc: ${CC_FIJO}`, W - M, footY + 2.5, { align: 'right' })
  doc.text(`Generado por App United · ${a.folio}`, W - M, footY + 6, { align: 'right' })

  doc.save(`${a.folio}.pdf`)
}
