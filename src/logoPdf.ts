// El logo de United para los PDF.
//
// ⚠️ El archivo es de 1738×595 px y jsPDF lo mete tal cual como mapa de bits:
// el PDF se iba a 4 MB por un logo de 2,6 cm. Se reduce en un canvas y sale
// como JPEG sobre blanco —el logo ya tiene fondo blanco— y el PDF queda en
// unos pocos cientos de KB.
let guardado: string | null | undefined

export async function logoUnited(): Promise<string | null> {
  if (guardado !== undefined) return guardado
  guardado = null
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}united.png`)
    if (!r.ok) return null
    const blob = await r.blob()
    const bitmap = await createImageBitmap(blob)
    const ancho = 420
    const alto = Math.max(1, Math.round((bitmap.height / bitmap.width) * ancho))
    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto
    const ctx = lienzo.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, ancho, alto)
    ctx.drawImage(bitmap, 0, 0, ancho, alto)
    bitmap.close?.()
    guardado = lienzo.toDataURL('image/jpeg', 0.92)
    return guardado
  } catch {
    return null
  }
}
