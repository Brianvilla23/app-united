// PDF del aviso, en el formato de United (24-10-2026).
//
// Antes salía con "UNITED" escrito en texto y sin la marca. Ahora lleva el logo
// y la línea roja de los demás documentos de la app, y las secciones de los
// avisos que Brayan redacta en Word (Planificacion\Avisos .docx y "Aviso
// Semana +1"): nombre del aviso, requerimiento, dotación y tiempo estimado,
// materiales, seguridad; más la ubicación (zona y punto GPS) y las fotos.
//
// Y se envía EL ARCHIVO, no un link: `compartirPDFAviso` usa la hoja de
// compartir del teléfono con el PDF adjunto (WhatsApp, correo…); donde no se
// puede compartir archivos (computador), lo descarga.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Aviso } from './types'
import { fechaCorta } from './fecha'
import { logoUnited } from './logoPdf'

const CC_FIJO = 'brayan.villalobos.c@gmail.com'
const ROJO: [number, number, number] = [192, 0, 0]

/** Enlace a Google Maps del punto, para el PDF y la pantalla. */
export function enlaceMapa(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`
}

function nombreArchivo(a: Aviso): string {
  const titulo = a.titulo.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
  return `${a.folio}${titulo ? ' ' + titulo : ''}.pdf`
}

async function armarPDF(a: Aviso): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const logo = await logoUnited()
  const M = 14
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  // ---- Encabezado (se repite en cada hoja) ----
  const encabezado = () => {
    if (logo) doc.addImage(logo, 'JPEG', M, 10, 38, 13)
    else { doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...ROJO); doc.text('UNITED', M, 19) }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(20)
    doc.text('AVISO DE MANTENCIÓN', W - M, 15, { align: 'right' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90)
    doc.text(`Folio ${a.folio}  ·  Emitido ${fechaCorta()}`, W - M, 20.5, { align: 'right' })
    doc.setDrawColor(...ROJO); doc.setLineWidth(0.7); doc.line(M, 26, W - M, 26)
  }
  encabezado()
  let y = 33

  const espacio = (alto: number) => {
    if (y + alto > H - 24) { doc.addPage(); encabezado(); y = 33 }
  }
  const seccion = (titulo: string) => {
    espacio(14)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...ROJO)
    doc.text(titulo.toUpperCase(), M, y)
    doc.setDrawColor(235, 200, 200); doc.setLineWidth(0.3); doc.line(M, y + 1.6, W - M, y + 1.6)
    y += 6.5
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(35)
  }
  const parrafo = (texto: string) => {
    const lineas = doc.splitTextToSize(texto || '—', W - 2 * M) as string[]
    for (const l of lineas) { espacio(5); doc.text(l, M, y); y += 4.8 }
    y += 3
  }

  // ---- Nombre del aviso ----
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(120)
  doc.text('NOMBRE DEL AVISO', M, y)
  y += 6
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(15)
  const titulo = doc.splitTextToSize(a.titulo || '—', W - 2 * M) as string[]
  doc.text(titulo, M, y)
  y += titulo.length * 6.4 + 2

  // ---- Datos ----
  const u = a.ubicacion
  const datos: [string, string, string, string][] = [
    ['Tipo de aviso', a.tipo, 'Prioridad', a.prioridad],
    ['Zona', a.zona, 'Equipo / activo', a.equipo],
    ['Fecha del trabajo', a.fechaTrabajo, 'Detención del equipo', a.detencion ? 'Sí' : 'No'],
    ['Modo de falla', a.modoFalla || '—', 'Ubicación', u ? `${u.lat.toFixed(5)}, ${u.lng.toFixed(5)}` : '—'],
  ]
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    body: datos.map((f) => f.map((c) => c || '—')),
    styles: { fontSize: 9, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.2, textColor: 25, valign: 'middle' },
    columnStyles: {
      0: { fillColor: [248, 250, 252], textColor: 100, cellWidth: 32 },
      1: { fontStyle: 'bold' },
      2: { fillColor: [248, 250, 252], textColor: 100, cellWidth: 34 },
      3: { fontStyle: 'bold' },
    },
    margin: { left: M, right: M },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // ---- Requerimiento ----
  seccion('Requerimiento')
  parrafo(a.descripcion)

  // ---- Dotación y tiempo estimado ----
  seccion('Dotación y tiempo estimado')
  const personas = `${a.dotacion} ${a.dotacion === 1 ? 'persona' : 'personas'}`
  const horas = `${a.horas} ${Number(a.horas) === 1 ? 'hora' : 'horas'}`
  parrafo(`Dotación: ${personas}. El tiempo estimado para realizar este trabajo es de ${horas} con ${personas}.`
    + (a.detencion ? ' Requiere detención del equipo.' : ''))

  // ---- Materiales ----
  seccion('Materiales')
  autoTable(doc, {
    startY: y,
    head: [['Material', 'Código SAP', 'Cant.']],
    body: a.materiales.length
      ? a.materiales.map((m) => [m.nombre || '—', m.codigoSap || '—', String(m.cantidad)])
      : [['Sin materiales', '—', '—']],
    theme: 'grid',
    headStyles: { fillColor: ROJO, textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.2 },
    columnStyles: { 1: { cellWidth: 32 }, 2: { halign: 'right', cellWidth: 16 } },
    margin: { left: M, right: M, top: 33 },
    didDrawPage: (d) => { if (d.pageNumber > 1) encabezado() },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // ---- Seguridad ----
  seccion('Seguridad (HSE)')
  parrafo(a.hse)

  // ---- Ubicación ----
  if (u) {
    seccion('Ubicación')
    espacio(6)
    doc.text(`${a.zona || '—'}  ·  ${u.lat.toFixed(6)}, ${u.lng.toFixed(6)}`
      + (u.precision ? `  ·  precisión ±${Math.round(u.precision)} m` : '')
      + (u.fuente === 'mapa' ? '  ·  marcado en el mapa' : '  ·  GPS del teléfono'), M, y)
    y += 5.5
    doc.setTextColor(...ROJO)
    doc.textWithLink('Ver el punto en Google Maps', M, y, { url: enlaceMapa(u.lat, u.lng) })
    doc.setTextColor(35)
    y += 8
  }

  // ---- Evidencia ----
  if (a.fotos.length) {
    seccion('Evidencia fotográfica')
    let x = M
    const fw = 58, fh = 43.5
    espacio(fh + 4)
    for (const f of a.fotos) {
      if (x + fw > W - M + 0.1) { x = M; y += fh + 4 }
      if (y + fh > H - 24) { doc.addPage(); encabezado(); y = 33; x = M }
      try { doc.addImage(f, 'JPEG', x, y, fw, fh) } catch { /* foto inválida */ }
      x += fw + 4
    }
    y += fh + 8
  }

  // ---- Firma ----
  espacio(18)
  const fy = Math.max(y + 8, H - 34)
  doc.setDrawColor(150); doc.setLineWidth(0.3); doc.line(M, fy, M + 60, fy)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60)
  doc.text(`${a.creadoPor || '—'} · Supervisor`, M, fy + 4.5)

  // ---- Pie de cada hoja ----
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(130)
    doc.text(`Respaldo: ${a.correoRespaldo || '—'}  ·  cc: ${CC_FIJO}`, M, H - 10)
    doc.text(`App United · ${a.folio} · hoja ${i} de ${total}`, W - M, H - 10, { align: 'right' })
  }
  return doc
}

/** Descarga el PDF (computador, o si el teléfono no deja compartir). */
export async function descargarPDFAviso(a: Aviso): Promise<void> {
  const doc = await armarPDF(a)
  doc.save(nombreArchivo(a))
}

/** Comparte EL ARCHIVO PDF (no un link) con la hoja de compartir del
    teléfono. Si el equipo no puede compartir archivos, lo descarga. */
export async function compartirPDFAviso(a: Aviso): Promise<'compartido' | 'descargado' | 'cancelado'> {
  const doc = await armarPDF(a)
  const nombre = nombreArchivo(a)
  const archivo = new File([doc.output('blob')], nombre, { type: 'application/pdf' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [archivo] })) {
    try {
      // solo el archivo y un título: sin `url` ni `text`, para que no viaje un link
      await nav.share({ files: [archivo], title: nombre })
      return 'compartido'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado'
      // NotAllowedError (se venció el gesto del usuario) u otro: se descarga
    }
  }
  doc.save(nombre)
  return 'descargado'
}
