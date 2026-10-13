// PDF del PGP: una imagen por hoja A4, con el encabezado de United, el
// registro, el día y quién la cargó. Sirve igual para un día o para toda la
// semana: se le pasan las imágenes y las ordena por día.
import { jsPDF } from 'jspdf'
import { logoUnited } from './logoPdf'
import { nombreRegistro, type ImagenPgp, type RegistroPgp } from './pgp'

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export function nombreDia(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00')
  const [, m, dd] = fecha.split('-')
  return `${DIAS[d.getDay()]} ${dd}-${m}`
}

export async function pdfPgp(
  registro: RegistroPgp, imagenes: ImagenPgp[], rotulo: string, archivo: string,
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const logo = await logoUnited()
  const W = 210, H = 297, M = 12

  imagenes.forEach((img, i) => {
    if (i > 0) doc.addPage()
    if (logo) doc.addImage(logo, 'JPEG', M, M, 34, 11.6)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13)
    doc.text(`PGP · ${nombreRegistro(registro)}`, W - M, M + 5, { align: 'right' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(100)
    // jsPDF escribe en WinAnsi: la flecha "→" sale como basura (ver §20)
    doc.text(rotulo.replace('→', '-'), W - M, M + 10.5, { align: 'right' })
    doc.setDrawColor(192, 0, 0); doc.setLineWidth(0.6)
    doc.line(M, M + 15, W - M, M + 15)

    doc.setTextColor(15); doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
    const delDia = imagenes.filter((x) => x.dia === img.dia)
    const n = delDia.indexOf(img) + 1
    doc.text(
      `${nombreDia(img.dia)[0].toUpperCase()}${nombreDia(img.dia).slice(1)}` +
        (delDia.length > 1 ? `  ·  imagen ${n} de ${delDia.length}` : ''),
      M, M + 22,
    )

    // la imagen entra entera en el espacio libre, sin deformarse
    const top = M + 26, alto = H - top - M - 8, ancho = W - 2 * M
    const f = Math.min(ancho / img.ancho, alto / img.alto)
    const w = img.ancho * f, h = img.alto * f
    doc.addImage(img.imagen, 'JPEG', M + (ancho - w) / 2, top, w, h, undefined, 'FAST')

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120)
    doc.text(`Cargó: ${img.subidoPor}`, M, H - M)
    doc.text(`Hoja ${i + 1} de ${imagenes.length}`, W - M, H - M, { align: 'right' })
  })

  doc.save(archivo)
}
