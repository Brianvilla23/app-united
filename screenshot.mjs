import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 520, height: 1200 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await page.getByText('Diagrama de fugas').first().click()
await page.waitForTimeout(1200)

// captura solo el SVG del diagrama (detalle)
const svg = page.locator('.fugas-scroll svg')
await svg.screenshot({ path: 'shot_fugas.png' })

// abre el detalle de una vasija para ver la vista de la vasija
await page.locator('.fugas-scroll svg g').nth(20).click().catch(() => {})
await page.waitForTimeout(600)
const modal = page.locator('.modal svg')
if (await modal.count()) await modal.first().screenshot({ path: 'shot_detalle.png' })

await browser.close()
console.log('OK screenshots')
