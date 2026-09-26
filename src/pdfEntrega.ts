// La entrega de turno en PDF: es el MISMO documento que el Excel oficial
// (PYC-EG-MEL-6001-01), con sus mismas secciones, en el mismo orden, con los
// mismos títulos y los mismos colores de la planilla. El Excel es el que se
// manda; el PDF es para leerlo en el teléfono o pegarlo en un correo.
//
// Los colores salen de la planilla: bandas de sección en rojo C00000,
// subsecciones en gris 696A6D y encabezados de tabla en gris 8D8F91.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { EQUIPOS } from './equiposFormato'
import { nombreTurno, type Entrega } from './planDatos'
import { tituloFormato } from './entregaFormato'

const ROJO: [number, number, number] = [192, 0, 0]
const GRIS_SEC: [number, number, number] = [105, 106, 109]
const GRIS_CAB: [number, number, number] = [141, 143, 145]
const M = 12

/** Datos fijos del contrato, los mismos que trae impresos la planilla. */
const CONTRATO = {
  nombre: 'INTEGRAL MEL/COLOSO',
  numero: '9100002468',
  centroCosto: '6001',
  faena: 'COLOSO',
  codigo: 'PYC-EG-MEL-6001-01',
  revision: '00',
  fechaFormato: '22-07-2026',
}

function nombreBase(e: Entrega): string {
  const quien = (e.entrega.nombre || 'supervisor').split(/\s+/)[0]
  return `PYC-EG-MEL-6001-01 Entrega de Turno ${e.semana || e.fecha} ${quien}`
}

