// Actividades del outage que no caen sobre una vasija ni sobre un manifold:
// armar y retirar andamios del pasillo seguro, verificar el bloqueo, recibir
// materiales, entregar el rack a operaciones. No tienen plano —no hay nada que
// dibujar—, así que se tildan de a una.
//
// Guardan en la misma tabla que el resto del avance (`items` / `avance_item`),
// con `item` = 'p1', 'p2'… según la posición en la checklist de la actividad, y
// el lado como columna aparte: una actividad de los dos lados lleva su propio
// registro en cada uno.
import { createElement, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { encolar } from './sync'
import { quienSoy } from './identidad'
import { itemId, LADOS, type LadoRack } from './types'
import type { Actividad } from './actividades'
import { generarPDFDiagrama, nombreArchivo } from './pdfDiagrama'
import { usePuedeEditar } from './permisos'
import { fechaHistorial, fechaHora } from './fecha'

const HECHO = '#22c55e'

/** Cada paso queda identificado por su posición, no por su texto: así un
    acento corregido en el catálogo no pierde lo que ya se marcó en terreno. */
function idPaso(i: number): string {
  return `p${i + 1}`
}

export default function Pasos({ actividad, rack }: { actividad: Actividad; rack: number }) {
  const puedeEditar = usePuedeEditar()
  const [generando, setGenerando] = useState(false)
  const checklist = actividad.checklist ?? []
  // sinLado: la actividad es del rack completo y se registra una sola vez.
  const lados: LadoRack[] = actividad.sinLado ? [actividad.lados[0]] : actividad.lados

  const items = useLiveQuery(
    () => db.items.where('actividad').equals(actividad.id).toArray(),
    [actividad.id],
  ) ?? []
  const propios = items.filter((i) => i.rack === rack)

  const hechoDe = (lado: LadoRack, i: number): boolean =>
    propios.find((x) => x.lado === lado && x.item === idPaso(i))?.hecho ?? false

  const quienDe = (lado: LadoRack, i: number): string =>
    propios.find((x) => x.lado === lado && x.item === idPaso(i))?.creadoPor ?? ''

  const cuandoDe = (lado: LadoRack, i: number): number | undefined =>
    propios.find((x) => x.lado === lado && x.item === idPaso(i))?.createdAt

  const total = checklist.length * lados.length
  const hechos = lados.reduce(
    (n, l) => n + checklist.filter((_, i) => hechoDe(l, i)).length, 0,
  )
  const pct = total > 0 ? Math.round((hechos / total) * 1000) / 10 : 0

  const toggle = async (lado: LadoRack, i: number) => {
    const yo = quienSoy()
    const item = idPaso(i)
    const next = !hechoDe(lado, i)
    const datos = { paso: checklist[i] }
    await db.items.put({
      id: itemId(actividad.id, rack, lado, item),
      actividad: actividad.id, rack, lado, item, hecho: next, datos,
      creadoPor: yo, createdAt: Date.now(), sincronizado: false,
    })
    await encolar('item_upsert', {
      actividad: actividad.id, rack, lado, item, hecho: next, datos, creado_por: yo,
    })
  }

  const exportarPDF = async () => {
    setGenerando(true)
    try {
      const doc = await generarPDFDiagrama({
        titulo: actividad.nombre,
        subtitulo: actividad.sinLado
          ? `Rack ${rack}`
          : `Rack ${rack} · ${lados.map((l) => LADOS.find((x) => x.codigo === l)!.corto).join(' y ')}`,
        hoja: 'compacta',
        vb: { ancho: RESUMEN_W, alto: RESUMEN_H },
        diagrama: createElement(Resumen, { hechos, total, pct }),
        avance: { pct, detalle: `${hechos} de ${total} pasos`, color: HECHO },
        leyenda: [
          { color: HECHO, nombre: 'Hecho', desc: 'Paso ya ejecutado', n: hechos },
          { color: '#ffffff', hueco: true, nombre: 'Pendiente', desc: 'Todavía no se hace', n: total - hechos },
        ],
        detalle: lados.map((lado) => ({
          titulo: actividad.sinLado
            ? 'Pasos'
            : LADOS.find((l) => l.codigo === lado)!.nombre,
          lineas: checklist.map((p, i) => {
            const quien = quienDe(lado, i)
            const cuando = cuandoDe(lado, i)
            return hechoDe(lado, i)
              ? `${p}  ·  hecho${quien ? ` por ${quien}` : ''}${cuando ? ` · ${fechaHora(cuando)}` : ''}`
              : `${p}  ·  pendiente`
          }),
        })),
        generadoPor: quienSoy(),
      })
      doc.save(nombreArchivo(actividad.nombre, `Rack${rack}`, actividad.sinLado ? '' : lados.join('-')))
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div>
      <div className="plano-titulo">
        <b>{actividad.nombre.toUpperCase()}</b>
        <span>{hechos} DE {total} PASOS</span>
      </div>

      <div className="avance">
        <div className="avance-top">
          <b>{pct}%</b>
          <span>{hechos} de {total} pasos</span>
          <button className="btn sm ghost" disabled={generando} onClick={() => void exportarPDF()}>
            {generando ? 'Generando…' : 'PDF'}
          </button>
        </div>
        <div className="avance-bar">
          <span style={{ width: `${pct}%`, background: HECHO }} />
        </div>
      </div>

      {actividad.ventana && (
        <p className="pasos-ventana">Ventana planificada · {actividad.ventana}</p>
      )}
      {actividad.nota && <p className="pasos-nota">{actividad.nota}</p>}

      {lados.map((lado) => (
        <div key={lado} className="pasos-bloque">
          {!actividad.sinLado && (
            <b className="pasos-lado">{LADOS.find((l) => l.codigo === lado)!.nombre.toUpperCase()}</b>
          )}
          <ol className="pasos-lista">
            {checklist.map((p, i) => {
              const on = hechoDe(lado, i)
              const quien = quienDe(lado, i)
              const cuando = cuandoDe(lado, i)
              return (
                <li key={i} className={'paso' + (on ? ' hecho' : '')}>
                  <button
                    disabled={!puedeEditar}
                    onClick={() => puedeEditar && void toggle(lado, i)}
                  >
                    <span className="paso-check">{on ? '✓' : ''}</span>
                    <span className="paso-txt">
                      {p}
                      {on && quien && (
                        <small>{quien}{cuando ? ` · ${fechaHistorial(cuando)}` : ''}</small>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </div>
  )
}

const RESUMEN_W = 340, RESUMEN_H = 96

/** Dibujo mínimo para el PDF: la actividad no tiene plano, así que lo que va
    arriba de la hoja es el avance. El detalle paso por paso va en la hoja 2. */
function Resumen({ hechos, total, pct }: { hechos: number; total: number; pct: number }) {
  const ancho = RESUMEN_W - 40
  return (
    <svg
      viewBox={`0 0 ${RESUMEN_W} ${RESUMEN_H}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <text x={RESUMEN_W / 2} y={26} textAnchor="middle" fontSize={13} fontWeight={800} fill="#0f172a">
        {hechos} de {total} pasos
      </text>
      <rect x={20} y={42} width={ancho} height={16} rx={8} fill="#e2e8f0" />
      <rect x={20} y={42} width={(ancho * pct) / 100} height={16} rx={8} fill={HECHO} />
      <text x={RESUMEN_W / 2} y={82} textAnchor="middle" fontSize={11} fontWeight={700} fill="#475569">
        {pct}%
      </text>
    </svg>
  )
}
