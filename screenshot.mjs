import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 520, height: 1250 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.getByText('Estado de tapas').first().click()
await page.waitForTimeout(1200)
await page.getByRole('button', { name: 'Semi Rack B' }).click()
await page.waitForTimeout(600)
await page.getByText('K10', { exact: true }).click()
await page.waitForTimeout(700)
// marcar el perno 1 y un seguro
const svg = page.locator('.modal svg')
const box = await svg.boundingBox()
// perno 1 (arriba-derecha aprox) y seguro superior
await page.mouse.click(box.x + box.width * 0.72, box.y + box.height * 0.33) // perno
await page.waitForTimeout(300)
await page.mouse.click(box.x + box.width * 0.50, box.y + box.height * 0.16) // seguro superior
await page.waitForTimeout(500)
await page.locator('.modal').screenshot({ path: 'shot_tapa_detalle.png' })
await browser.close()
console.log('OK')
