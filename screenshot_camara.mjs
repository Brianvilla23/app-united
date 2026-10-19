// El escáner de la app con una CÁMARA SIMULADA: Chromium recibe como cámara un
// video armado con una etiqueta Code 128 (serie numérica, como Hydranautics).
// Supabase simulado: nada llega a la base real.
//   node screenshot_camara.mjs <carpeta temporal> [rack]   (URL_APP=… para probar lo publicado)
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const S = process.argv[2]
const rack = process.argv[3] ?? '6'
const P = '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232'.split(' ')

// 1) la etiqueta, como JPEG 1280x720 → video MJPEG de un cuadro
const gen = await chromium.launch()
const g = await gen.newPage({ viewport: { width: 1280, height: 720 } })
await g.setContent('<body style="margin:0"><canvas id="k" width="1280" height="720"></canvas></body>')
await g.evaluate((P) => {
  const texto = '13999991'
  const vals = [104, ...[...texto].map((c) => c.charCodeAt(0) - 32)]
  vals.push(vals.reduce((n, v, i) => n + v * (i || 1), 0) % 103)
  const anchos = (vals.map((v) => P[v]).join('') + '2331112').split('').map(Number)
  const x = document.getElementById('k').getContext('2d')
  x.fillStyle = '#cfc8b4'; x.fillRect(0, 0, 1280, 720)
  x.fillStyle = '#fff'; x.fillRect(300, 220, 680, 300)
  x.fillStyle = '#111'; x.font = 'bold 34px sans-serif'; x.fillText('HYDRANAUTICS SWC6-LD', 330, 270)
  const total = anchos.reduce((a, b) => a + b, 0); const mod = 560 / total
  let px = 360, negro = true
  for (const a of anchos) { if (negro) x.fillRect(px, 300, a * mod, 140); px += a * mod; negro = !negro }
  x.font = '30px monospace'; x.fillText(texto, 520, 485)
}, P)
writeFileSync(`${S}/etiqueta_camara.mjpeg`, await g.screenshot({ type: 'jpeg', quality: 92 }))
writeFileSync(`${S}/etiqueta_camara.png`, await g.screenshot({ type: 'png' }))
await gen.close()

// 2) la app, con esa "cámara"
const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    `--use-file-for-fake-video-capture=${S}/etiqueta_camara.mjpeg`],
})
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['camera'] })
await ctx.addInitScript(() => {
  // un teléfono con zoom (la cámara simulada no lo trae)
  const caps = MediaStreamTrack.prototype.getCapabilities
  MediaStreamTrack.prototype.getCapabilities = function () { return { ...(caps ? caps.call(this) : {}), zoom: { min: 1, max: 5, step: 0.1 } } }
  const ac = MediaStreamTrack.prototype.applyConstraints
  MediaStreamTrack.prototype.applyConstraints = function (c) { window.__zoom = c?.advanced?.[0]?.zoom ?? window.__zoom; return ac.call(this, {}).catch(() => {}) }
  localStorage.setItem('united_quien_soy', 'PRUEBA Mecánico')
  localStorage.setItem('united_modo', 'editar')
})
const subidas = []
await ctx.route('**://*.supabase.co/**', async (r) => {
  const req = r.request()
  if (req.method() === 'GET' || req.method() === 'HEAD') return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  if (req.postData()) subidas.push(req.postData().slice(0, 200))
  return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
})
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('ERROR DE PÁGINA:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLA:', m.text().slice(0, 200)) })
await page.goto(process.env.URL_APP ?? 'http://localhost:5173', { waitUntil: 'load' })
await page.waitForTimeout(1500)
await page.getByRole('button', { name: new RegExp(`Outage Rack ${rack}\\b`) }).first().click()
await page.getByRole('button', { name: /Carguío de membrana/i }).first().click()
await page.waitForTimeout(500)
await page.locator('svg text', { hasText: /^S1$/ }).first().click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /Escanear/ }).click()
for (let s = 1; s <= 12; s++) {
  await page.waitForTimeout(1000)
  const cartel = await page.locator('.escaner-cartel').innerText().catch(() => '')
  const msj = await page.locator('.escaner-msj').innerText().catch(() => '')
  const pie = await page.locator('.escaner-pie').innerText().catch(() => '')
  console.log(`${s}s · ${msj.replace(/\s+/g, ' ')} ${cartel ? '· CARTEL: ' + cartel.replace(/\s+/g, ' ') : ''} · ${pie.replace(/\s+/g, ' ').slice(-40)}`)
  if (cartel) break
}
const barra = page.locator('.escaner-zoom input')
console.log('Barra de zoom visible:', await barra.isVisible().catch(() => false))
if (await barra.isVisible().catch(() => false)) {
  await barra.fill('3')
  await page.waitForTimeout(300)
  console.log('Zoom pedido a la cámara:', await page.evaluate(() => window.__zoom), '·', await page.locator('.escaner-zoom span').innerText())
}
await page.waitForTimeout(2000)
await page.screenshot({ path: `${S}/camara_app.png` })
console.log('Subidas:', subidas.length, subidas.at(-1) ?? '')
await browser.close()
