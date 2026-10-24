// Prueba del aviso (24-10-2026) con Supabase SIMULADO y GPS simulado: zona
// nueva, GPS, mapa estilo Uber, dictado (ok, sin señal y detener), materiales
// del catálogo SAP y el PDF en formato United.
//   node screenshot_aviso.mjs <carpeta de salida>   (con `npm run dev` en :5173)
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'

const OUT = process.argv[2] ?? '.'
const subidas = []
const b = await chromium.launch()
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true,
  geolocation: { latitude: -23.76128, longitude: -70.46511, accuracy: 8 }, permissions: ['geolocation'],
})
await ctx.addInitScript(() => {
  localStorage.setItem('united_quien_soy', 'PRUEBA Supervisor')
  localStorage.setItem('united_modo', 'editar')
  // dictado simulado: el modo lo elige window.__modoDictado ('ok' | 'red' | 'eterno')
  class Falso {
    constructor() { this.lang = ''; this.onresult = null; this.onerror = null; this.onend = null }
    start() {
      window.__dictadosAbiertos = (window.__dictadosAbiertos ?? 0) + 1
      const modo = window.__modoDictado ?? 'ok'
      if (modo === 'red') { setTimeout(() => { this.onerror?.({ error: 'network' }); this.onend?.() }, 200); return }
      if (modo === 'ok') {
        setTimeout(() => this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: 'fuga en la tapa de la vasija' }], { isFinal: false })] }), 200)
        setTimeout(() => { this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: 'fuga en la tapa de la vasija G12 del rack 6' }], { isFinal: true })] }); this.onend?.() }, 500)
      }
      // 'eterno': nunca termina solo (como el dictado que "se quedaba pegado")
    }
    stop() { setTimeout(() => this.onend?.(), 50) }
  }
  window.webkitSpeechRecognition = Falso
  window.SpeechRecognition = Falso
})
await ctx.route('**://*.supabase.co/**', (r) => {
  const q = r.request()
  if (['GET', 'HEAD'].includes(q.method())) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  if (q.postData()) subidas.push({ url: new URL(q.url()).pathname, body: q.postData() })
  return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
})
const p = await ctx.newPage()
p.on('pageerror', (e) => console.log('ERROR DE PÁGINA:', e.message))
p.on('dialog', (d) => d.accept())
await p.goto(process.env.URL_APP ?? 'http://localhost:5173', { waitUntil: 'load' })
await p.waitForTimeout(1200)
await p.getByText('Nuevo aviso', { exact: true }).first().click()
await p.waitForTimeout(500)

await p.locator('input[placeholder^="Ej: Cambio"]').fill('PRUEBA Cambio de tapa vasija G12')
// zona que no está en la lista
await p.locator('select').filter({ hasText: 'Seleccionar zona' }).selectOption('__otra__')
await p.locator('input[placeholder^="Escribe la zona"]').fill('Patio Energy')
// GPS
await p.getByRole('button', { name: /Mi ubicación \(GPS\)/ }).click()
await p.waitForTimeout(800)
console.log('GPS:', (await p.locator('.ubic-chip span').innerText().catch(() => 'NO')).trim())
// mapa
await p.getByRole('button', { name: /Elegir en el mapa/ }).click()
await p.waitForSelector('.leaflet-container', { timeout: 15000 })
await p.waitForTimeout(3500)
await p.screenshot({ path: `${OUT}/aviso_mapa.png` })
const box = await p.locator('.mapa-leaflet').boundingBox()
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await p.mouse.down(); await p.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2 + 40, { steps: 8 }); await p.mouse.up()
await p.waitForTimeout(400)
console.log('Mapa · centro:', await p.locator('.mapa-coord').innerText())
await p.getByRole('button', { name: 'Confirmar este punto' }).click()
await p.waitForTimeout(300)
console.log('Tras el mapa:', (await p.locator('.ubic-chip span').innerText()).trim())

await p.locator('input[placeholder^="Ej: Vasija"]').fill('Vasija G12 Rack 6')
// dictado sin señal (red)
await p.evaluate(() => { window.__modoDictado = 'red' })
await p.getByRole('button', { name: /Dictar/ }).click()
await p.waitForTimeout(600)
console.log('Dictado sin red:', await p.locator('.aviso-ubic').last().innerText(), '· botón:', await p.locator('.desc-tools .btn.tool').nth(1).innerText())
// dictado que no termina solo → se detiene con el botón
await p.evaluate(() => { window.__modoDictado = 'eterno' })
await p.getByRole('button', { name: /Dictar/ }).click()
await p.waitForTimeout(300)
console.log('Dictado eterno · botón:', await p.locator('.desc-tools .btn.tool').nth(1).innerText(), '·', await p.locator('.dictado-vivo').innerText().catch(() => ''))
await p.getByRole('button', { name: /Detener/ }).click()
await p.waitForTimeout(300)
console.log('Tras detener · botón:', await p.locator('.desc-tools .btn.tool').nth(1).innerText())
// dictado normal
await p.evaluate(() => { window.__modoDictado = 'ok' })
await p.getByRole('button', { name: /Dictar/ }).click()
await p.waitForTimeout(900)
console.log('Dictado ok · texto:', await p.locator('textarea').first().inputValue(), '· aperturas:', await p.evaluate(() => window.__dictadosAbiertos))

