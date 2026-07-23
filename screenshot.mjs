import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 520, height: 1200 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.getByText('Estado de tapas').first().click()
await page.waitForTimeout(1000)
await page.getByRole('button', { name: 'Semi Rack B' }).click()
await page.waitForTimeout(800)
// abrir el detalle de K10 (agripada) tocando su vasija
await page.getByText('K10', { exact: true }).click()
await page.waitForTimeout(800)
await page.locator('.modal').screenshot({ path: 'shot_tapa_detalle.png' })
await browser.close()
console.log('OK detalle')
