// Prueba de «borrar secciones» en Planificación con Supabase SIMULADO: nada
// llega a la base real. Entra con una sesión de mentira, borra una sección del
// home (con su confirmación) y una pestaña de Proyectos MIP.
//   node screenshot_borrar_secciones.mjs
import { chromium } from 'playwright'
import { createServer } from 'vite'

const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' })
await server.listen()
const escrituras = []
const ahora = Math.floor(Date.now() / 1000)
const usuario = { id: 'u-prueba', email: 'prueba@unitedpipeline-sa.com', aud: 'authenticated', role: 'authenticated' }
let secciones = [
  { id: 'minuta', nombre: 'Minuta de la semana', tipo: 'fija', bajada: 'Lo pendiente', icono: '🗓️', orden: 1 },
  { id: 'proyectos', nombre: 'Proyectos MIP', tipo: 'fija', bajada: 'Actividades y subtareas', icono: '🧱', orden: 3 },
  { id: 's-outage', nombre: 'Outage', tipo: 'lista', bajada: 'Cosas por hacer, se van marcando', icono: '📋', orden: 60 },
  { id: 's-rack4', nombre: 'Rack 4 planta 0', tipo: 'tabla', bajada: '5 columnas', icono: '📋', orden: 70 },
]
let proyectos = [
  { id: 'p1', nombre: 'Manifold Blanco de planta 0', orden: 1, activo: true },
  { id: 'p2', nombre: 'Manifold Blanco planta 0', orden: 2, activo: true },
]
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.addInitScript(() => {
  localStorage.setItem('united_quien_soy', 'PRUEBA Planificación')
  localStorage.setItem('united_modo', 'editar')
})
await ctx.route('**://*.supabase.co/**', async (r) => {
  const req = r.request(), url = req.url(), m = req.method()
  const json = (b, s = 200) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) })
  if (url.includes('/auth/v1/token')) return json({ access_token: 'falso', token_type: 'bearer', expires_in: 3600, expires_at: ahora + 3600, refresh_token: 'r', user: usuario })
  if (url.includes('/auth/v1/user')) return json(usuario)
  if (url.includes('/rpc/es_editor_plan')) return json(true)
  if (url.includes('/rpc/')) return json(false)
  if (m === 'GET' && url.includes('/plan_secciones')) return json(secciones)
  if (m === 'GET' && url.includes('/proyectos')) return json(proyectos)
  if (m === 'GET' || m === 'HEAD') return json([])
  escrituras.push(`${m} ${url.split('/rest/v1/')[1]?.split('?')[0]} ${req.postData() ?? ''}`)
  if (m === 'DELETE' && url.includes('/plan_secciones')) secciones = secciones.filter((s) => !url.includes(s.id))
  if (url.includes('/proyectos') && req.postData()) {
    const p = JSON.parse(req.postData()); const fila = Array.isArray(p) ? p[0] : p
    proyectos = proyectos.map((x) => (x.id === fila.id ? { ...x, ...fila } : x))
  }
  return json([], 201)
})
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('ERROR DE PÁGINA:', e.message))
const texto = async (sel) => { await page.waitForTimeout(400); return (await page.locator(sel).first().innerText()).replace(/\s+/g, ' ') }

await page.goto('http://localhost:5199/', { waitUntil: 'load' })
await page.waitForTimeout(1200)
await page.getByRole('button', { name: /Planificación/ }).first().click()
await page.waitForTimeout(500)
await page.locator('input[type=email], input').first().fill('prueba@unitedpipeline-sa.com')
await page.locator('input[type=password]').fill('clave-prueba')
await page.getByRole('button', { name: /Entrar|Ingresar/ }).click()
await page.waitForTimeout(1200)

await page.getByRole('button', { name: /Editar o borrar secciones/ }).click()
console.log('Minuta (fija):', await texto('.menu-card-caja:has-text("Minuta") .row'))
await page.locator('.menu-card-caja:has-text("Outage") button', { hasText: 'Borrar' }).click()
console.log('Confirmación:', await texto('.borrar-confirma'))
await page.screenshot({ path: 'shot_borrar_confirma.png' })
await page.getByRole('button', { name: 'Sí, borrar' }).click()
await page.waitForTimeout(600)
console.log('Secciones que quedan:', (await page.locator('.menu-card b').allInnerTexts()).join(' · '))

// Proyectos MIP: borrar la pestaña repetida
await page.getByRole('button', { name: '✓ Listo' }).click()
await page.locator('.menu-card', { hasText: 'Proyectos MIP' }).click()
await page.waitForTimeout(800)
console.log('Pestañas antes:', (await page.locator('.rack-tab').allInnerTexts()).join(' · '))
await page.getByRole('button', { name: /Borrar sección/ }).click()
console.log('Confirmación:', await texto('.borrar-confirma'))
await page.screenshot({ path: 'shot_borrar_proyecto.png' })
await page.getByRole('button', { name: 'Sí, borrar' }).click()
await page.waitForTimeout(800)
console.log('Pestañas después:', (await page.locator('.rack-tab').allInnerTexts()).join(' · '))
console.log('Escrituras:', escrituras)
await browser.close(); await server.close()
