// El escáner de la app con una CÁMARA SIMULADA: Chromium recibe como cámara una
// imagen con un código de barras, y se abre el escáner del carguío como lo usa
// la cuadrilla. Supabase simulado: nada llega a la base real.
//   node screenshot_camara.mjs <carpeta temporal> [rack]
//   (URL_APP=https://app-united.pages.dev/ para probar lo publicado)
// Prueba un código de cada tipo: Code 128 numérico (Hydranautics), Code 128
// con letras (LG), EAN-13 (el "normal" de un producto) e ITF.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const S = process.argv[2]
const rack = process.argv[3] ?? '6'

// --- generadores: devuelven la tira de módulos ('1' barra, '0' espacio) ---
const C128 = '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232'.split(' ')
const deAnchos = (anchos) => anchos.map((a, i) => (i % 2 ? '0' : '1').repeat(a)).join('')
function code128(t) {
  const v = [104, ...[...t].map((c) => c.charCodeAt(0) - 32)]
  v.push(v.reduce((n, x, i) => n + x * (i || 1), 0) % 103)
  return deAnchos((v.map((x) => C128[x]).join('') + '2331112').split('').map(Number))
}
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R = L.map((p) => [...p].map((b) => (b === '0' ? '1' : '0')).join(''))
const PARIDAD = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']
function ean13(doce) {
  const d = [...doce].map(Number)
  const suma = d.reduce((n, x, i) => n + x * (i % 2 ? 3 : 1), 0)
  d.push((10 - (suma % 10)) % 10)
  const par = PARIDAD[d[0]]
  const izq = d.slice(1, 7).map((x, i) => (par[i] === 'L' ? L : G)[x]).join('')
  const der = d.slice(7).map((x) => R[x]).join('')
  return { bits: '101' + izq + '01010' + der + '101', texto: d.join('') }
}
const ITF = ['nnwwn', 'wnnnw', 'nwnnw', 'wwnnn', 'nnwnw', 'wnwnn', 'nwwnn', 'nnnww', 'wnnwn', 'nwnwn']
function itf(t) {
  const anchos = [1, 1, 1, 1]
  for (let i = 0; i < t.length; i += 2) {
    const a = ITF[+t[i]], b = ITF[+t[i + 1]]
    for (let k = 0; k < 5; k++) anchos.push(a[k] === 'w' ? 3 : 1, b[k] === 'w' ? 3 : 1)
  }
  anchos.push(3, 1, 1)
  return deAnchos(anchos)
}

const e = ean13('780123456789')
const CASOS = [
  { nombre: 'Code 128 numérico (Hydranautics)', bits: code128('13999991'), texto: '13999991' },
  { nombre: 'Code 128 con letras (LG)', bits: code128('BE8A68F5406'), texto: 'BE8A68F5406' },
  { nombre: 'EAN-13 (producto)', bits: e.bits, texto: e.texto },
  { nombre: 'ITF numérico', bits: itf('12345678'), texto: '12345678' },
]

const resultados = []
for (const caso of CASOS) {
  // 1) la etiqueta, como JPEG 1280x720: la "cámara"
  const gen = await chromium.launch()
  const g = await gen.newPage({ viewport: { width: 1280, height: 720 } })
  await g.setContent('<body style="margin:0"><canvas id="k" width="1280" height="720"></canvas></body>')
  await g.evaluate(({ bits, texto, nombre }) => {
    const x = document.getElementById('k').getContext('2d')
    x.fillStyle = '#cfc8b4'; x.fillRect(0, 0, 1280, 720)
    x.fillStyle = '#fff'; x.fillRect(280, 210, 720, 320)
    x.fillStyle = '#111'; x.font = 'bold 30px sans-serif'; x.fillText(nombre, 310, 255)
    const mod = 560 / bits.length
    for (let i = 0; i < bits.length; i++) if (bits[i] === '1') x.fillRect(360 + i * mod, 290, Math.ceil(mod), 150)
    x.font = '30px monospace'; x.fillText(texto, 480, 490)
  }, caso)
  const archivo = `${S}/camara_${resultados.length}.mjpeg`
  writeFileSync(archivo, await g.screenshot({ type: 'jpeg', quality: 92 }))
  await gen.close()

  // 2) la app, con esa cámara
  const browser = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${archivo}`],
  })
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['camera'] })
  await ctx.addInitScript(() => {
    localStorage.setItem('united_quien_soy', 'PRUEBA Mecánico')
    localStorage.setItem('united_modo', 'editar')
  })
  await ctx.route('**://*.supabase.co/**', (r) => (['GET', 'HEAD'].includes(r.request().method())
    ? r.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    : r.fulfill({ status: 201, contentType: 'application/json', body: '[]' })))
  const page = await ctx.newPage()
  page.on('pageerror', (er) => console.log('ERROR DE PÁGINA:', er.message))
  await page.goto(process.env.URL_APP ?? 'http://localhost:5173', { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: new RegExp(`Outage Rack ${rack}\\b`) }).first().click()
  await page.getByRole('button', { name: /Carguío de membrana/i }).first().click()
  await page.waitForTimeout(500)
  await page.locator('svg text', { hasText: /^S1$/ }).first().click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /Escanear/ }).click()
  let leido = ''
  const t0 = Date.now()
  while (Date.now() - t0 < 12000 && !leido) {
    await page.waitForTimeout(300)
    leido = await page.locator('.escaner-cartel').innerText().catch(() => '')
  }
  resultados.push(`${caso.nombre} (${caso.texto}): ${leido ? leido.replace(/\s+/g, ' ') + ` · ${((Date.now() - t0) / 1000).toFixed(1)} s` : 'NO LEYÓ en 12 s'}`)
  await browser.close()
}
resultados.forEach((r) => console.log(r))
