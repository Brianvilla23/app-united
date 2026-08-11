// PDF genérico de cualquier diagrama de la app.
//
// La regla que ya traía el PDF de tapas y que acá se generaliza: el papel sale
// del MISMO SVG que se ve en pantalla, no de una captura ni de un redibujo. Se
// renderiza el componente a markup, se mete en un contenedor oculto (svg2pdf
// necesita un elemento vivo del documento) y se vuelca al PDF vectorial. Así
// pantalla y papel no se pueden desincronizar.
import { jsPDF } from 'jspdf'
import { svg2pdf } from 'svg2pdf.js'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import { fechaHora } from './fecha'

export interface ItemLeyenda {
  color: string
  nombre: string
  desc: string
  n: number
  /** Para los estados sin relleno (pendiente, sin registrar). */
  hueco?: boolean
}

export interface GrupoDetalle {
  titulo: string
  color?: string
  lineas: string[]
}

export interface HojaDiagrama {
  titulo: string
  subtitulo: string
  /** El diagrama, tal cual lo dibuja la app. */
  diagrama: ReactElement
  /** Proporción del viewBox del diagrama, para que no se deforme. */
  vb: { ancho: number; alto: number }
  /** 'ancha' = A3 apaisado (los planos de 295 vasijas, que no entran en A4).
      'compacta' = A4 vertical (manifolds, venteos). */
  hoja: 'ancha' | 'compacta'
  avance?: { pct: number; detalle: string; color: string }
  leyenda: ItemLeyenda[]
  /** Segunda página: el detalle que no cabe en el dibujo. */
  detalle?: GrupoDetalle[]
  comentario?: { texto: string; quien: string }
  generadoPor: string
}

const MARGEN = 10
const Y_DIAGRAMA = 27

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function medidas(hoja: HojaDiagrama['hoja']) {
  return hoja === 'ancha'
    ? { W: 420, H: 297, formato: 'a3', orientacion: 'landscape' as const }
    : { W: 210, H: 297, formato: 'a4', orientacion: 'portrait' as const }
}

/** Vuelca el SVG de la app al PDF. Devuelve el alto que ocupó. */
async function insertarDiagrama(
  doc: jsPDF, h: HojaDiagrama, W: number, maxAlto: number,
): Promise<number> {
  const cont = document.createElement('div')
  cont.style.cssText = 'position:fixed;left:-10000px;top:0;width:1600px;'
  cont.innerHTML = renderToStaticMarkup(h.diagrama)
  document.body.appendChild(cont)
  try {
    const svg = cont.querySelector('svg')
    if (!svg) return 0
    // entra por lo que sea más apretado: el ancho de la hoja o el alto libre
    const porAncho = W - 2 * MARGEN
    const proporcion = h.vb.ancho / h.vb.alto
    const ancho = Math.min(porAncho, maxAlto * proporcion)
    const alto = ancho / proporcion
    await svg2pdf(svg, doc, { x: (W - ancho) / 2, y: Y_DIAGRAMA, width: ancho, height: alto })
    return alto
  } finally {
    cont.remove()
  }
}

