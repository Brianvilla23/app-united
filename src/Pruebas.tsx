// Prueba de presión (baja y alta): se presuriza el rack y se recorre buscando
// fugas. Acá se registra el recorrido — qué se revisó y dónde filtró.
//
// No usa el módulo de fugas del rack completo: ese marca victaulic y sideports
// del spool, y estas pruebas miran otras piezas (tapón, tapa, interconector,
// venteo, y en alta también manifold, stub end y tubing).
//
// Cada vasija queda en uno de tres estados: sin revisar, revisada sin fuga, o
// con fuga. Los venteos van aparte porque son del semi rack, no de una vasija.
import { createElement, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { encolar } from './sync'
import { quienSoy } from './identidad'
import { itemId, LADOS, RACK_TAPAS, type LadoRack } from './types'
import {
  COMPONENTES_PRUEBA, componentesDe, venteosDe,
  type Actividad, type ComponentePrueba,
} from './actividades'
import { ALTO, ANCHO, MARCA, MARCA_BORDE, TOTAL_VASIJAS, type Vista } from './rackLayout'
import PlanoRack from './PlanoRack'
import { generarPDFDiagrama, nombreArchivo } from './pdfDiagrama'
import { usePuedeEditar } from './permisos'

const OK = { color: '#22c55e', texto: '#052e16' }
const FUGA = { color: MARCA, texto: '#3b2a00' }

/** Los venteos se guardan en la misma tabla, con el id prefijado. */
const ITEM_VENTEO = 'venteo:'

interface DatosPrueba { fugas?: ComponentePrueba[] }

export default function Pruebas({ actividad }: { actividad: Actividad }) {
  const [lado, setLado] = useState<LadoRack>(actividad.lados[0])
  const [vista, setVista] = useState<Vista>('A')
  const [sel, setSel] = useState<string | null>(null)
  const puedeEditar = usePuedeEditar()

  const items = useLiveQuery(
    () => db.items.where('actividad').equals(actividad.id).toArray(), [actividad.id],
  ) ?? []
  const delLado = items.filter((i) => i.lado === lado)
  const registro = new Map(delLado.map((i) => [i.item, i]))
  const fugasDe = (item: string): ComponentePrueba[] =>
    ((registro.get(item)?.datos as DatosPrueba | undefined)?.fugas) ?? []
  const revisada = (item: string) => registro.get(item)?.hecho ?? false

  const vasijas = delLado.filter((i) => !i.item.startsWith(ITEM_VENTEO))
  const conFuga = vasijas.filter((i) => fugasDe(i.item).length > 0)
  const revisadas = vasijas.filter((i) => i.hecho)
  const venteos = venteosDe(lado)
  const total = TOTAL_VASIJAS + venteos.length
  const hechas = revisadas.length + venteos.filter((v) => revisada(ITEM_VENTEO + v.id)).length
  const pct = Math.round((hechas / total) * 1000) / 10

  const colores = new Map(
    vasijas
      .filter((i) => i.hecho || fugasDe(i.item).length > 0)
      .map((i) => [i.item, fugasDe(i.item).length > 0 ? FUGA : OK]),
  )

  /** Lee de la base antes de escribir: dos marcas seguidas no se pisan. */
  const guardar = async (item: string, cambio: (fugas: ComponentePrueba[]) => ComponentePrueba[] | null) => {
    if (!puedeEditar) return
    const yo = quienSoy()
    const id = itemId(actividad.id, lado, item)
    const datos = await db.transaction('rw', db.items, async () => {
      const actual = ((await db.items.get(id))?.datos as DatosPrueba | undefined)?.fugas ?? []
      const next = cambio(actual)
      // null = "sin revisar": se borra el registro en vez de dejarlo en blanco
      if (next === null) { await db.items.delete(id); return null }
      await db.items.put({
        id, actividad: actividad.id, lado, item, hecho: true, datos: { fugas: next },
        creadoPor: yo, createdAt: Date.now(), sincronizado: false,
      })
      return next
    })
    if (datos === null) {
      await encolar('item_upsert', {
        actividad: actividad.id, lado, item, hecho: false, datos: {}, creado_por: yo,
      })
      return
    }
    await encolar('item_upsert', {
      actividad: actividad.id, lado, item, hecho: true, datos: { fugas: datos }, creado_por: yo,
    })
  }

  const toggleFuga = (item: string, codigo: ComponentePrueba) =>
    guardar(item, (fugas) => (fugas.includes(codigo) ? fugas.filter((f) => f !== codigo) : [...fugas, codigo]))

  const marcarSinFuga = (item: string) => guardar(item, () => [])
  const dejarSinRevisar = (item: string) => guardar(item, () => null)

  const componentes = componentesDe(actividad.id, lado, 'vasija')

  const [generando, setGenerando] = useState(false)

  const exportarPDF = async () => {
    setGenerando(true)
    try {
      const nombreComp = (c: ComponentePrueba) =>
        COMPONENTES_PRUEBA.find((x) => x.codigo === c)?.nombre ?? c
      const doc = await generarPDFDiagrama({
        titulo: actividad.nombre,
        subtitulo: `Rack ${RACK_TAPAS} · ${LADOS.find((l) => l.codigo === lado)!.nombre}`,
        hoja: 'ancha',
        vb: { ancho: ANCHO, alto: ALTO },
        diagrama: createElement(PlanoRack, {
          modo: 'simple' as const, vista: 'todo' as const, espejo: lado === 'descarga',
          tapaRec: new Map(), porVasija: new Map(), colores, paraPdf: true,
        }),
        avance: { pct, detalle: `${hechas} de ${total} revisados`, color: OK.color },
        leyenda: [
          { color: FUGA.color, nombre: 'Con fuga', desc: 'Filtró en la prueba', n: conFuga.length },
          { color: OK.color, nombre: 'Revisada', desc: 'Sin fuga', n: revisadas.length - conFuga.length },
          { color: '#ffffff', hueco: true, nombre: 'Sin revisar', desc: 'Todavía no se recorre', n: TOTAL_VASIJAS - revisadas.length },
          { color: '#ffffff', hueco: true, nombre: 'TOTAL', desc: 'Vasijas del rack', n: TOTAL_VASIJAS },
        ],
        detalle: [
          {
            titulo: 'Vasijas con fuga',
            color: FUGA.color,
            lineas: conFuga.map((i) => `${i.item}  ·  ${fugasDe(i.item).map(nombreComp).join(', ')}`),
          },
          {
            titulo: 'Venteos',
            lineas: venteos.map((v) => {
              const item = ITEM_VENTEO + v.id
              const estado = fugasDe(item).length > 0 ? 'CON FUGA'
                : revisada(item) ? 'revisado, sin fuga' : 'sin revisar'
              return `Semi ${v.semiRack} · ${v.presion}  ·  ${estado}`
            }),
          },
        ],
        generadoPor: quienSoy(),
      })
      doc.save(nombreArchivo(actividad.nombre, `Rack${RACK_TAPAS}`, lado))
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div>
      <div className="plano-titulo">
        <b>{actividad.nombre.toUpperCase()}</b>
        <span>{LADOS.find((l) => l.codigo === lado)!.nombre.toUpperCase()}</span>
      </div>

      <p className="hint" style={{ margin: '0 0 10px' }}>
        Toca una vasija: queda revisada. Si filtra, marca dónde y se pinta amarillo.
      </p>

      <div className="lado-seg">
        {actividad.lados.map((l) => (
          <button key={l} className={lado === l ? 'on' : ''} onClick={() => { setLado(l); setSel(null) }}>
            {LADOS.find((x) => x.codigo === l)!.corto}
            <small>{items.filter((i) => i.lado === l && i.hecho).length} revisadas</small>
          </button>
        ))}
      </div>

      <div className="avance">
        <div className="avance-top">
          <b>{pct}%</b>
          <span>{hechas} de {total} revisados · {conFuga.length} con fuga</span>
          <button className="btn sm ghost" disabled={generando} onClick={() => void exportarPDF()}>
            {generando ? 'Generando…' : 'PDF'}
          </button>
        </div>
        <div className="avance-bar">
          <span style={{ width: `${pct}%`, background: OK.color }} />
        </div>
      </div>

      <div className="vista-seg">
        <button className={vista === 'A' ? 'on' : ''} onClick={() => setVista('A')}>Semi Rack A</button>
        <button className={vista === 'B' ? 'on' : ''} onClick={() => setVista('B')}>Semi Rack B</button>
        <button className={vista === 'todo' ? 'on' : ''} onClick={() => setVista('todo')}>Todo</button>
      </div>

      <div className="fugas-scroll">
        <PlanoRack
          modo="simple"
          vista={vista}
          espejo={lado === 'descarga'}
          tapaRec={new Map()}
          porVasija={new Map()}
          colores={colores}
          onVasija={(id) => setSel(id)}
        />
      </div>

      {/* los venteos son del semi rack, no de una vasija: van en su propia fila */}
      <div className="venteos-prueba">
        <b>Venteos del lado</b>
        <div className="venteos-chips">
          {venteos.map((v) => {
            const item = ITEM_VENTEO + v.id
            const conf = fugasDe(item).length > 0
            return (
              <button
                key={v.id}
                className={'pieza-chip' + (conf ? ' fuga' : revisada(item) ? ' on' : '')}
                onClick={() => void guardar(item, (f) => (f.includes('venteo') ? [] : ['venteo']))}
              >
                Semi {v.semiRack} · {v.presion}
              </button>
            )
          })}
        </div>
        <small className="hint">Un toque marca fuga en el venteo; otro lo deja revisado sin fuga.</small>
      </div>

      <div className="leyenda abajo">
        <b className="leg-titulo">LEYENDA</b>
        <span className="leg-item">
          <span className="leg-dot" style={{ background: FUGA.color }} /> Con fuga
          <em>Filtró en la prueba</em>
          <i>{conFuga.length}</i>
        </span>
        <span className="leg-item">
          <span className="leg-dot" style={{ background: OK.color }} /> Revisada
          <em>Sin fuga</em>
          <i>{revisadas.length - conFuga.length}</i>
        </span>
        <span className="leg-item">
          <span className="leg-dot vacio" /> Sin revisar
          <em>Todavía no se recorre</em>
          <i>{TOTAL_VASIJAS - revisadas.length}</i>
        </span>
        <span className="leg-item total">
          <span className="leg-dot oculto" /> TOTAL
          <em>Vasijas del rack</em>
          <i>{TOTAL_VASIJAS}</i>
        </span>
      </div>

      {sel && (
        <div className="modal-overlay" onClick={() => setSel(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <b>Vasija {sel}</b>
              <button className="modal-x" onClick={() => setSel(null)}>✕</button>
            </div>
            <p className="hint" style={{ margin: '0 0 10px' }}>
              {revisada(sel)
                ? fugasDe(sel).length > 0
                  ? `Filtra por ${fugasDe(sel).length} punto${fugasDe(sel).length > 1 ? 's' : ''}`
                  : 'Revisada, sin fuga'
                : 'Sin revisar'}
            </p>

            <div className="comp-list">
              {componentes.map((c) => {
                const on = fugasDe(sel).includes(c.codigo)
                return (
                  <button
                    key={c.codigo}
                    className={'comp-btn' + (on ? ' on' : '')}
                    style={on ? { borderColor: MARCA_BORDE, background: 'rgba(240,180,0,.16)' } : undefined}
                    onClick={() => void toggleFuga(sel, c.codigo)}
                  >
                    <span className="leg-dot" style={{ background: on ? MARCA : '#e2e8f0' }} />
                    <span style={{ flex: 1, textAlign: 'left' }}>
                      {c.nombre}
                      <small style={{ display: 'block', fontWeight: 500, color: 'var(--muted)' }}>{c.detalle}</small>
                    </span>
                    {on && <b style={{ color: MARCA_BORDE }}>fuga</b>}
                  </button>
                )
              })}
            </div>

            {puedeEditar && <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <button className="btn sm" style={{ flex: 1 }} onClick={() => { void marcarSinFuga(sel); setSel(null) }}>
                Revisada, sin fuga
              </button>
              <button className="btn sm ghost" onClick={() => { void dejarSinRevisar(sel); setSel(null) }}>
                Sin revisar
              </button>
            </div>}
          </div>
        </div>
      )}
    </div>
  )
}
