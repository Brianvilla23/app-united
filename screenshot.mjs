import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 520, height: 1250 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.getByText('Estado de tapas').first().click()
await page.waitForTimeout(1200)
await page.getByRole('button', { name: 'Semi Rack B' }).click()
await page.waitForTimeout(800)
await page.locator('.fugas-scroll svg').screenshot({ path: 'shot_tapas_b.png' })
await browser.close()
console.log('OK')
