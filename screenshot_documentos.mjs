// Prueba de "Check list y documentos" con Supabase SIMULADO: ninguna petición
// llega a la base real. Recorre: entrar a Supervisores con sesión de
// supervisor → catálogo → buscar → abrir (todas las páginas) → queda guardado
// en el celular → imprimir arma una hoja por página → sin señal se sigue viendo.
//   node screenshot_documentos.mjs <carpeta con PDFs de prueba>
// (con `npm run dev` corriendo en :5173)
import { chromium } from 'playwright'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const carpeta = process.argv[2]
const pdfs = readdirSync(carpeta).filter((f) => f.endsWith('.pdf')).slice(0, 4)
const filas = pdfs.map((f, i) => ({
  id: `prueba-${i}`, categoria: i < 2 ? 'checklist' : 'protocolo', categoria_nombre: i < 2 ? 'Check List' : 'Protocolos',
  categoria_orden: i < 2 ? 0 : 1, codigo: `PRUEBA-${i}`, nombre: f.replace(/\.pdf$/, ''), ruta: `documentos/prueba-${i}.pdf`,
  kb: Math.round(readFileSync(join(carpeta, f)).length / 1024), version: 'v1', actualizado: new Date().toISOString(),
}))
const bytes = new Map(filas.map((d, i) => [d.ruta, readFileSync(join(carpeta, pdfs[i]))]))
let sinSenal = false

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const ahora = Math.floor(Date.now() / 1000)
await ctx.addInitScript((s) => {
  localStorage.setItem('united_quien_soy', 'PRUEBA Supervisor')
  if (!localStorage.getItem('sb-egxgxejgcohzwuoqhald-auth-token')) localStorage.setItem('sb-egxgxejgcohzwuoqhald-auth-token', JSON.stringify(s))
  window.__impresiones = 0
  window.print = () => { window.__impresiones++; window.__hojas = document.querySelectorAll('#area-impresion-doc .hoja-impresion').length }
}, { access_token: 'f', token_type: 'bearer', expires_in: 3600, expires_at: ahora + 3600, refresh_token: 'f',
  user: { id: '00000000-0000-0000-0000-000000000009', email: 'prueba.sup@unitedpipeline-sa.com', aud: 'authenticated', role: 'authenticated' } })
await ctx.route('**://*.supabase.co/**', async (r) => {
  if (sinSenal) return r.abort()
  const req = r.request(); const p = decodeURIComponent(new URL(req.url()).pathname)
  const json = (b) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) })
  if (p.endsWith('/rpc/es_supervisor')) return json(true)
  if (p.endsWith('/rpc/es_editor_plan')) return json(false)
  if (p.endsWith('/rest/v1/supervisores')) return json({ nombre: 'PRUEBA Supervisor' })
  if (p.endsWith('/rest/v1/documentos')) return json(filas)
  if (p.startsWith('/storage/v1/object/sign/')) {
    const ruta = p.replace('/storage/v1/object/sign/adjuntos/', '')
    if (req.method() === 'POST') return json({ signedURL: `/object/sign/adjuntos/${ruta}?token=x` })
    return r.fulfill({ status: 200, contentType: 'application/pdf', body: bytes.get(ruta) ?? Buffer.alloc(0) })
  }
  if (req.method() === 'GET') return json([])
  return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
})

const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('ERROR DE PÁGINA:', e.message))
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.getByText('Supervisores', { exact: true }).click(); await page.waitForTimeout(500)
await page.getByText('Check list y documentos', { exact: true }).click()
await page.waitForTimeout(800)
await page.screenshot({ path: 'shot_documentos_lista.png' })
console.log('Lista:', await page.locator('.doc-item').count(), 'documentos ·', (await page.locator('.doc-estado').innerText()).replace(/\s+/g, ' '))

await page.locator('.doc-chips button', { hasText: 'Protocolos' }).click()
console.log('Pestaña Protocolos:', await page.locator('.doc-item').count())
await page.locator('.doc-chips button', { hasText: 'Todos' }).click()
const palabra = filas[1].nombre.split(/\s+/).find((w) => w.length > 5) ?? filas[1].nombre
await page.locator('.doc-buscar').fill(palabra.toUpperCase())
console.log(`Buscar "${palabra.toUpperCase()}":`, await page.locator('.doc-item').count())
await page.locator('.doc-buscar').fill('')

await page.locator('.doc-item').first().click()
await page.waitForFunction(() => document.querySelectorAll('.doc-visor-hojas canvas').length > 0, null, { timeout: 30000 })
await page.waitForTimeout(1500)
const paginas = await page.locator('.doc-visor-tit small').last().innerText()
console.log('Visor:', paginas, '· dibujadas:', await page.locator('.doc-visor-hojas canvas').count())
await page.screenshot({ path: 'shot_documentos_visor.png' })

await page.getByRole('button', { name: 'Imprimir' }).click()
await page.waitForFunction(() => window.__impresiones > 0, null, { timeout: 60000 })
console.log('Imprimir · hojas armadas:', await page.evaluate(() => window.__hojas))

await page.goBack()   // el botón atrás del teléfono cierra el visor, no la pantalla
await page.waitForTimeout(500)
console.log('Atrás cierra el visor y queda en la lista:', await page.locator('.doc-visor').count() === 0 && await page.locator('.doc-item').count() > 0)
console.log('Estado:', (await page.locator('.doc-estado').innerText()).replace(/\s+/g, ' '))

// sin señal: la lista sale de lo guardado y el documento abierto sigue abriendo
sinSenal = true
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
const enCarpeta = await page.locator('.doc-item').count()
if (!enCarpeta) {
  await page.getByText('Supervisores', { exact: true }).click().catch(() => {})
  await page.waitForTimeout(500)
  await page.getByText('Check list y documentos', { exact: true }).click().catch(() => {})
  await page.waitForTimeout(9000)   // el catálogo espera hasta 8 s antes de darse por sin señal
}
await page.screenshot({ path: 'shot_documentos_sinsenal.png' })
console.log('Sin señal · lista:', await page.locator('.doc-item').count(), '·', (await page.locator('.doc-estado').innerText().catch(() => '')).replace(/\s+/g, ' '))
await page.locator('.doc-item').first().click()
await page.waitForFunction(() => document.querySelectorAll('.doc-visor-hojas canvas').length > 0, null, { timeout: 20000 }).catch(() => {})
console.log('Sin señal · el guardado abre:', await page.locator('.doc-visor-hojas canvas').count() > 0)
await page.goBack(); await page.waitForTimeout(300)
await page.locator('.doc-item').nth(2).click()
await page.waitForTimeout(2500)
console.log('Sin señal · uno NO guardado avisa:', (await page.locator('.doc-msg').innerText().catch(() => '')).slice(0, 80))
await browser.close()
