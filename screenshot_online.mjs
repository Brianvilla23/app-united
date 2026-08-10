import { chromium } from 'playwright'

const browser = await chromium.launch()
// contexto nuevo = sin caché ni service worker viejo, como una ventana incógnito
const ctx = await browser.newContext({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 })
// La publicada escribe en la base real de la cuadrilla: se corta Supabase para
// que revisar la app no le meta marcas falsas al rack.
await ctx.route('**://*.supabase.co/**', (r) => r.abort())
await ctx.addInitScript(() => localStorage.setItem('united_quien_soy', 'B. Villalobos'))
const page = await ctx.newPage()
await page.goto('https://brianvilla23.github.io/app-united/', { waitUntil: 'networkidle' })
await page.waitForTimeout(2000)
const tieneTapas = await page.getByText('Estado de tapas').count()
console.log('boton Estado de tapas encontrado:', tieneTapas)
if (tieneTapas > 0) {
  await page.getByText('Estado de tapas').first().click()
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: 'Semi Rack B' }).click().catch(() => {})
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'online_tapas.png', fullPage: true })
  console.log('captura guardada')
}
await browser.close()
