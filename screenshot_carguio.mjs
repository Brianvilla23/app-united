// Prueba del carguío de membrana con Supabase SIMULADO: ninguna petición llega
// a la base real (la cuadrilla está trabajando el Rack 6 en vivo).
// Recorre: Rack 6 → carguío → vasija D5 → 7 series a mano → Excel; y revisa
// que el Rack 3 (series traídas del escáner de Axel, sql/32) también abra el
// detalle de cada vasija.
//   node screenshot_carguio.mjs   (con `npm run dev` corriendo en :5173)
import { chromium } from 'playwright'
import ExcelJS from 'exceljs'

const subidas = []
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true })
await ctx.addInitScript(() => {
  localStorage.setItem('united_quien_soy', 'PRUEBA Mecánico')
  localStorage.setItem('united_modo', 'editar')
})
await ctx.route('**://*.supabase.co/**', async (r) => {
  const req = r.request()
  if (req.method() === 'GET' || req.method() === 'HEAD') return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  if (req.postData()) subidas.push(new URL(req.url()).pathname + ' ' + req.postData().slice(0, 160))
  return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
})

const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('ERROR DE PÁGINA:', e.message))
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })

const abrirCarguio = async (rack) => {
  await page.getByRole('button', { name: new RegExp(`Outage Rack ${rack}\\b`) }).first().click()
  await page.getByRole('button', { name: /Carguío de membrana/i }).first().click()
  await page.waitForTimeout(400)
}

// --- Rack 6: escáner ---
await abrirCarguio(6)
const pasos6 = await page.locator('body').innerText()
console.log('Rack 6 · muestra "de 2065 membranas":', /2[.]?065 membranas/i.test(pasos6))
await page.locator('svg text', { hasText: /^D5$/ }).first().click()
await page.waitForTimeout(300)
console.log('Rack 6 · abrió el detalle de 7:', await page.getByText(/membranas registradas/i).isVisible())
const series = ['PRUEBA7A1', 'PRUEBA6B2', 'PRUEBA5C3', 'PRUEBA4D4', 'PRUEBA3E5', 'PRUEBA2F6', 'LG-SW440R PRUEBA1']
for (const s of series) {
  await page.getByRole('button', { name: 'Escribir' }).first().click()
  await page.locator('.memb-escribir input').fill(s)
  await page.locator('.memb-escribir button').click()
  await page.waitForTimeout(150)
}
// la misma serie dos veces no entra
await page.screenshot({ path: 'shot_carguio_vasija.png' })
console.log('Rack 6 · resumen:', (await page.locator('.memb-resumen').innerText()).replace(/\s+/g, ' '))
await page.locator('input[placeholder="Nombre y apellido"]').fill('PRUEBA Supervisor')
await page.locator('input[placeholder="Opcional"]').click()
await page.locator('.modal-x').click()
await page.waitForTimeout(400)
await page.screenshot({ path: 'shot_carguio_rack6.png' })
console.log('Rack 6 · avance:', (await page.locator('.avance-top').innerText()).replace(/\s+/g, ' '))

const [descarga] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Excel' }).click(),
])
const ruta = 'shot_carguio.xlsx'
await descarga.saveAs(ruta)
const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(ruta)
console.log('Excel · archivo:', descarga.suggestedFilename(), '· hojas:', wb.worksheets.map((w) => w.name).join(', '))
console.log('Excel · CODIFICACION fila 5:', wb.getWorksheet('CODIFICACION').getRow(5).values.slice(1).join(' | '))
console.log('Excel · DETALLE filas:', wb.getWorksheet('DETALLE').rowCount - 1)
console.log('Excel · RESUMEN:', wb.getWorksheet('RESUMEN').getRow(2).values.slice(1).join(' | '))

// --- Rack 3: también vasija por vasija ---
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await abrirCarguio(3)
console.log('Rack 3 · cuenta membranas:', /2[.]?065 membranas/i.test(await page.locator('body').innerText()))
await page.locator('svg text', { hasText: /^D5$/ }).first().click()
await page.waitForTimeout(300)
console.log('Rack 3 · abre el detalle de 7:', await page.getByText(/membranas registradas/i).isVisible())
await page.screenshot({ path: 'shot_carguio_rack3.png' })

console.log('Subidas simuladas:', subidas.length)
subidas.slice(-2).forEach((s) => console.log('  ', s))
await browser.close()
