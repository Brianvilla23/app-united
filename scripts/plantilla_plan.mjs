// Saca la PLANTILLA EN BLANCO del plan maestro a partir del archivo real de
// SharePoint: deja la hoja "OT Estrategia" tal cual —títulos, fechas, fórmulas
// de HH libres, marcas Dia/Noche, formato— pero sin ninguna actividad.
//
// Así el Excel que baja la app es el mismo formato que ellos suben, que es el
// que tiene validado control de calidad.
//
//   node scripts/plantilla_plan.mjs "C:/ruta/Planificacion (version 1).xlsx"
//
// Escribe public/plantillas/plan_maestro.xlsx.
import ExcelJS from 'exceljs'
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const ORIGEN = process.argv[2] ?? 'C:/Users/braya/Downloads/Planificacion (version 1) (1).xlsx'
const HOJA = 'OT Estrategia'
const DESTINO = 'public/plantillas/plan_maestro.xlsx'

// el detector de bloques es el mismo que usa la app: se transpila al vuelo
const ts = (await import('typescript')).default
const src = readFileSync('src/planExcel.ts', 'utf8')
const js = ts.transpileModule(src, { compilerOptions: { target: 'es2022', module: 'esnext' } }).outputText
writeFileSync('scripts/.planExcel.tmp.mjs', js.replace(/from '\.\/planSemana'/g, "from './.planSemana.tmp.mjs'"))
const js2 = ts.transpileModule(readFileSync('src/planSemana.ts', 'utf8'), { compilerOptions: { target: 'es2022', module: 'esnext' } }).outputText
writeFileSync('scripts/.planSemana.tmp.mjs', js2.replace(/from '\.\/supabase'/g, "from './.supabase.tmp.mjs'"))
writeFileSync('scripts/.supabase.tmp.mjs', 'export const supabase = {}\n')
const { bloquesDe } = await import('./.planExcel.tmp.mjs')

const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(ORIGEN)

// 1. dejar solo la hoja del plan vivo
for (const ws of [...wb.worksheets]) if (ws.name !== HOJA) wb.removeWorksheet(ws.id)
const ws = wb.getWorksheet(HOJA)

// 2. borrar las actividades de cada bloque, dejando todo lo demás
const bloques = bloquesDe(ws)
let borradas = 0
bloques.forEach((b, k) => {
  const hasta = k + 1 < bloques.length ? bloques[k + 1].fila - 2 : ws.rowCount
  for (let f = b.fila + 2; f <= hasta; f++) {     // +2 salta la fila de HH libres
    for (let i = 0; i < 7; i++) {
      for (const c of [b.col0 + i * b.paso, b.col0 + i * b.paso + 1]) {
        const celda = ws.getCell(f, c)
        const v = celda.value
        if (v === null || v === undefined) continue
        // las fórmulas (HH libres) y los encabezados se quedan
        if (typeof v === 'object' && !Array.isArray(v.richText)) continue
        const t = String(Array.isArray(v.richText) ? v.richText.map((x) => x.text).join('') : v).trim()
        if (/^(descripcion|descripción|horas|ot|dia|día|noche)$/i.test(t)) continue
        celda.value = null
        borradas++
      }
    }
  }
})

await wb.xlsx.writeFile(DESTINO)
const kb = Math.round(execSync(`stat -c %s "${DESTINO}"`).toString().trim() / 1024)
console.log(`${bloques.length} bloques · ${borradas} celdas vaciadas · ${DESTINO} (${kb} KB)`)
