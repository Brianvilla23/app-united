import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Andamio } from './types'

const CC_FIJO = 'brayan.villalobos.c@gmail.com'

export function generarPDFAndamio(a: Andamio): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const M = 16
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  let y = 18

  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(20)
  doc.text('UNITED', M, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110)
  doc.text('Planta Desaladora · Coloso', M, y + 5)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20)
  doc.text('Acta de levantamiento de andamio', M, y + 12)

  doc.setFontSize(12)
  doc.text(a.folio, W - M, y, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110)
  doc.text(`Emitido: ${new Date().toLocaleDateString('es-CL')}`, W - M, y + 5, { align: 'right' })

  y += 16
  doc.setDrawColor(30); doc.setLineWidth(0.5); doc.line(M, y, W - M, y)
  y += 7

  const tempo = a.temporalidad === 'dias' ? `${a.dias} día(s)` : 'Solo por el trabajo'
  const meta: [string, string][] = [
    ['Lugar / zona', a.lugar],
    ['Equipo / área', a.equipo],
    ['Uso del andamio', a.descripcionUso],
    ['Temporalidad', tempo],
    ['Cantidad de cuerpos', String(a.cantidadCuerpos)],
    ['Fecha de construcción', a.fechaConstruccion],
    ['Estado tarjeta', a.estadoTarjeta],
    ['Inspeccionado por', a.inspeccionadoPor],
    ['Próxima inspección', a.proximaInspeccion],
    ['Aviso subsecuente generado', a.subsecuenteGenerado ? 'Sí' : 'No'],
  ]
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.4, valign: 'top' },
    columnStyles: { 0: { textColor: 120, cellWidth: 50 }, 1: { textColor: 20, fontStyle: 'bold' } },
    body: meta.map((m) => [m[0], m[1] || '—']),
    margin: { left: M, right: M },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  const fotosBloque = (titulo: string, fotos: string[]) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(20)
    doc.text(titulo, M, y); y += 2
    doc.setDrawColor(210); doc.setLineWidth(0.2); doc.line(M, y, W - M, y); y += 5
    if (!fotos.length) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120)
      doc.text('Sin fotos.', M, y); y += 6
      return
    }
    let x = M
    const fw = 52, fh = 39
    for (const f of fotos) {
      if (x + fw > W - M) { x = M; y += fh + 4 }
      if (y + fh > H - 28) { doc.addPage(); y = 18 }
      try { doc.addImage(f, 'JPEG', x, y, fw, fh) } catch { /* foto inválida */ }
      x += fw + 4
    }
    y += fh + 6
  }

  fotosBloque('Evidencia — andamio', a.fotosAndamio)
  fotosBloque('Evidencia — tarjeta de andamio', a.fotosTarjeta)

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
