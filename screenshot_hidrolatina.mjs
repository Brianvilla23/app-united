// Prueba del levantamiento Hidrolatina con Supabase SIMULADO: nada llega a la
// base real. Levanta su propio Vite, entra por el link (#hidrolatina), marca
// manifolds y vasijas en el Rack 3 y revisa lo que se mandaría a la base.
//   node screenshot_hidrolatina.mjs
import { chromium } from 'playwright'
import { createServer } from 'vite'

const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' })
await server.listen()
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
  if (req.postData()) subidas.push(req.postData())
  return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
})
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('ERROR DE PÁGINA:', e.message))
const texto = async (sel) => (await page.locator(sel).first().innerText()).replace(/\s+/g, ' ')

await page.goto('http://localhost:5199/#hidrolatina', { waitUntil: 'load' })
await page.waitForTimeout(1500)
console.log('Abre directo:', await texto('.topbar'))
await page.locator('.hidro-racks button', { hasText: /^3$/ }).click()

// manifolds: A1 y BC2 blanco, A3 gris; luego se borra BC2
const zona = (id) => page.locator(`[data-mf="${id}"]`)
await zona('A1').click(); await zona('BC2').click()
await page.getByRole('button', { name: /Gris · Comando/ }).click()
await zona('A3').click()
console.log('Cuenta:', await texto('.hidro-cuenta'))
await page.screenshot({ path: 'shot_hidro_descarga.png' })
await page.getByRole('button', { name: /^Borrar$/ }).click()
await zona('BC2').click()
console.log('Tras borrar BC2:', await texto('.hidro-cuenta'), '·', await texto('.hidro-ultimo'))

// vasijas
await page.getByRole('button', { name: /Alimentación · vasijas/ }).click()
const vas = async (v) => { await page.locator('svg text', { hasText: new RegExp(`^${v}$`) }).first().click(); await page.waitForTimeout(150) }
await vas('D3'); await vas('E5')
await page.getByRole('button', { name: /Tapón interno a cambiar/ }).click()
await vas('E5'); await vas('H2')
console.log('Vasijas:', await texto('.hidro-cuenta'))
console.log('Ancho página:', await page.evaluate(() => document.documentElement.scrollWidth))
await page.screenshot({ path: 'shot_hidro_alim.png', fullPage: true })

await page.waitForTimeout(1500)
const de = subidas.filter((s) => s.includes('hidrolatina_'))
console.log('Subidas simuladas:', de.length)
for (const s of de) { const p = JSON.parse(s); console.log('  ', p.actividad, p.rack, p.lado, p.item, p.hecho, JSON.stringify(p.datos?.color ?? '')) }
console.log('¿Tocó vasija_aislada del outage?:', subidas.some((s) => s.includes('vasija_aislada')))

// la planilla que baja Planificación
const [descarga] = await Promise.all([
  page.waitForEvent('download'),
  page.evaluate(async () => { const m = await import('/src/levantamientoHidro.ts'); await m.bajarExcelHidrolatina() }),
])
await descarga.saveAs('prueba_hidrolatina.xlsx')
console.log('Excel:', descarga.suggestedFilename())

// atrás lleva al menú, no fuera de la app
await page.goBack(); await page.waitForTimeout(400)
console.log('Atrás →', (await texto('.menu h1').catch(() => 'NO ESTÁ EN EL MENÚ')))
await page.screenshot({ path: 'shot_hidro_menu.png' })

await browser.close()
await server.close()