// materiales
await p.locator('select').filter({ hasText: 'Sin especificar' }).selectOption('MF1')
await p.waitForTimeout(200)
console.log('MF1 en EWS:', await p.locator('.mat-tarjeta .mat-nom').evaluateAll((els) => els.map((e) => e.value + ' / ' + e.parentElement.querySelector('.mat-sap').value)))
await p.locator('.sec:has-text("Materiales") + .row2 select').first().selectOption('Planta 0')
await p.waitForTimeout(200)
console.log('MF1 en Planta 0:', await p.locator('.mat-tarjeta .mat-nom').evaluateAll((els) => els.map((e) => e.value)))
await p.locator('input[placeholder^="Nombre o código SAP"]').fill('seguro')
await p.waitForTimeout(200)
console.log('Buscar "seguro":', await p.locator('.mat-resultados li').count(), 'resultados')
await p.locator('.mat-resultados button').first().click()
await p.locator('.mat-cant button[aria-label="Más"]').last().click()
console.log('Materiales:', await p.locator('.mat-tarjeta').evaluateAll((els) => els.map((e) => `${e.querySelector('.mat-nom').value} · ${e.querySelector('.mat-sap').value} · x${e.querySelector('.mat-cant input').value}`)))
await p.locator('textarea').nth(1).fill('Bloqueo y drenado del equipo. Uso de EPP.')
await p.locator('.ubic-chip').scrollIntoViewIfNeeded()
await p.evaluate(() => document.querySelector('.ubic-chip').scrollIntoView({ block: 'center' }))
await p.screenshot({ path: `${OUT}/aviso_form_ubicacion.png` })
await p.locator('input[placeholder^="Nombre o código SAP"]').fill('o-ring')
await p.waitForTimeout(200)
await p.evaluate(() => document.querySelector('.mat-resultados')?.scrollIntoView({ block: 'center' }))
await p.screenshot({ path: `${OUT}/aviso_form_materiales.png` })
await p.locator('input[placeholder^="Nombre o código SAP"]').fill('')

// guardar y enviar PDF (sin hoja de compartir en el computador → descarga)
const [descarga] = await Promise.all([
  p.waitForEvent('download', { timeout: 20000 }),
  p.getByRole('button', { name: /Guardar y enviar PDF/ }).click(),
])
const ruta = `${OUT}/aviso_prueba.pdf`
await descarga.saveAs(ruta)
console.log('PDF:', descarga.suggestedFilename(), readFileSync(ruta).length, 'bytes')
const aviso = subidas.find((s) => s.url.endsWith('/avisos'))
console.log('Sube a la base · zona y ubicación:', aviso ? JSON.stringify((({ zona, ubicacion, modo_falla }) => ({ zona, ubicacion, modo_falla }))(JSON.parse(aviso.body))) : 'NO SUBIÓ')

// la zona nueva quedó guardada para la próxima
await p.waitForTimeout(500)
console.log('Zonas agregadas:', await p.evaluate(() => localStorage.getItem('united_zonas_extra')))

// la primera hoja del PDF como imagen (con el PDF.js de la app)
const pdfB64 = readFileSync(ruta).toString('base64')
const v = await b.newPage({ viewport: { width: 900, height: 1300 } })
await v.goto('http://localhost:5173/vendor/pdf.min.js')
await v.setContent('<body style="margin:0;background:#888"><canvas id="c"></canvas></body>')
await v.addScriptTag({ url: 'http://localhost:5173/vendor/pdf.min.js' })
await v.evaluate(async (b64) => {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'http://localhost:5173/vendor/pdf.worker.min.js'
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const doc = await window.pdfjsLib.getDocument({ data: bytes }).promise
  const pg = await doc.getPage(1)
  const vp = pg.getViewport({ scale: 1.45 })
  const c = document.getElementById('c'); c.width = vp.width; c.height = vp.height
  await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise
}, pdfB64)
await v.locator('#c').screenshot({ path: `${OUT}/aviso_pdf_hoja1.png` })
writeFileSync(`${OUT}/aviso_subida.json`, aviso?.body ?? '')
await b.close()
