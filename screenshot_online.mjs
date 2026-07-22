import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 520, height: 1200 }, deviceScaleFactor: 2 })
await page.goto('https://brianvilla23.github.io/app-united/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.getByText('Diagrama de fugas').first().click()
await page.waitForTimeout(1500)
const svg = page.locator('.fugas-scroll svg')
await svg.screenshot({ path: 'shot_online.png' })
await browser.close()
console.log('OK online')
