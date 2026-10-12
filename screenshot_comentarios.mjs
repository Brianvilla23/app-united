// Prueba de los comentarios en Proyectos, con Supabase SIMULADO: ninguna
// petición sale a la base real. La sesión es falsa y las tablas responden
// desde memoria.
//   node screenshot_comentarios.mjs
import { chromium } from 'playwright'

const ahora = Math.floor(Date.now() / 1000)
const sesion = {
  access_token: 'falso', token_type: 'bearer', expires_in: 360000, expires_at: ahora + 360000,
  refresh_token: 'falso',
  user: { id: '00000000-0000-0000-0000-000000000001', email: 'PRUEBA@unitedpipeline-sa.com', aud: 'authenticated', role: 'authenticated' },
}
const proyectos = [{ id: 'p1', nombre: 'Manifold desarmable', orden: 1, activo: true }]
const tareas = [
  { id: 't1', proyecto_id: 'p1', padre_id: null, titulo: 'Determinar si se usará un código nuevo o el mismo de los manifold antiguos', estado: 'completada', desde: null, hasta: null, seguimiento: null, orden: 1 },
  { id: 't2', proyecto_id: 'p1', padre_id: null, titulo: 'Cotizar brazos de repuesto', estado: 'pendiente', desde: null, hasta: null, seguimiento: null, orden: 2 },
]
const comentarios = []
let peticionesReales = 0

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.addInitScript((s) => {
  localStorage.setItem('united_quien_soy', 'B. Villalobos')
  localStorage.setItem('sb-egxgxejgcohzwuoqhald-auth-token', JSON.stringify(s))
}, sesion)
await ctx.route('**://*.supabase.co/**', async (r) => {
  const req = r.request()
  const u = new URL(req.url())
  const json = (b, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) })
  if (u.pathname.startsWith('/auth/v1/user')) return json(sesion.user)
  if (u.pathname.endsWith('/rpc/es_editor_plan')) return json(true)
  if (u.pathname.endsWith('/proyectos')) return json(proyectos)
  if (u.pathname.endsWith('/plan_tareas')) return json(tareas)
  if (u.pathname.endsWith('/comentarios')) {
    if (req.method() === 'POST') {
      const fila = JSON.parse(req.postData())
      const filas = Array.isArray(fila) ? fila : [fila]
      for (const f of filas) comentarios.push({ ...f, creado_en: new Date().toISOString() })
      return r.fulfill({ status: 201, body: '' })
    }
    if (req.method() === 'DELETE') {
      const id = u.searchParams.get('id')?.replace('eq.', '')
      const i = comentarios.findIndex((c) => c.id === id)
      if (i >= 0) comentarios.splice(i, 1)
      return r.fulfill({ status: 204, body: '' })
    }
    return json(comentarios)
  }
  if (u.pathname.endsWith('/adjuntos')) return json([])
  peticionesReales++
  return r.abort()
})

const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('ERROR DE PÁGINA:', e.message))
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await page.getByText('Planificación', { exact: true }).click()
await page.waitForTimeout(900)
await page.getByText('Proyectos', { exact: false }).first().click()
await page.waitForTimeout(900)

// abrir la tarea completada y comentar dos veces
await page.getByText(/Determinar si se usará/).click()
await page.waitForTimeout(400)
const caja = page.getByPlaceholder(/Escribe un comentario/)
await caja.fill('Entregué la información a Rodrigo')
await page.getByRole('button', { name: 'Comentar' }).click()
await page.waitForTimeout(600)
await caja.fill('Rodrigo confirma: se mantiene el código antiguo')
await caja.press('Enter')
await page.waitForTimeout(600)
await page.screenshot({ path: 'ver_comentarios_abierta.png', fullPage: true })

const n = await page.locator('.comentarios li').count()
const caja2 = await caja.inputValue()
// cerrar: la fila debe mostrar el último comentario
await page.getByText(/Determinar si se usará/).click()
await page.waitForTimeout(400)
const resumen = await page.locator('.coment-ultimo').first().innerText()
await page.screenshot({ path: 'ver_comentarios_lista.png', fullPage: true })

// borrar uno
await page.getByText(/Determinar si se usará/).click()
await page.waitForTimeout(300)
await page.locator('.comentarios .memb-x').first().click()
await page.waitForTimeout(500)
const n2 = await page.locator('.comentarios li').count()

console.log(JSON.stringify({ comentariosVisibles: n, cajaQuedaVacia: caja2 === '', resumen, trasBorrar: n2, enMemoria: comentarios.length, peticionesNoSimuladas: peticionesReales }))
await browser.close()