export async function generarPDFDiagrama(h: HojaDiagrama): Promise<jsPDF> {
  const { W, H, formato, orientacion } = medidas(h.hoja)
  // comprimido: el plano de manifolds lleva la imagen del plano adentro y sin
  // esto la hoja pesa 1,5 MB, que en planta no se manda por WhatsApp
  const doc = new jsPDF({ orientation: orientacion, unit: 'mm', format: formato, compress: true })

  // ------------------------------------------------------------- encabezado
  doc.setTextColor(15, 23, 42).setFont('helvetica', 'bold').setFontSize(h.hoja === 'ancha' ? 15 : 12)
  doc.text(h.titulo.toUpperCase(), W / 2, 12, { align: 'center' })
  doc.setFontSize(h.hoja === 'ancha' ? 10 : 8.5)
  doc.text(h.subtitulo.toUpperCase(), W / 2, 18.5, { align: 'center' })

  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(100, 116, 139)
  doc.text('Planta Desaladora · Coloso', MARGEN, 9)
  doc.text(fechaHora(), MARGEN, 13.5)
  doc.text(h.generadoPor || 'sin identificar', MARGEN, 18)

  if (h.avance) {
    doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...rgb(h.avance.color))
    doc.text(`${h.avance.pct}%`, W - MARGEN, 12, { align: 'right' })
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(100, 116, 139)
    doc.text(h.avance.detalle, W - MARGEN, 17.5, { align: 'right' })
  }

  // ------------------------------------------------------------- diagrama
  const filas = Math.ceil(h.leyenda.length / (h.hoja === 'ancha' ? 6 : 2))
  const altoLeyenda = 14 + filas * 8
  const alto = await insertarDiagrama(doc, h, W, H - Y_DIAGRAMA - altoLeyenda - MARGEN)

  // ------------------------------------------------------------- leyenda
  let ly = Y_DIAGRAMA + alto + 10
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(15, 23, 42)
  doc.text('LEYENDA', MARGEN, ly)
  doc.setDrawColor(210, 217, 226).setLineWidth(0.3)
  doc.line(MARGEN, ly + 1.6, W - MARGEN, ly + 1.6)
  ly += 6.5

  const porFila = h.hoja === 'ancha' ? 6 : 2
  const slot = (W - 2 * MARGEN) / porFila
  h.leyenda.forEach((it, i) => {
    const lx = MARGEN + (i % porFila) * slot
    const y = ly + Math.floor(i / porFila) * 8
    if (it.hueco) doc.setFillColor(255, 255, 255).setDrawColor(185, 194, 205)
    else doc.setFillColor(...rgb(it.color)).setDrawColor(120, 130, 145)
    doc.setLineWidth(0.25)
    doc.circle(lx + 2.4, y, 2.4, 'FD')
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(15, 23, 42)
    doc.text(`${it.nombre} (${it.n})`, lx + 6.5, y - 0.5)
    doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(100, 116, 139)
    doc.text(it.desc, lx + 6.5, y + 3.5)
  })

  // -------------------------------------------- página 2: detalle y comentario
  const hayDetalle = (h.detalle ?? []).some((g) => g.lineas.length > 0)
  if (hayDetalle || h.comentario?.texto) {
    doc.addPage(formato, orientacion)
    doc.setTextColor(15, 23, 42).setFont('helvetica', 'bold').setFontSize(12)
    doc.text(`DETALLE · ${h.subtitulo.toUpperCase()}`, MARGEN, 15)

    let y = 26
    if (h.comentario?.texto) {
      doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(15, 23, 42)
      doc.text('COMENTARIO DEL RACK', MARGEN, y)
      y += 5.5
      doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(51, 65, 85)
      for (const linea of doc.splitTextToSize(h.comentario.texto, W - 2 * MARGEN) as string[]) {
        doc.text(linea, MARGEN, y)
        y += 4.6
      }
      if (h.comentario.quien) {
        doc.setFontSize(7).setTextColor(100, 116, 139)
        doc.text(`— ${h.comentario.quien}`, MARGEN, y)
        y += 5
      }
      y += 4
    }

    const COLS = h.hoja === 'ancha' ? 4 : 2
    const anchoCol = (W - 2 * MARGEN) / COLS
    let col = 0
    const yInicio = y
    const saltar = () => {
      col++
      if (col >= COLS) { doc.addPage(formato, orientacion); col = 0; y = 20 } else { y = yInicio }
    }
    for (const g of (h.detalle ?? []).filter((x) => x.lineas.length > 0)) {
      if (y > H - 30) saltar()
      const x = MARGEN + col * anchoCol
      if (g.color) {
        doc.setFillColor(...rgb(g.color)).setDrawColor(120, 130, 145).setLineWidth(0.25)
        doc.circle(x + 2.4, y - 1.3, 2.4, 'FD')
      }
      doc.setTextColor(15, 23, 42).setFont('helvetica', 'bold').setFontSize(9)
      doc.text(`${g.titulo} — ${g.lineas.length}`, x + (g.color ? 6.5 : 0), y)
      y += 5.2
      doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(51, 65, 85)
      for (const linea of g.lineas) {
        doc.text(linea, x + (g.color ? 6.5 : 0), y)
        y += 4.2
        if (y > H - 10) saltar()
      }
      y += 4
    }
  }

  return doc
}

/**
 * Agrupa vasijas por fila: `A · 2, 3, 4, 5` en vez de una línea por vasija.
 * Con 295 vasijas, la lista suelta no cabe en ninguna hoja y no se lee.
 */
export function agruparPorFila(vasijas: string[]): string[] {
  const filas = new Map<string, number[]>()
  for (const v of vasijas) {
    const m = v.match(/^([A-Z]+)(\d+)$/)
    if (!m) continue
    if (!filas.has(m[1])) filas.set(m[1], [])
    filas.get(m[1])!.push(Number(m[2]))
  }
  return [...filas.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([f, ns]) => `${f} · ${ns.sort((a, b) => a - b).join(', ')}`)
}

/** `Codificacion_Rack12_2026-08-11.pdf` */
export function nombreArchivo(...partes: string[]): string {
  const limpio = partes
    .filter(Boolean)
    .map((p) => p.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, ''))
  return `${limpio.join('_')}_${new Date().toISOString().slice(0, 10)}.pdf`
}
