// Leer y escribir la planilla "Planificacion" de SharePoint.
//
// El libro trae VARIAS hojas con plan y no todas tienen la misma forma:
//   · "Planifcacion"  → 3 columnas por día (actividad, HH, OT), semanas 2025.
//   · "OT Estrategia" → 2 columnas por día (Descripcion, Horas), y es la que
//                        está viva: llega hasta noviembre de 2026.
// Por eso el lector no asume columnas fijas: busca la fila de fechas, ve en
// qué columnas caen y de ahí deduce el ancho de cada día.
//
// La forma común es un bloque por semana, uno debajo del otro:
//   fila T   : título del bloque ("Plan 0 gotas Week 46 Turno Q")
//   fila T+1 : las 7 fechas, una por día (de lunes a domingo)
//   fila T+2 : las HH libres del día
//   fila T+3…: las actividades. El turno se marca en una columna de la
//              izquierda ("Dia"/"Noche") o en una fila entera que dice "Noche",
//              y manda hasta el próximo marcador.
//
// Como no hay conexión con SharePoint (haría falta que TI registre la app en
// el tenant), el ida y vuelta es por archivo.
import {
  COL_ACTIVIDAD, COL_HH, COL_OT, DIAS_SEMANA, lunesDe, type LineaPlan, type TurnoPlan,
} from './planSemana'

type Celda = { value: unknown }
type Hoja = {
  name: string
  rowCount: number
  columnCount: number
  getCell: (fila: number, col: number) => Celda
}

/** Una hoja del libro que trae plan, con lo que se leyó de ella. */
export interface HojaPlan {
  nombre: string
  lineas: LineaPlan[]
  desde: string
  hasta: string
  /** true si la hoja cubre el día de hoy: es la que conviene cargar. */
  vigente: boolean
}

const texto = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return ''
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join('')
    const r = o.result
    // una fórmula sin resultado guardado no dice nada: vale como celda vacía
    if (r === null || r === undefined || r instanceof Date || typeof r === 'object') return ''
    return String(r)
  }
  return String(v)
}

/** La fecha de una celda, sea un valor o el resultado de una fórmula. */
function fechaDe(v: unknown): string | null {
  let d: unknown = v
  if (typeof v === 'object' && v !== null && 'result' in (v as object)) {
    d = (v as { result: unknown }).result
  }
  if (!(d instanceof Date) || isNaN(d.getTime())) return null
  // Excel guarda el día a medianoche, pero según de dónde venga el valor llega
  // corrido unas horas por el huso. Se redondea al día más cercano.
  return new Date(d.getTime() + 12 * 3600 * 1000).toISOString().slice(0, 10)
}

