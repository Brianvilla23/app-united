// Prueba de las vasijas aisladas con Supabase SIMULADO: nada llega a la base
// real. Se aísla R15 en el carguío del Rack 6 y se revisa que de ahí en
// adelante salga del total y no se pueda marcar, y que antes del carguío no
// cambie nada.
//   node screenshot_aisladas.mjs   (con `npm run dev` corriendo en :5173)
import { chromium } from 'playwright'

const subidas = []
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.addInitScript(() => {
  localStorage.setItem('united_quien_soy', 'PRUEBA Mecánico')
  localStorage.setItem('united_modo', 'editar')
})
await ctx.route('**://*.supabase.co/**', async (r) => {
  const req = r.request()
  if (req.method() === 'GET' || req.method() === 'HEAD') return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  if (req.postData()) subidas.push(req.postData().slice(0, 140))
  return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
})
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('ERROR DE PÁGINA:', e.message))
page.on('dialog', (d) => d.accept())
await page.goto('http://localhost:5173', { waitUntil: 'load' })
await page.waitForTimeout(1500)
await page.getByRole('button', { name: /Outage Rack 6\b/ }).first().click()
await page.waitForTimeout(400)

const abrir = async (nombre) => {
  await page.getByRole('button', { name: new RegExp(nombre, 'i') }).first().click()
  await page.waitForTimeout(500)
}
const volver = async () => { await page.goBack(); await page.waitForTimeout(400) }
const texto = async (sel) => (await page.locator(sel).first().innerText()).replace(/\s+/g, ' ')
const tocar = async (vasija) => { await page.locator('svg text', { hasText: new RegExp(`^${vasija}$`) }).first().click(); await page.waitForTimeout(300) }

// 1) carguío: aislar R15
await abrir('Carguío de membrana')
console.log('Carguío antes:', await texto('.avance-top'))
await page.getByRole('button', { name: /Marcar aisladas/ }).click()
await page.locator('.vista-seg button', { hasText: 'Todo' }).click()
await tocar('R15')
console.log('Botón:', await texto('.aislar-seg'))
console.log('Carguío con R15 aislada:', await texto('.avance-top'))
await page.screenshot({ path: 'shot_aisladas_carguio.png' })
await page.getByRole('button', { name: /Cargar membranas/ }).click()
await tocar('R15')
console.log('Tocar R15 al cargar:', await texto('.aviso-aislar'), '· abrió detalle:', await page.getByText(/membranas registradas/i).isVisible())
await volver()

// 2) el listado del outage
const fila = async (nombre) => (await page.locator('ol.actividades li', { hasText: nombre }).first().innerText()).replace(/\s+/g, ' ')
console.log('Lista · carguío:', (await fila('Carguío de membrana')).match(/\d[\d.]* ítems/)?.[0])
console.log('Lista · limpieza interior (antes del carguío):', (await fila('Limpieza de vasija interior')).match(/\d[\d.]* ítems/)?.[0])
console.log('Lista · prueba de baja:', (await fila('Prueba de baja')).match(/\d[\d.]* ítems/)?.[0])

// 3) instalación de tapas de alimentación
await abrir('Instalación de tapas · alimentación')
await page.locator('.vista-seg button', { hasText: 'Todo' }).click().catch(() => {})
console.log('Tapas alim:', await texto('.avance-top'))
await tocar('R15')
console.log('Tocar R15 en tapas:', await texto('.aviso-aislar'))
await page.screenshot({ path: 'shot_aisladas_tapas.png' })
await volver()

// 4) prueba de baja
await abrir('Prueba de baja')
console.log('Prueba de baja:', await texto('.avance-top'))
await page.locator('.vista-seg button', { hasText: 'Todo' }).click()
await tocar('R15')
console.log('Tocar R15 en la prueba:', await texto('.aviso-aislar'))
await volver()

// 5) limpieza exterior (simple, dos lados) e instalación de manifold
await abrir('Limpieza exterior de vasijas')
console.log('Limpieza exterior:', await texto('.avance-top'))
await volver()
await abrir('Instalación de manifold')
console.log('Instalación de manifold:', await texto('.avance-top'))
await volver()

// 6) antes del carguío no cambia
await abrir('Limpieza de vasija interior')
console.log('Limpieza interior (antes):', await texto('.avance-top'))

console.log('Subidas simuladas:', subidas.filter((s) => s.includes('vasija_aislada')).length, 'de aislada ·', subidas.find((s) => s.includes('vasija_aislada')))
await browser.close()
