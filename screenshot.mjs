import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 400, height: 840 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

// 1. Menú principal
await page.screenshot({ path: 'ver_menu.png' })

// 2. Estado de tapas — vista general (Semi Rack A)
await page.getByText('Estado de tapas').first().click()
await page.waitForTimeout(1200)
await page.screenshot({ path: 'ver_tapas.png', fullPage: true })

// 3. Detalle de una tapa (K10, en Semi Rack B)
await page.getByRole('button', { name: 'Semi Rack B' }).click()
await page.waitForTimeout(600)
await page.getByText('K10', { exact: true }).click()
await page.waitForTimeout(700)
await page.screenshot({ path: 'ver_detalle.png' })

await browser.close()
console.log('OK')
