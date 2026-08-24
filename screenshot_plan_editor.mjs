// Capturas del Plan maestro EN MODO EDITOR.
//   node screenshot_plan_editor.mjs
//
// Para ver esta mitad hace falta una sesión iniciada y que la base conteste que
// ese correo es editor. En vez de usar una cuenta real contra la base de la
// cuadrilla, acá se monta un doble: NINGUNA petición a supabase.co sale a la
// red — o se contesta con un JSON de mentira, o se corta. La regla del proyecto
// (el local escribe en la base real) se respeta igual: no sale ni un byte.
import { chromium } from 'playwright'

const enBase64Url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const dentroDeUnAno = Math.floor(Date.now() / 1000) + 365 * 24 * 3600
const TOKEN = [
  enBase64Url({ alg: 'HS256', typ: 'JWT' }),
  enBase64Url({ sub: '00000000-0000-0000-0000-000000000001', email: 'brayan.villalobos.c@gmail.com',
    role: 'authenticated', exp: dentroDeUnAno, iat: Math.floor(Date.now() / 1000) }),
  'firma-de-mentira',
].join('.')

const USUARIO = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'brayan.villalobos.c@gmail.com',
  aud: 'authenticated', role: 'authenticated',
  app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
}
const SESION = {
  access_token: TOKEN, token_type: 'bearer', expires_in: 3600,
  expires_at: dentroDeUnAno, refresh_token: 'refresh-de-mentira', user: USUARIO,
}

// El plan de ejemplo, tal como lo devolveria la base (snake_case).
const PLAN_DEMO = (() => {
  const hoy = new Date()
  const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7))
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const semanaISO = (f) => {
    const d = new Date(Date.UTC(f.getFullYear(), f.getMonth(), f.getDate()))
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
    const anio = d.getUTCFullYear()
    return { anio, semana: Math.ceil(((d - new Date(Date.UTC(anio, 0, 1))) / 86400000 + 1) / 7) }
  }
  const NOMBRES = [['Outage Rack 12', 140], ['Apoyo outage', 32], ['Mantenimiento acueducto', 40],
    ['Mejoramiento Patio Energy', 50], ['Retiro de Maxisaco planta RO', 40]]
  const filas = []
  for (let d = 0; d < 7; d++) {
    const f = new Date(lunes.getTime() + d * 86400000)
    const fecha = iso(f); const { anio, semana } = semanaISO(f)
    for (const turno of ['Dia', 'Noche']) {
      for (let k = 0; k < (turno === 'Dia' ? 3 : 2); k++) {
        const [actividad, hh] = NOMBRES[(d + k + (turno === 'Noche' ? 2 : 0)) % NOMBRES.length]
        filas.push({ id: `demo-${fecha}-${turno}-${k}`, fecha, anio, semana, turno, actividad, hh,
          estado: 'planificada', zona: null, ot: null, nota: null,
          orden: (turno === 'Noche' ? 10 : 0) + k, creado_por: 'demo',
          actualizado_por: 'demo', actualizado_en: new Date().toISOString() })
      }
    }
  }
  return filas
})()

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })

const json = (route, cuerpo, status = 200) => route.fulfill({
  status, contentType: 'application/json', body: JSON.stringify(cuerpo),
})

await ctx.route('**://*.supabase.co/**', (route) => {
  const url = route.request().url()
  const metodo = route.request().method()
  if (url.includes('/auth/v1/token')) return json(route, SESION)
  if (url.includes('/auth/v1/user')) return json(route, USUARIO)
  if (url.includes('/rest/v1/rpc/es_editor_plan')) return json(route, true)
  if (url.includes('/rest/v1/plan_actividades')) {
    return metodo === 'GET' ? json(route, PLAN_DEMO) : json(route, [], 201)
  }
  if (url.includes('/rest/v1/plan_')) {
    return metodo === 'GET' ? json(route, []) : json(route, [], 201)
  }
  return route.abort()   // todo lo demás (avisos, tapas, marcas) ni se intenta
})
await ctx.addInitScript(() => {
  localStorage.setItem('united_quien_soy', 'B. Villalobos')
  localStorage.setItem('united_modo', 'editar')
})

const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('ERROR DE PÁGINA:', e.message))
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)

await page.getByText('Plan maestro').first().click()
await page.waitForTimeout(1200)

// entrar con el doble de sesión
await page.getByRole('button', { name: 'Iniciar sesión' }).click()
await page.waitForTimeout(500)
await page.getByLabel('Correo').fill('brayan.villalobos.c@gmail.com')
await page.getByLabel('Clave').fill('clave-de-prueba')
await page.getByRole('button', { name: 'Entrar' }).click()
await page.waitForTimeout(1200)
await page.screenshot({ path: 'ver_plan_sesion.png' })

await page.getByRole('button', { name: 'Volver' }).click()
await page.waitForTimeout(1500)
await page.screenshot({ path: 'ver_plan_editor.png' })

// abrir una línea para editarla
await page.locator('.plan-linea').first().click()
await page.waitForTimeout(800)
await page.screenshot({ path: 'ver_plan_editar_linea.png' })

await browser.close()
console.log('OK — ver_plan_sesion.png, ver_plan_editor.png, ver_plan_editar_linea.png')
