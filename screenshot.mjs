// Capturas del local, para mirar la app antes de dar algo por listo.
//   node screenshot.mjs
//
// Dos cosas que no son opcionales:
//  · Se corta Supabase. El local escribe en la MISMA base que usa la cuadrilla
//    en planta, así que una corrida de prueba puede dejar marcas falsas ahí.
//  · Se deja el nombre puesto en localStorage, si no la app arranca en
//    "¿Quién eres?" y no se llega a ninguna pantalla.
import { chromium } from 'playwright'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.route('**://*.supabase.co/**', (r) => r.abort())
await ctx.addInitScript(() => localStorage.setItem('united_quien_soy', 'B. Villalobos'))

const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('ERROR DE PÁGINA:', e.message))
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)

const volver = async () => { await page.goBack(); await page.waitForTimeout(700) }

// 1. menú
await page.screenshot({ path: 'ver_menu.png' })

// 2. estado de tapas + detalle de una tapa
await page.getByText('Estado de tapas').first().click()
await page.waitForTimeout(1200)
await page.screenshot({ path: 'ver_tapas.png', fullPage: true })
await page.getByRole('button', { name: 'Semi Rack B' }).click()
await page.waitForTimeout(600)
await page.getByText('K10', { exact: true }).click()
await page.waitForTimeout(700)
await page.screenshot({ path: 'ver_detalle_tapa.png' })
await page.locator('.modal-x').click()
await volver()

// 3. outage
await page.getByText('Outage Rack 12').first().click()
await page.waitForTimeout(800)
await page.screenshot({ path: 'ver_outage.png', fullPage: true })

// 4. instalación de manifold + detalle de un manifold con sus piezas
await page.getByText('Instalación de manifold').first().click()
await page.waitForTimeout(900)
await page.screenshot({ path: 'ver_manifolds.png', fullPage: true })
await page.evaluate(() => {
  const filas = ['A', 'BC', 'DE', 'FG', 'HI', 'JK', 'LM', 'NO', 'PQ', 'RS']
  const i = filas.indexOf('DE') * 4 + 0;
  [...document.querySelector('.fugas-scroll svg').querySelectorAll('g')][i]
    .dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(600)
await page.screenshot({ path: 'ver_detalle_manifold.png', fullPage: true })
await page.locator('.modal-x').click()
await volver()

// 5. prueba de presión
await page.getByText('Prueba de alta').first().click()
await page.waitForTimeout(900)
await page.screenshot({ path: 'ver_prueba.png', fullPage: true })
await page.getByText('D5', { exact: true }).click()
await page.waitForTimeout(600)
await page.screenshot({ path: 'ver_prueba_detalle.png' })

await browser.close()
console.log('OK — ver_*.png')