const PALABRAS_DIA = /^(d[ií]a|day)\b/i
const PALABRAS_NOCHE = /^(noche|night)\b/i
/** Rótulos de encabezado que no son actividades. */
const NO_ES_ACTIVIDAD = /^(ot|descripcion|descripción|horas|hh|total|observaciones)\b/i
const SOLO_NUMERO = /^-?[\d.,]+$/
/** "lunes 14", "miércoles 16": algunas semanas tienen el día escrito a mano. */
const DIA_A_MANO = /^(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s*(\d{1,2})/i

const sumarDias = (fecha: string, n: number): string => {
  const d = new Date(fecha + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/** El lunes de la semana ISO n de ese año (así numera la planilla). */
function lunesDeSemana(n: number, anio: number): string {
  const cuatro = new Date(Date.UTC(anio, 0, 4))
  const lunesUno = new Date(cuatro)
  lunesUno.setUTCDate(cuatro.getUTCDate() - ((cuatro.getUTCDay() + 6) % 7))
  lunesUno.setUTCDate(lunesUno.getUTCDate() + (n - 1) * 7)
  return lunesUno.toISOString().slice(0, 10)
}

/** Agrupa las celdas de una fila saltándose las combinadas (valor repetido). */
function agrupar<T>(ws: Hoja, f: number, leer: (v: unknown) => T | null): { col: number; valor: T }[] {
  const grupos: { col: number; valor: T }[] = []
  let ultimo: string | null = null
  for (let c = 1; c <= ws.columnCount; c++) {
    const valor = leer(ws.getCell(f, c).value)
    if (valor === null) continue
    const clave = String(valor)
    if (clave === ultimo) continue
    grupos.push({ col: c, valor })
    ultimo = clave
  }
  return grupos
}

interface Bloque { fila: number; titulo: string; inicio: string; col0: number; paso: number }

/** Los bloques de semana de la hoja: dónde empiezan, en qué columnas y qué
    lunes. Hay semanas con la fila de fechas escrita a mano ("lunes 21"); esas
    se deducen del número de Week del título o de la semana anterior. */
function bloquesDe(ws: Hoja): Bloque[] {
  const bloques: Bloque[] = []
  const tituloArriba = (f: number, col: number): string => {
    for (let arriba = 1; arriba <= 3; arriba++) {
      if (f - arriba < 1) return ''
      const t = texto(ws.getCell(f - arriba, col).value).trim()
      if (t) return t
    }
    return ''
  }

  for (let f = 1; f <= ws.rowCount; f++) {
    const fechas = agrupar(ws, f, fechaDe)
    let inicio: string | null = null
    let cols: number[] = []

    if (fechas.length >= 3) {
      inicio = fechas[0].valor
      cols = fechas.map((g) => g.col)
    } else {
      const aMano = agrupar(ws, f, (v) => {
        const m = DIA_A_MANO.exec(texto(v).trim())
        return m ? Number(m[2]) : null
      })
      if (aMano.length < 3) continue
      cols = aMano.map((g) => g.col)
      const anterior = bloques[bloques.length - 1]?.inicio
      const titulo = tituloArriba(f, cols[0])
      const semana = /week\s*(\d+)/i.exec(titulo)
      const candidatos: string[] = []
      if (anterior) candidatos.push(sumarDias(anterior, 7))
      if (semana) {
        const base = Number((anterior ?? new Date().toISOString()).slice(0, 4))
        for (const anio of [base, base + 1, base - 1]) candidatos.push(lunesDeSemana(Number(semana[1]), anio))
      }
      // el bueno es el que cae en el día del mes que dice la planilla
      inicio = candidatos.find((c) => Number(c.slice(8)) === aMano[0].valor) ?? candidatos[0] ?? null
    }

    if (!inicio || cols.length < 3) continue
    const paso = Math.min(...cols.slice(1).map((c, i) => c - cols[i]))
    if (paso < 1) continue
    bloques.push({ fila: f, titulo: tituloArriba(f, cols[0]), inicio, col0: cols[0], paso })
  }
  return bloques
}

/** Saca todas las líneas del plan de una hoja del Excel. */
export function leerHoja(ws: Hoja): LineaPlan[] {
  const bloques = bloquesDe(ws)
  const lineas: LineaPlan[] = []
  const orden = new Map<string, number>()

  bloques.forEach((b, k) => {
    const dias = Array.from({ length: DIAS_SEMANA }, (_, i) => ({
      fecha: sumarDias(b.inicio, i),
      col: b.col0 + i * b.paso,
    }))
    // hasta el título del bloque siguiente, que va justo arriba de sus fechas
    const hasta = k + 1 < bloques.length ? bloques[k + 1].fila - 2 : ws.rowCount
    let turno: TurnoPlan = 'dia'

    for (let f = b.fila + 1; f <= hasta; f++) {
      // el turno puede venir en una columna de la izquierda o en una fila
      // entera que dice "NOCHE"
      let marca = ''
      for (let c = 1; c < b.col0 && !marca; c++) marca = texto(ws.getCell(f, c).value).trim()
      const celdas = dias.map((d) => texto(ws.getCell(f, d.col).value).trim())
      const llenas = celdas.filter((t) => t !== '')
      const todasTurno = llenas.length > 0 && llenas.every((t) => PALABRAS_DIA.test(t) || PALABRAS_NOCHE.test(t))
      if (todasTurno) marca = llenas[0]

      if (PALABRAS_NOCHE.test(marca)) turno = 'noche'
      else if (PALABRAS_DIA.test(marca)) turno = 'dia'
      if (todasTurno) continue

      dias.forEach((d, i) => {
        const act = celdas[i]
        if (!act || SOLO_NUMERO.test(act)) return
        if (NO_ES_ACTIVIDAD.test(act) || DIA_A_MANO.test(act)) return
        if (act === b.titulo || /^(plan 0 gotas|desaladora week)/i.test(act)) return
        const hhBruto = b.paso >= 2 ? ws.getCell(f, d.col + 1).value : null
        const hh = Number(texto(hhBruto).replace(',', '.'))
        const clave = `${d.fecha}-${turno}`
        const n = (orden.get(clave) ?? 0) + 1
        orden.set(clave, n)
        lineas.push({
          id: `${d.fecha}-${turno}-${n}`,
          fecha: d.fecha, turno, orden: n,
          actividad: act,
          hh: Number.isFinite(hh) && texto(hhBruto) !== '' ? hh : null,
          ot: b.paso >= 3 ? texto(ws.getCell(f, d.col + 2).value).trim() : '',
          titulo: b.titulo,
          observaciones: '',
        })
      })
    }
  })
  return lineas
}

/** Lee el libro entero y devuelve las hojas que traen plan, la más al día
    primero. Se devuelven todas porque el archivo de United trae la histórica y
    la viva, y cargar la equivocada deja la semana de hoy en blanco. */
export async function leerLibro(archivo: File): Promise<HojaPlan[]> {
  if (/\.xlsb$/i.test(archivo.name)) {
    throw new Error('El .xlsb no se puede leer en el navegador: abre la planilla y guárdala como .xlsx.')
  }
  const mod = await import('exceljs')
  const ExcelJS = (mod as unknown as { default?: typeof import('exceljs') }).default ?? mod
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await archivo.arrayBuffer())
  const hoy = new Date().toISOString().slice(0, 10)

  const hojas: HojaPlan[] = []
  for (const ws of wb.worksheets) {
    const lineas = leerHoja(ws as unknown as Hoja)
    if (lineas.length === 0) continue
    const fechas = lineas.map((l) => l.fecha).sort()
    const desde = fechas[0]
    const hasta = fechas[fechas.length - 1]
    hojas.push({ nombre: ws.name, lineas, desde, hasta, vigente: desde <= hoy && hoy <= hasta })
  }
  // la que cubre hoy primero; después, la que llega más lejos
  return hojas.sort((a, b) => Number(b.vigente) - Number(a.vigente) || (a.hasta < b.hasta ? 1 : -1))
}

/** Escribe el plan de vuelta, con la misma forma de bloques semanales. */
export async function bajarPlanExcel(lineas: LineaPlan[], hhDia: number): Promise<void> {
  const mod = await import('exceljs')
  const ExcelJS = (mod as unknown as { default?: typeof import('exceljs') }).default ?? mod
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Planificacion')

  ws.getColumn(1).width = 12
  ws.getColumn(2).width = 22
  ws.getColumn(3).width = 8
  for (let d = 0; d < DIAS_SEMANA; d++) {
    ws.getColumn(COL_ACTIVIDAD(d)).width = 30
    ws.getColumn(COL_HH(d)).width = 7
    ws.getColumn(COL_OT(d)).width = 12
  }

  // agrupar por semana de lunes a domingo, como la planilla de United
  const porSemana = new Map<string, LineaPlan[]>()
  for (const l of lineas) {
    const clave = lunesDe(l.fecha)
    porSemana.set(clave, [...(porSemana.get(clave) ?? []), l])
  }

  let f = 2
  for (const [inicio, suyas] of [...porSemana.entries()].sort()) {
    const dias = Array.from({ length: DIAS_SEMANA }, (_, i) => {
      const d = new Date(inicio + 'T12:00:00')
      d.setDate(d.getDate() + i)
      return d.toISOString().slice(0, 10)
    })

    const tit = ws.getCell(f, COL_ACTIVIDAD(0))
    tit.value = suyas[0]?.titulo || `Semana del ${inicio}`
    tit.font = { bold: true, size: 12 }
    f += 1

    dias.forEach((dia, d) => {
      const c = ws.getCell(f, COL_ACTIVIDAD(d))
      c.value = new Date(dia + 'T12:00:00')
      c.numFmt = 'dd-mm-yyyy'
      c.font = { bold: true }
      c.alignment = { horizontal: 'center' }
    })
    f += 1

    dias.forEach((dia, d) => {
      const usadas = suyas.filter((l) => l.fecha === dia).reduce((n, l) => n + (l.hh ?? 0), 0)
      ws.getCell(f, COL_ACTIVIDAD(d)).value = hhDia - usadas
      ws.getCell(f, COL_OT(d)).value = 'OT'
    })
    f += 1

    for (const turno of ['dia', 'noche'] as TurnoPlan[]) {
      const alto = Math.max(
        1,
        ...dias.map((dia) => suyas.filter((l) => l.fecha === dia && l.turno === turno).length),
      )
      ws.getCell(f, 3).value = turno === 'dia' ? 'Dia' : 'Noche'
      ws.getCell(f, 3).font = { bold: true }
      for (let i = 0; i < alto; i++) {
        dias.forEach((dia, d) => {
          const l = suyas
            .filter((x) => x.fecha === dia && x.turno === turno)
            .sort((a, b) => a.orden - b.orden)[i]
          if (!l) return
          ws.getCell(f + i, COL_ACTIVIDAD(d)).value = l.actividad
          if (l.hh !== null) ws.getCell(f + i, COL_HH(d)).value = l.hh
          if (l.ot) ws.getCell(f + i, COL_OT(d)).value = l.ot
        })
      }
      f += alto
    }
    f += 2
  }

  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }))
  const a = document.createElement('a')
  a.href = url
  a.download = `Planificacion_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}
