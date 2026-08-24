// Capturas del Plan maestro, para mirarlo antes de darlo por listo.
//   node screenshot_plan.mjs
//
// Igual que screenshot.mjs, se corta Supabase entero: el local pega contra la
// MISMA base que usa la cuadrilla en planta. Como el plan vive allá y acá no se
// puede leer, se siembran unas líneas de ejemplo directo en el IndexedDB del
// navegador. Son de mentira y mueren con el navegador de prueba: no tocan ni la
// base real ni el celular de nadie.
import { chromium } from 'playwright'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.route('**://*.supabase.co/**', (r) => r.abort())
await ctx.addInitScript(() => {
  localStorage.setItem('united_quien_soy', 'B. Villalobos')
  localStorage.setItem('united_modo', 'ver')
})

const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('ERROR DE PÁGINA:', e.message))
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)

// --- sembrar el plan de ejemplo en el IndexedDB que ya creó la app
const sembradas = await page.evaluate(async () => {
  // lunes de esta semana
  const hoy = new Date()
  const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7))
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const semanaISO = (f) => {
    const d = new Date(Date.UTC(f.getFullYear(), f.getMonth(), f.getDate()))
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
    const anio = d.getUTCFullYear()
    const e1 = new Date(Date.UTC(anio, 0, 1))
    return { anio, semana: Math.ceil(((d - e1) / 86400000 + 1) / 7) }
  }

  const NOMBRES = [
    ['Outage Rack 12', 140], ['Apoyo outage', 32], ['Mantenimiento acueducto', 40],
    ['Mejoramiento Patio Energy', 50], ['Retiro de Maxisaco planta RO', 40],
    ['Inspeccion con dron', 30], ['Curso Lms', 30], ['Cambio filtro CIP 3-4', 60],
  ]
  const filas = []
  for (let sem = 0; sem < 14; sem++) {
    for (let d = 0; d < 7; d++) {
      const f = new Date(lunes.getTime() + (sem * 7 + d) * 86400000)
      const fecha = iso(f)
      const { anio, semana } = semanaISO(f)
      for (const turno of ['Dia', 'Noche']) {
        const cuantas = turno === 'Dia' ? 4 : 3
        for (let k = 0; k < cuantas; k++) {
          const [actividad, hh] = NOMBRES[(sem + d + k + (turno === 'Noche' ? 3 : 0)) % NOMBRES.length]
          filas.push({
            id: `demo-${fecha}-${turno}-${k}`, fecha, anio, semana, turno, actividad, hh,
            estado: k === 0 && d < 2 ? 'hecha' : k === 1 && d === 2 ? 'postergada' : 'planificada',
            zona: '', ot: k === 0 ? '419375139' : '', nota: '', orden: (turno === 'Noche' ? 10 : 0) + k,
            creadoPor: 'demo', actualizadoPor: 'demo', actualizadoEn: Date.now(),
          })
        }
      }
    }
  }
  const sugerencias = [
    { id: 'demo-s1', fecha: iso(lunes), anio: semanaISO(lunes).anio, semana: semanaISO(lunes).semana,
      actividadId: null, tipo: 'cambiar', texto: 'El jueves no alcanzamos con 4 personas en el retiro de maxisaco, faltan 2.',
      autor: 'R. Pérez', estado: 'pendiente', respuesta: '', resueltoPor: '', createdAt: Date.now() - 3600e3 },
    { id: 'demo-s2', fecha: null, anio: null, semana: null, actividadId: null, tipo: 'agregar',
      texto: 'Falta programar la inspección de la bomba sumidero 201 antes de la parada.',
      autor: 'J. Soto', estado: 'aceptada', respuesta: 'Va en la W36.', resueltoPor: 'B. Villalobos',
      createdAt: Date.now() - 86400e3 },
  ]

  const db = await new Promise((ok, mal) => {
    const r = indexedDB.open('united_app')
    r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error)
  })
  const tx = db.transaction(['plan', 'sugerencias'], 'readwrite')
  for (const f of filas) tx.objectStore('plan').put(f)
  for (const s of sugerencias) tx.objectStore('sugerencias').put(s)
  await new Promise((ok, mal) => { tx.oncomplete = ok; tx.onerror = () => mal(tx.error) })
  return filas.length
})
console.log(`sembradas ${sembradas} líneas de ejemplo`)

await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1200)

await page.getByText('Plan maestro').first().click()
await page.waitForTimeout(1500)
await page.screenshot({ path: 'ver_plan_semana.png' })
// OJO: el que scrollea es el BODY, no la ventana. `body` tiene overflow-x
// hidden y height 100%, y con eso el navegador le pone overflow-y auto: queda
// el como contenedor de scroll y window.scrollTo no mueve nada (por eso el
// fullPage de Playwright sale con la mitad en blanco).
await page.evaluate(() => document.body.scrollTo(0, 1500))
await page.waitForTimeout(500)
await page.screenshot({ path: 'ver_plan_semana2.png' })
await page.evaluate(() => document.body.scrollTo(0, document.body.scrollHeight))
await page.waitForTimeout(500)
await page.screenshot({ path: 'ver_plan_semana3.png' })
await page.evaluate(() => document.body.scrollTo(0, 0))

await page.getByRole('button', { name: 'Horizonte' }).click()
await page.waitForTimeout(900)
await page.screenshot({ path: 'ver_plan_horizonte.png', fullPage: true })

await page.getByRole('button', { name: /Sugerencias/ }).click()
await page.waitForTimeout(700)
await page.screenshot({ path: 'ver_plan_sugerencias.png', fullPage: true })

await page.getByRole('button', { name: 'Iniciar sesión' }).click()
await page.waitForTimeout(700)
await page.screenshot({ path: 'ver_plan_cuenta.png' })

await browser.close()
console.log('OK — ver_plan_*.png')
