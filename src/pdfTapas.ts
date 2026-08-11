import { jsPDF } from 'jspdf'
import { svg2pdf } from 'svg2pdf.js'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { ANCHO, ALTO } from './rackLayout'
import PlanoRack from './PlanoRack'
import {
  ESTADOS_TAPA, LADOS, defEstadoTapa, estadoTapaDe, resumirTapas,
  type EstadoTapa, type LadoRack, type TapaEstado,
} from './types'
import { fechaHora } from './fecha'

// A3 apaisado: el plano de la app es ancho (1438 × 998), así que esta es la
// hoja donde entra COMPLETO y con las etiquetas legibles. En A4 vertical las
// vasijas quedarían de 5 mm y no se leerían.
const W = 420, H = 297
const MARGEN = 10
const Y_PLANO = 26

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export interface DatosPdfTapas {
  lado: LadoRack
  rack: number
  tapas: TapaEstado[]
  totalVasijas: number
  generadoPor: string
  ot?: string
}

/**
 * Dibuja el plano en el PDF usando EXACTAMENTE el mismo SVG que la app.
 * Se renderiza el componente PlanoRack a markup, se mete en un contenedor
 * oculto del documento (svg2pdf necesita un elemento vivo) y se vuelca al PDF.
 */
async function insertarPlano(doc: jsPDF, d: DatosPdfTapas, alto: number): Promise<void> {
  const markup = renderToStaticMarkup(
    createElement(PlanoRack, {
      modo: 'tapas' as const,
      vista: 'todo' as const,
      espejo: d.lado === 'descarga',
      tapaRec: new Map(d.tapas.map((t) => [t.vasija, t])),
      porVasija: new Map(),
      paraPdf: true,
    }),
  )

  const cont = document.createElement('div')
  cont.style.cssText = 'position:fixed;left:-10000px;top:0;width:1600px;'
  cont.innerHTML = markup
  document.body.appendChild(cont)
  try {
    const svg = cont.querySelector('svg')!
    const ancho = alto * (ANCHO / ALTO)
    await svg2pdf(svg, doc, { x: (W - ancho) / 2, y: Y_PLANO, width: ancho, height: alto })
  } finally {
    cont.remove()
  }
}

