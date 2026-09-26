// Leer y escribir la planilla "Planificacion" de SharePoint.
//
// El Excel son bloques semanales, uno debajo del otro:
//   fila T   : título del bloque ("Plan 0 gotas Week 15 PA-PB")
//   fila T+1 : las 7 fechas, una cada 3 columnas (D, G, J, M, P, S, V)
//   fila T+2 : las HH libres del día, y el rótulo "OT" de cada día
//   fila T+3…: las actividades. La columna C dice "Dia" o "Noche" en la
//              primera fila de cada turno, y ese turno manda hasta el próximo
//              marcador. La actividad va en D/G/J…, sus HH en la columna
//              siguiente y la OT dos más a la derecha.
//   una fila con "Observaciones: …" cierra el bloque.
//
// Como no hay conexión con SharePoint (haría falta que TI registre la app en
// el tenant), el ida y vuelta es por archivo.
import {
  COL_ACTIVIDAD, COL_HH, COL_OT, DIAS_SEMANA, type LineaPlan, type TurnoPlan,
} from './planSemana'

type Hoja = {
  rowCount: number
  getCell: (fila: number, col: number) => { value: unknown; text?: string }
}

const texto = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object' && v !== null && 'result' in (v as object)) {
    return String((v as { result: unknown }).result ?? '')
  }
  if (typeof v === 'object' && v !== null && 'richText' in (v as object)) {
    return ((v as { richText: { text: string }[] }).richText ?? []).map((t) => t.text).join('')
  }
  return String(v)
}

const esFecha = (v: unknown): v is Date => v instanceof Date && !isNaN(v.getTime())
const aISO = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)

/** Saca todas las líneas del plan de una hoja del Excel. */
export function leerHoja(ws: Hoja): LineaPlan[] {
  const lineas: LineaPlan[] = []
  let fechas: (string | null)[] = []
  let titulo = ''
  let turno: TurnoPlan = 'dia'
  const orden = new Map<string, number>()

  for (let f = 1; f <= ws.rowCount; f++) {
    const primera = ws.getCell(f, COL_ACTIVIDAD(0)).value
    // ¿fila de fechas? entonces empieza un bloque nuevo
    if (esFecha(primera)) {
      fechas = Array.from({ length: DIAS_SEMANA }, (_, d) => {
        const v = ws.getCell(f, COL_ACTIVIDAD(d)).value
        return esFecha(v) ? aISO(v) : null
      })
      titulo = texto(ws.getCell(f - 1, COL_ACTIVIDAD(0)).value).trim()
      turno = 'dia'
      f += 1   // la fila de HH libres no trae actividades
      continue
    }
    if (fechas.length === 0) continue

    const marca = texto(ws.getCell(f, 3).value).trim().toLowerCase()
    if (marca.startsWith('noche')) turno = 'noche'
    else if (marca.startsWith('dia') || marca.startsWith('día')) turno = 'dia'

    for (let d = 0; d < DIAS_SEMANA; d++) {
      const fecha = fechas[d]
      if (!fecha) continue
      const act = texto(ws.getCell(f, COL_ACTIVIDAD(d)).value).trim()
      if (!act || act.toLowerCase().startsWith('observaciones')) continue
      if (act.toLowerCase().startsWith('plan 0 gotas')) continue   // título de otro bloque
      const hhBruto = ws.getCell(f, COL_HH(d)).value
      const hh = Number(texto(hhBruto).replace(',', '.'))
      const clave = `${fecha}-${turno}`
      const n = (orden.get(clave) ?? 0) + 1
      orden.set(clave, n)
      lineas.push({
        id: `${fecha}-${turno}-${n}`,
        fecha, turno, orden: n,
        actividad: act,
        hh: Number.isFinite(hh) && texto(hhBruto) !== '' ? hh : null,
        ot: texto(ws.getCell(f, COL_OT(d)).value).trim(),
        titulo,
        observaciones: '',
      })
    }
  }
  return lineas
}

/** Carga el archivo que eligió el planificador. */
export async function leerPlanDesdeArchivo(archivo: File): Promise<LineaPlan[]> {
  const mod = await import('exceljs')
  const ExcelJS = (mod as unknown as { default?: typeof import('exceljs') }).default ?? mod
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await archivo.arrayBuffer())
  // la hoja del plan es la que trae fechas en la columna D; si hay varias, la primera
  for (const ws of wb.worksheets) {
    const lineas = leerHoja(ws as unknown as Hoja)
    if (lineas.length > 0) return lineas
  }
  return []
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

  // agrupar por semana de martes a lunes
  const porSemana = new Map<string, LineaPlan[]>()
  for (const l of lineas) {
    const d = new Date(l.fecha + 'T12:00:00')
    d.setDate(d.getDate() - ((d.getDay() + 5) % 7))
    const clave = d.toISOString().slice(0, 10)
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