/** El logo de United, el mismo de la planilla. Si no está, el PDF sale igual. */
async function traerLogo(): Promise<string | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}united.png`)
    if (!r.ok) return null
    const blob = await r.blob()
    return await new Promise((listo) => {
      const fr = new FileReader()
      fr.onloadend = () => listo(typeof fr.result === 'string' ? fr.result : null)
      fr.onerror = () => listo(null)
      fr.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function generarPDFEntrega(e: Entrega): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const ancho = W - M * 2
  const logo = await traerLogo()

  const finY = (): number => {
    const d = doc as unknown as { lastAutoTable?: { finalY: number } }
    return d.lastAutoTable?.finalY ?? M
  }

  // ---------- encabezado: logo · título · código, como el de la planilla
  autoTable(doc, {
    startY: M,
    body: [['', tituloFormato(e.area), `Código: ${CONTRATO.codigo}\nRev. N°.: ${CONTRATO.revision}\nFecha: ${CONTRATO.fechaFormato}`]],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, valign: 'middle', lineColor: [120, 120, 120], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 42, minCellHeight: 16 },
      1: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 16 },
      2: { cellWidth: 46, fontSize: 7.5 },
    },
    margin: { left: M, right: M },
    didDrawCell: (d) => {
      if (d.section === 'body' && d.column.index === 0 && logo) {
        const alto = 7
        const anchoLogo = 26
        doc.addImage(logo, 'PNG', d.cell.x + 8, d.cell.y + (d.cell.height - alto) / 2, anchoLogo, alto)
      }
    },
  })

  /** Banda de sección: rojo para las numeradas, gris para las subsecciones. */
  const banda = (texto: string, color: [number, number, number], separacion = 3) => {
    autoTable(doc, {
      startY: finY() + separacion,
      body: [[texto]],
      theme: 'grid',
      styles: {
        fontSize: 9.5, fontStyle: 'bold', halign: 'center', textColor: 255,
        fillColor: color, cellPadding: 1.8, lineColor: [120, 120, 120], lineWidth: 0.2,
      },
      margin: { left: M, right: M },
    })
  }

  const tabla = (
    head: string[][],
    body: (string | number)[][],
    columnas: Record<number, { cellWidth: number; halign?: 'left' | 'center' }>,
  ) => {
    autoTable(doc, {
      startY: finY(),
      head, body,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.6, valign: 'top', lineColor: [120, 120, 120], lineWidth: 0.2 },
      headStyles: { fillColor: GRIS_CAB, textColor: 20, fontStyle: 'bold', fontSize: 8, halign: 'center' },
      columnStyles: columnas,
      margin: { left: M, right: M },
    })
  }

  /** Cuadro de datos: etiqueta con fondo gris y valor en blanco, como el Excel. */
  const datos = (filas: [string, string, string, string][]) => {
    autoTable(doc, {
      startY: finY(),
      body: filas,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.6, lineColor: [120, 120, 120], lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: 58, fontStyle: 'bold', fillColor: [232, 232, 233] },
        1: { cellWidth: 47 },
        2: { cellWidth: 51, fontStyle: 'bold', fillColor: [232, 232, 233] },
        3: { cellWidth: ancho - 58 - 47 - 51 },
      },
      margin: { left: M, right: M },
    })
  }

  // ---------- 1. Antecedentes del contrato
  banda('1. Antecedentes del contrato', ROJO)
  datos([
    ['Nombre de contrato:', CONTRATO.nombre, 'Nº Centro de Costo:', CONTRATO.centroCosto],
    ['Nº de contrato:', CONTRATO.numero, 'Centro de Trabajo / Faena:', CONTRATO.faena],
  ])

  // ---------- 2. Antecedentes de la entrega de turno
  banda('2. Antecedentes de la entrega de turno', ROJO)
  datos([
    ['Fecha de entrega de turno:', e.fecha, 'Semana:', e.semana || ''],
    ['Nombre y apellidos de quien entrega turno:', e.entrega.nombre, 'Cargo de quien entrega turno:', e.entrega.cargo || ''],
    ['Nombre y apellidos de quien recibe turno:', e.recibe.nombre || '', 'Cargo de quien recibe turno:', e.recibe.cargo || ''],
  ])

  // ---------- 3. Información entregada durante el cambio de turno
  banda('3. Información entregada durante el cambio de turno', ROJO)

  banda('3.1. Orden de Trabajo ejecutada (compromisos semanales)', GRIS_SEC, 0)
  tabla(
    [['Nº', 'Orden de Trabajo (OT)', 'Observaciones', 'Estado']],
    e.ots.length > 0
      ? e.ots.map((o, i) => [i + 1, o.ot, o.observaciones, o.estado])
      : [['', '', '', '']],
    { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 30 }, 3: { cellWidth: 28, halign: 'center' } },
  )

  banda('3.2 Actividades adicionales realizadas / OT Subsecuentes', GRIS_SEC)
  tabla(
    [['Nº', 'Descripción de actividad', 'Estado']],
    e.adicionales.length > 0
      ? e.adicionales.map((a, i) => [i + 1, a.descripcion, a.estado])
      : [['', '', '']],
    { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 28, halign: 'center' } },
  )

  banda('3.3 Amenazas', GRIS_SEC)
  tabla(
    [['Nº', 'Descripción de amenazas']],
    e.amenazas.length > 0 ? e.amenazas.map((a, i) => [i + 1, a.descripcion]) : [['', '']],
    { 0: { cellWidth: 10, halign: 'center' } },
  )
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(60)
  doc.text('Nota: Agregar filas según se requiera.', M, finY() + 4)

  // ---------- 3.4 Equipos: los 23 del formato, como vienen impresos
  banda('3.4 Equipos', GRIS_SEC, 6)
  const porInterno = new Map(e.equipos.map((l) => [l.interno, l]))
  tabla(
    [['Nº', 'Nombre de equipo', 'Detalle', 'Nº Interno', 'Ubicación', 'Estado', 'Observaciones', 'Último horómetro']],
    EQUIPOS.map((eq, i) => {
      const l = porInterno.get(eq.interno)
      return [
        i + 1, eq.nombre, eq.detalle, eq.interno, eq.ubicacion,
        l?.estado ?? '', l?.observaciones ?? '', l?.horometro ?? '',
      ]
    }),
    {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 32 },
      2: { cellWidth: 32 },
      3: { cellWidth: 19, halign: 'center' },
      4: { cellWidth: 27 },
      5: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 19, halign: 'center' },
    },
  )

  // ---------- firmas
  autoTable(doc, {
    startY: finY() + 6,
    head: [['Responsable de entregar el turno', 'Responsable de recibir el turno']],
    body: [
      [`Nombre completo:  ${e.entrega.nombre}`, `Nombre completo:  ${e.recibe.nombre || ''}`],
      [`Cargo:  ${e.entrega.cargo || ''}`, `Cargo:  ${e.recibe.cargo || ''}`],
      [`RUN:  ${e.entrega.run || ''}`, `RUN:  ${e.recibe.run || ''}`],
      ['Firma:', 'Firma:'],
    ],
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.4, minCellHeight: 9, lineColor: [120, 120, 120], lineWidth: 0.2 },
    headStyles: { fillColor: ROJO, textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 9 },
    columnStyles: { 0: { cellWidth: ancho / 2 }, 1: { cellWidth: ancho / 2 } },
    margin: { left: M, right: M },
  })

  // Lo que planificación anotó después, al revisarla en la minuta. Va como
  // anexo, fuera del formato: el formato es el que se firmó.
  if (e.obsPlan) {
    banda('Anexo · observación de planificación (no es parte del formato)', GRIS_SEC, 6)
    tabla([['Anotó', 'Observación']], [[e.obsPlanPor || '', e.obsPlan]], { 0: { cellWidth: 40 } })
  }

  // pie con el turno, que el formato oficial no tiene casilla para él
  const paginas = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(120)
    doc.text(
      `${CONTRATO.codigo} · ${e.fecha} · turno ${nombreTurno(e.turno)}`,
      M, doc.internal.pageSize.getHeight() - 6,
    )
    doc.text(`Página ${p} de ${paginas}`, W - M, doc.internal.pageSize.getHeight() - 6, { align: 'right' })
  }

  doc.save(`${nombreBase(e)}.pdf`)
}

/** CSV con `;` y BOM para mirar varias entregas juntas en Excel. */
export function bajarCSVEntregas(entregas: Entrega[]): void {
  const limpio = (t: string) => `"${(t ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' / ')}"`
  const cab = ['FECHA', 'SEMANA', 'TURNO', 'ENTREGA', 'RECIBE', 'OT', 'OBSERVACIONES', 'ESTADO']
  const filas: string[] = []
  for (const e of entregas) {
    const base = [e.fecha, e.semana, nombreTurno(e.turno), limpio(e.entrega.nombre), limpio(e.recibe.nombre)]
    if (e.ots.length === 0) filas.push([...base, '', '', ''].join(';'))
    for (const o of e.ots) filas.push([...base, o.ot, limpio(o.observaciones), o.estado].join(';'))
    for (const a of e.adicionales) filas.push([...base, 'adicional', limpio(a.descripcion), a.estado].join(';'))
    for (const a of e.amenazas) filas.push([...base, 'amenaza', limpio(a.descripcion), ''].join(';'))
  }
  const texto = [cab.join(';'), ...filas].join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `Entregas_turno_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