export async function generarPDFTapas(d: DatosPdfTapas): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
  const nombreLado = LADOS.find((l) => l.codigo === d.lado)!.nombre
  const resumen = resumirTapas(d.tapas, d.totalVasijas)

  // ------------------------------------------------------------- encabezado
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold').setFontSize(16)
  doc.text(`RACK ${d.rack}`, W / 2, 12, { align: 'center' })
  doc.setFontSize(11)
  doc.text(nombreLado.toUpperCase(), W / 2, 19, { align: 'center' })

  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(100, 116, 139)
  doc.text('Planta Desaladora · Coloso', MARGEN, 9)
  doc.text(fechaHora(), MARGEN, 13.5)
  if (d.ot) doc.text(`OT ${d.ot}`, MARGEN, 18)
  doc.text(d.generadoPor || 'sin identificar', MARGEN, d.ot ? 22.5 : 18)

  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(15, 23, 42)
  doc.text(`${resumen.porcentaje}%`, W - MARGEN, 12, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(100, 116, 139)
  doc.text(`${resumen.extraidas} de ${resumen.total} extraídas`, W - MARGEN, 17.5, { align: 'right' })

  // ------------------------------------------------------------- plano
  const ALTO_PLANO = 232
  await insertarPlano(doc, d, ALTO_PLANO)

  // ------------------------------------------------------------- leyenda abajo
  let ly = Y_PLANO + ALTO_PLANO + 12
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(15, 23, 42)
  doc.text('LEYENDA', MARGEN, ly)
  doc.setDrawColor(210, 217, 226).setLineWidth(0.3)
  doc.line(MARGEN, ly + 1.6, W - MARGEN, ly + 1.6)
  ly += 6

  // en una fila, repartida a lo ancho de la hoja
  const items = [
    ...ESTADOS_TAPA.map((e) => ({
      color: rgb(e.color), borde: [120, 130, 145] as [number, number, number],
      nombre: e.nombre, desc: e.descripcion, n: resumen.porEstado[e.codigo],
    })),
    {
      color: [255, 255, 255] as [number, number, number], borde: [185, 194, 205] as [number, number, number],
      nombre: 'Sin registrar', desc: 'Todavía no se revisa', n: resumen.total - resumen.registradas,
    },
  ]
  // los 6 estados ocupan la parte izquierda; el total y el avance cierran a la derecha
  const ANCHO_TOTAL = 96
  const slot = (W - 2 * MARGEN - ANCHO_TOTAL) / items.length
  items.forEach((it, i) => {
    const lx = MARGEN + i * slot
    doc.setFillColor(...it.color).setDrawColor(...it.borde).setLineWidth(0.25)
    doc.circle(lx + 2.4, ly, 2.4, 'FD')
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(15, 23, 42)
    doc.text(`${it.nombre} (${it.n})`, lx + 6.5, ly - 0.5)
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(100, 116, 139)
    doc.text(it.desc, lx + 6.5, ly + 3.5)
  })

  // recuadro de cierre: los 6 conteos de arriba suman este total
  const tx = W - MARGEN - ANCHO_TOTAL + 4
  doc.setDrawColor(203, 213, 225).setLineWidth(0.4)
  doc.line(tx - 6, ly - 5, tx - 6, ly + 5.5)

  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(15, 23, 42)
  doc.text('TOTAL', tx, ly - 0.5)
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(100, 116, 139)
  doc.text(`Vasijas del Rack ${d.rack}`, tx, ly + 3.5)
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(15, 23, 42)
  doc.text(`${resumen.total}`, tx + 40, ly + 1.5, { align: 'right' })

  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(15, 23, 42)
  doc.text('AVANCE', tx + 48, ly - 0.5)
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(100, 116, 139)
  doc.text(`${resumen.extraidas} extraídas de ${resumen.total}`, tx + 48, ly + 3.5)
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...rgb(defEstadoTapa('retirada').color))
  doc.text(`${resumen.porcentaje}%`, W - MARGEN, ly + 1.5, { align: 'right' })

  // ------------------------------------------------- página 2: pendientes
  const ordenVasija = (a: TapaEstado, b: TapaEstado) => {
    const pa = a.vasija.match(/^([A-Z]+)(\d+)$/), pb = b.vasija.match(/^([A-Z]+)(\d+)$/)
    if (!pa || !pb) return a.vasija.localeCompare(b.vasija)
    return pa[1] === pb[1] ? Number(pa[2]) - Number(pb[2]) : pa[1].localeCompare(pb[1])
  }

  // "pendiente" entra acá: la tapa sigue adentro, así que es trabajo por hacer
  const pendientes = (['aislada', 'agripada', 'seguros', 'pernos', 'pendiente'] as EstadoTapa[])
    .map((cod) => ({
      def: defEstadoTapa(cod),
      items: d.tapas.filter((t) => estadoTapaDe(t) === cod).sort(ordenVasija),
    }))
    .filter((g) => g.items.length > 0)
  const conFalla = pendientes.reduce((n, g) => n + g.items.length, 0)

  if (pendientes.length > 0) {
    doc.addPage('a3', 'landscape')
    doc.setTextColor(15, 23, 42).setFont('helvetica', 'bold').setFontSize(13)
    doc.text(`PENDIENTES · RACK ${d.rack} · ${nombreLado.toUpperCase()}`, MARGEN, 15)
    doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(100, 116, 139)
    doc.text(
      `${conFalla} tapas con falla  ·  ${resumen.total - resumen.registradas} sin registrar`,
      MARGEN, 21,
    )

    const COLS = 4
    const anchoCol = (W - 2 * MARGEN) / COLS
    let col = 0, y = 33
    const saltar = () => {
      col++
      if (col >= COLS) { doc.addPage('a3', 'landscape'); col = 0; y = 20 } else { y = 33 }
    }
    for (const g of pendientes) {
      if (y > H - 30) saltar()
      const x = MARGEN + col * anchoCol
      doc.setFillColor(...rgb(g.def.color)).setDrawColor(120, 130, 145).setLineWidth(0.25)
      doc.circle(x + 2.4, y - 1.3, 2.4, 'FD')
      doc.setTextColor(15, 23, 42).setFont('helvetica', 'bold').setFontSize(9.5)
      doc.text(`${g.def.nombre} — ${g.items.length}`, x + 6.5, y)
      y += 5.5
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(51, 65, 85)
      for (const t of g.items) {
        const partes: string[] = []
        if (t.aislada) partes.push('aislada')
        if (t.pendienteRetiro) partes.push('pendiente de retiro')
        if (t.tapaAgripada) partes.push('tapa agripada')
        if (t.segurosAgripados.length) partes.push(`seguros ${t.segurosAgripados.map((n) => n + 1).sort().join(',')}`)
        if (t.pernosRodados.length) partes.push(`pernos ${t.pernosRodados.map((n) => n + 1).sort().join(',')}`)
        doc.text(`${t.vasija}  ·  ${partes.join(' · ')}`, x + 6.5, y)
        y += 4.4
        if (y > H - 10) saltar()
      }
      y += 4
    }
  }

  return doc
}

export function nombreArchivoTapas(lado: LadoRack, rack: number): string {
  const f = new Date().toISOString().slice(0, 10)
  return `Tapas_Rack${rack}_${lado === 'descarga' ? 'Descarga' : 'Alimentacion'}_${f}.pdf`
}
