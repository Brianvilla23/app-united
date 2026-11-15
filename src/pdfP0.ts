// PDF de una actividad del Rack 4 de Planta 0, en el formato United (logo, línea
// roja, título a la derecha) y en UNA sola hoja: solo el plano, el avance y la
// leyenda, sin la hoja de detalle (pedido de Brayan, 15-11-2026).
//
// El plano es el mismo SVG de la pantalla (`planoP0.ts`), volcado vectorial con
// svg2pdf, así papel y pantalla no se pueden desincronizar.
import { jsPDF } from 'jspdf'
import { svg2pdf } from 'svg2pdf.js'
import { logoUnited } from './logoPdf'
import { fechaHora } from './fecha'

const ROJO: [number, number, number] = [192, 0, 0]

export interface LeyendaP0 { color: string; borde?: string; nombre: string; n: number }

export interface HojaP0 {
  titulo: string
  subtitulo: string
  svg: string
  vb: { ancho: number; alto: number }
  avance: { pct: number; detalle: string; color: string }
  leyenda: LeyendaP0[]
  total: { nombre: string; n: number }
  generadoPor: string
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export async function generarPDFP0(h: HojaP0): Promise<jsPDF> {
  // A3 apaisado: el rack completo entra con las etiquetas legibles; comprimido para WhatsApp
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true })
  const W = 420, H = 297, M = 14
  const logo = await logoUnited()

  // ---- encabezado United
  if (logo) doc.addImage(logo, 'JPEG', M, 9, 50, 17)
  else { doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...ROJO); doc.text('UNITED', M, 21) }
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(20)
  doc.text(h.titulo.toUpperCase(), W - M, 16, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(10.5).setTextColor(90)
  doc.text(h.subtitulo, W - M, 22.5, { align: 'right' })
  doc.setDrawColor(...ROJO).setLineWidth(0.9).line(M, 29, W - M, 29)

  // ---- franja de avance
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(100)
  doc.text(`Planta Desaladora · Coloso   ·   ${fechaHora()}   ·   ${h.generadoPor || 'sin identificar'}`, M, 36)
  doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(...rgb(h.avance.color))
  doc.text(`${h.avance.pct}%`, W - M, 38, { align: 'right' })
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(40)
  doc.text(h.avance.detalle, W - M - 30, 37, { align: 'right' })

  // ---- plano
  const cont = document.createElement('div')
  cont.style.cssText = 'position:fixed;left:-10000px;top:0;width:1600px;'
  cont.innerHTML = h.svg
  document.body.appendChild(cont)
  const yPlano = 43, altoLibre = H - yPlano - 30
  let alto = 0
  try {
    const svg = cont.querySelector('svg')
    if (svg) {
      const prop = h.vb.ancho / h.vb.alto
      const ancho = Math.min(W - 2 * M, altoLibre * prop)
      alto = ancho / prop
      await svg2pdf(svg, doc, { x: (W - ancho) / 2, y: yPlano, width: ancho, height: alto })
    }
  } finally {
    cont.remove()
  }

  // ---- leyenda en una fila, con los números en negrita
  let ly = Math.min(yPlano + alto + 10, H - 16)
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...ROJO)
  doc.text('LEYENDA', M, ly)
  doc.setDrawColor(235, 200, 200).setLineWidth(0.3).line(M, ly + 1.8, W - M, ly + 1.8)
  ly += 8
  const slot = (W - 2 * M - 70) / Math.max(1, h.leyenda.length)
  h.leyenda.forEach((it, i) => {
    const lx = M + i * slot
    doc.setFillColor(...rgb(it.color)).setDrawColor(...rgb(it.borde ?? '#64748b')).setLineWidth(0.4)
    doc.circle(lx + 3, ly - 1.2, 3, 'FD')
    doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(30)
    doc.text(it.nombre, lx + 8.5, ly)
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(15)
    doc.text(String(it.n), lx + 8.5 + doc.getTextWidth(it.nombre) + 3.5, ly + 0.2)
  })
  doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(30)
  doc.text(h.total.nombre, W - M - 22, ly, { align: 'right' })
  doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(15)
  doc.text(String(h.total.n), W - M, ly + 0.4, { align: 'right' })

  // ---- pie
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(140)
  doc.text('App United · uso interno', M, H - 7)
  return doc
}
