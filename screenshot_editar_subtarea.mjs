// Prueba de «corregir el texto de una subtarea» con Supabase SIMULADO: nada
// llega a la base real. Minuta (ficha de la tarea) y Proyectos MIP.
//   node screenshot_editar_subtarea.mjs
import { chromium } from 'playwright'
import { createServer } from 'vite'

const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' })
await server.listen()
const escrituras = []
const ahora = Math.floor(Date.now() / 1000)
const usuario = { id: 'u-prueba', email: 'prueba@unitedpipeline-sa.com', aud: 'authenticated', role: 'authenticated' }
const secciones = [
  { id: 'minuta', nombre: 'Minuta de la semana', tipo: 'fija', bajada: 'Lo pendiente', icono: '🗓️', orden: 1 },
  { id: 'proyectos', nombre: 'Proyectos MIP', tipo: 'fija', bajada: 'Actividades y subtareas', icono: '🧱', orden: 3 },
]
let minuta = [
  { id: 'm1', inicio: '2026-11-24', titulo: 'Cambio de puertas sala eléctrica', estado: 'pendiente', orden: 1, padre_id: null, tipo: 'tarea' },
  { id: 'm2', inicio: '2026-11-24', titulo: 'Confirmacion cantidad de materiales en instalacion (Manilla, vastago y barra antipanico)', estado: 'pendiente', orden: 1, padre_id: 'm1', tipo: 'tarea' },
]
let tareas = [
  { id: 't1', proyecto_id: 'p1', titulo: 'Montaje manifold', estado: 'pendiente', orden: 1, padre_id: null },
  { id: 't2', proyecto_id: 'p1', titulo: 'Pedir pernos', estado: 'pendiente', orden: 1, padre_id: 't1' },
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
  if (m === 'GET' && url.includes('/proyectos')) return json([{ id: 'p1', nombre: 'Manifold Blanco planta 0', orden: 1, activo: true }])
  if (m === 'GET' && url.includes('/minuta_tareas')) return json(url.includes('select=inicio') ? [{ inicio: '2026-11-24' }] : minuta)
  if (m === 'GET' && url.includes('/plan_tareas')) return json(tareas)
  if (m === 'GET' || m === 'HEAD') return json([])
  const body = req.postData() ?? ''
  escrituras.push(`${m} ${url.split('/rest/v1/')[1]?.split('?')[0]} ${body}`)
  if (url.includes('/minuta_tareas') && m === 'PATCH') {
    const id = decodeURIComponent(url).match(/id=eq\.([^&]+)/)?.[1]; const f = JSON.parse(body)
    minuta = minuta.map((x) => (x.id === id ? { ...x, ...f } : x))
  }
  if (url.includes('/plan_tareas') && m === 'POST') {
    const p = JSON.parse(body); const f = Array.isArray(p) ? p[0] : p
    tareas = tareas.map((x) => (x.id === f.id ? { ...x, ...f } : x))
  }
  return json([], 201)
})
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('ERROR DE PÁGINA:', e.message))

await page.goto('http://localhost:5199/', { waitUntil: 'load' })
await page.waitForTimeout(1200)
await page.getByRole('button', { name: /Planificación/ }).first().click()
await page.waitForTimeout(500)
await page.locator('input[type=email], input').first().fill('prueba@unitedpipeline-sa.com')
await page.locator('input[type=password]').fill('clave-prueba')
await page.getByRole('button', { name: /Entrar|Ingresar/ }).click()
await page.waitForTimeout(1200)

// --- Minuta: abrir la tarea y corregir la subtarea
await page.locator('.menu-card', { hasText: 'Minuta' }).click()
await page.waitForTimeout(900)
await page.locator('.plan-cuerpo', { hasText: 'Cambio de puertas' }).click()
await page.waitForTimeout(600)
await page.locator('.modal .texto-lapiz').first().click()
await page.screenshot({ path: 'shot_subtarea_editando.png' })
await page.locator('.modal .texto-editando textarea').fill('Confirmar cantidad de materiales instalados (manilla, vástago y barra antipánico)')
await page.getByRole('button', { name: 'Guardar' }).click()
await page.waitForTimeout(900)
console.log('Minuta, subtarea ahora:', await page.locator('.modal .texto-editable b').first().innerText())
await page.locator('.modal').scrollIntoViewIfNeeded()
await page.locator('.modal h3', { hasText: 'Subtareas' }).scrollIntoViewIfNeeded()
await page.screenshot({ path: 'shot_subtarea_guardada.png' })
await page.locator('.modal-x').click()

// --- Proyectos MIP: abrir la subtarea y corregirla
await page.waitForTimeout(400)
await page.locator('button.btn.sm.ghost').first().click()
await page.waitForTimeout(600)
await page.locator('.menu-card', { hasText: 'Proyectos MIP' }).click()
await page.waitForTimeout(900)
await page.locator('.plan-cuerpo', { hasText: 'Pedir pernos' }).click()
await page.waitForTimeout(400)
await page.locator('.plan-detalle .texto-lapiz').click()
await page.locator('.plan-detalle textarea').fill('Pedir pernos M16 inoxidables')
await page.locator('.plan-detalle').getByRole('button', { name: 'Guardar' }).click()
await page.waitForTimeout(900)
console.log('Proyectos, subtarea ahora:', (await page.locator('.plan-tarea.sub b').allInnerTexts()).join(' · '))
console.log('Escrituras:', escrituras)
await browser.close(); await server.close()
