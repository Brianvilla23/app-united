// Prueba del PGP con Supabase SIMULADO: ninguna petición llega a la base real.
// Recorre: cargar sin señal → sube sola al volver → ver la foto de otro
// supervisor → borrar (la reciente sí, la de hace días no) → PDF de la semana.
//   node screenshot_pgp.mjs
import { chromium } from 'playwright'

const filas = []              // pgp_imagenes simulada
const archivos = new Map()    // bucket simulado: ruta → bytes
let fuera = 0

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.addInitScript(() => localStorage.setItem('united_quien_soy', 'B. Villalobos'))

const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('ERROR DE PÁGINA:', e.message))

// Una "planilla" dibujada en el navegador
const planilla = async (titulo, color) => {
  const url = await page.evaluate(([t, c]) => {
    const k = document.createElement('canvas'); k.width = 900; k.height = 1200
    const x = k.getContext('2d')
    x.fillStyle = '#fff'; x.fillRect(0, 0, 900, 1200)
    x.fillStyle = c; x.fillRect(0, 0, 900, 110)
    x.fillStyle = '#fff'; x.font = 'bold 44px sans-serif'; x.fillText(t, 40, 72)
    x.fillStyle = '#222'; x.font = '30px sans-serif'
    for (let i = 0; i < 14; i++) { x.strokeStyle = '#999'; x.strokeRect(40, 160 + i * 70, 820, 60); x.fillText(`${i + 1}. Ítem de control`, 60, 200 + i * 70) }
    return k.toDataURL('image/jpeg', 0.8)
  }, [titulo, color])
  return { name: `${titulo}.jpg`, mimeType: 'image/jpeg', buffer: Buffer.from(url.split(',')[1], 'base64') }
}

await ctx.route('**://*.supabase.co/**', async (r) => {
  const req = r.request(); const u = new URL(req.url()); const p = decodeURIComponent(u.pathname)
  const json = (b, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) })
  if (p.endsWith('/rest/v1/pgp_imagenes')) {
    if (req.method() === 'GET') return json(filas)
    if (req.method() === 'POST') { const f = JSON.parse(req.postData()); filas.push({ ...f, creado_en: new Date().toISOString() }); return r.fulfill({ status: 201, body: '' }) }
    if (req.method() === 'DELETE') {
      const id = u.searchParams.get('id').replace('eq.', '')
      const i = filas.findIndex((f) => f.id === id)
      const reciente = i >= 0 && Date.now() - Date.parse(filas[i].creado_en) < 864e5
      if (reciente) { filas.splice(i, 1); return json([{ id }]) }
      return json([])   // lo que hace RLS: no borra y no avisa
    }
  }
  if (p.startsWith('/storage/v1/object/sign/')) {
    const ruta = p.replace('/storage/v1/object/sign/adjuntos/', '')
    if (req.method() === 'POST') return json({ signedURL: `/object/sign/adjuntos/${ruta}?token=x` })
    return r.fulfill({ status: 200, contentType: 'image/jpeg', body: archivos.get(ruta) ?? Buffer.alloc(0) })
  }
  if (p.startsWith('/storage/v1/object/adjuntos/') && req.method() === 'POST') {
    archivos.set(p.replace('/storage/v1/object/adjuntos/', ''), req.postDataBuffer()); return json({ Key: p })
  }
  if (p === '/storage/v1/object/adjuntos' && req.method() === 'DELETE') return json([])
  fuera++; return r.abort()   // el resto (sync del rack) se corta: no sale nada
})
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
// La foto de "otro supervisor", ya arriba: cargada hace 3 días (no se puede borrar sin cuenta)
const martes = await page.evaluate(() => {
  const d = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' }) + 'T12:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 5) % 7)); return d.toISOString().slice(0, 10)
})
const otra = await planilla('Charla de N. Hernández', '#334155')
filas.push({ id: 'otro-1', registro: 'charla', dia: martes, ruta: `pgp/charla/${martes}/otro-1.jpg`, ancho: 900, alto: 1200, subido_por: 'N. Hernández', creado_en: new Date(Date.now() - 3 * 864e5).toISOString() })
archivos.set(`pgp/charla/${martes}/otro-1.jpg`, otra.buffer)

await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(600)

await page.getByText('Supervisores', { exact: true }).click(); await page.waitForTimeout(300)
await page.getByText('PGP', { exact: true }).click(); await page.waitForTimeout(1200)
await page.screenshot({ path: 'ver_pgp_home.png' })
await page.getByText('Charla de inicio de turno').click(); await page.waitForTimeout(500)

// 1) sin señal: cargar 2 fotos el miércoles
await ctx.setOffline(true)
await page.locator('.pgp-dia').nth(1).click(); await page.waitForTimeout(300)
await page.locator('input[type=file][multiple]').setInputFiles([await planilla('Charla miércoles A', '#c00000'), await planilla('Charla miércoles B', '#c00000')])
await page.waitForTimeout(1200)
const porSubirOff = await page.locator('.pgp-por-subir').count()
await page.screenshot({ path: 'ver_pgp_sin_senal.png' })

// 2) vuelve la señal: suben solas
await ctx.setOffline(false)
await page.evaluate(() => window.dispatchEvent(new Event('online')))
await page.waitForTimeout(2500)
const porSubirOn = await page.locator('.pgp-por-subir').count()
const subidasArriba = filas.filter((f) => f.subido_por === 'B. Villalobos').length
await page.locator('.modal-x').click(); await page.waitForTimeout(300)

// 3) la foto del otro supervisor (martes): se ve, pero no se puede borrar
await page.locator('.pgp-dia').nth(0).click(); await page.waitForTimeout(1500)
const veOtra = await page.locator('.pgp-foto img').count()
page.once('dialog', (d) => d.accept())
await page.locator('.pgp-foto .memb-x').first().click(); await page.waitForTimeout(800)
const avisoViejo = await page.locator('.memb-aviso').innerText().catch(() => '')
await page.screenshot({ path: 'ver_pgp_dia.png' })
await page.locator('.modal-x').click(); await page.waitForTimeout(300)

// 4) borrar una propia recién subida: sí
await page.locator('.pgp-dia').nth(1).click(); await page.waitForTimeout(500)
page.once('dialog', (d) => d.accept())
await page.locator('.pgp-foto .memb-x').first().click(); await page.waitForTimeout(800)
const quedanMiercoles = await page.locator('.pgp-foto').count()
await page.locator('.modal-x').click(); await page.waitForTimeout(300)
await page.screenshot({ path: 'ver_pgp_charla.png' })

// 5) PDF de la semana: trae también la del otro supervisor
const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /PDF de la semana/ }).click()])
await descarga.saveAs('prueba_pgp_semana.pdf')

console.log(JSON.stringify({ porSubirOff, porSubirOn, subidasArriba, veOtra, avisoViejo, quedanMiercoles, filasArriba: filas.length, peticionesCortadas: fuera }, null, 1))
await browser.close()
