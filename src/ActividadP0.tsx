// Pantalla de una actividad del outage del Rack 4 de Planta 0.
//
// Una sola pantalla para todos los tipos del catálogo P0 (`actividadesP0.ts`):
//  · malla  → las 4 mallas de cada lado, una por bloque.
//  · piezas → codos inox, bajadas PPR y tapas: se marca la PIEZA en su plano de
//             detalle (`planoP0.ts`); retirada = contorno punteado con visto.
//  · simple → la vasija como círculo (membranas, limpieza, carguío, tapones).
//  · fugas  → pruebas de baja y alta: sin fuga, o dónde filtra.
// Todo se guarda en `avance_item`, con la misma cola sin señal que el resto.
import { useState, type MouseEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { encolar } from './sync'
import { quienSoy } from './identidad'
import { itemId, LADOS, type LadoRack } from './types'
import type { Actividad } from './actividades'
import { nombreRack, usePuedeRegistrar, useRack } from './rackOutage'
import { SIN_AISLADAS, marcarAislada, useAisladas } from './aisladas'
import { MALLAS_P0, componentesFugaP0, piezaDe, respetaAisladasP0 } from './actividadesP0'
import {
  ALTO_P, ALTO_V, ANCHO_P, ANCHO_V, TOTAL_P0, VASIJAS_P0,
  iconoPieza, ordenSemiP0, planoMallas, planoPiezas, planoVasijas,
  type ColorVasija, type EstadoPieza, type EstadoPiezaFn, type VistaP0,
} from './planoP0'
import { generarPDFP0, type LeyendaP0 } from './pdfP0'

const VERDE = { c: '#22c55e', t: '#052e16' }
// en el Rack 4 P0 la aislada va en celeste (Brayan, 14-11-2026)
const CELESTE = '#7dd3fc'
const AISLADA = { c: CELESTE, t: '#0c4a6e' }

type DatosFuga = { fugas?: string[] }

/** Nombre del PDF como lo pidió Brayan (15-11-2026): con espacios y sin tildes,
    "Retiro tapas alimentacion.pdf". Si la actividad va por los dos lados, el lado
    se agrega al final. */
function nombrePdf(a: Actividad, lado: LadoRack): string {
  let n = a.nombre.replace(/\s*·\s*/g, ' ').replace(/\b(de|del)\b/gi, ' ')
  if (!a.sinLado && a.lados.length > 1) n += lado === 'alimentacion' ? ' alimentacion' : ' descarga'
  n = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
  return `${n}.pdf`
}

export default function ActividadP0({ actividad: a }: { actividad: Actividad }) {
  const rack = useRack()
  const puedeEditar = usePuedeRegistrar()
  const [ladoSel, setLadoSel] = useState<LadoRack>(a.lados[0])
  const lado: LadoRack = a.sinLado ? a.lados[0] : ladoSel
  const [vista, setVista] = useState<VistaP0>(ordenSemiP0(a.lados[0])[0])
  const [aislando, setAislando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [confirmarTodo, setConfirmarTodo] = useState(false)
  const [fugaAbierta, setFugaAbierta] = useState<string | null>(null)
  const [generando, setGenerando] = useState(false)

  const todasAisladas = useAisladas(rack)
  const aisladas = respetaAisladasP0(a.id) ? todasAisladas : SIN_AISLADAS
  const items = useLiveQuery(
    () => db.items.where('[actividad+rack]').equals([a.id, rack]).toArray(), [a.id, rack],
  ) ?? []
  const delLado = items.filter((i) => i.lado === lado)
  const porItem = new Map(delLado.map((i) => [i.item, i]))
  const hecho = (id: string) => !!porItem.get(id)?.hecho
  const fugasDe = (id: string) => ((porItem.get(id)?.datos as DatosFuga | undefined)?.fugas) ?? []

  const retiro = !!a.retira
  const pieza = piezaDe(a)
  const esMalla = a.tipo === 'malla'
  const esPrueba = a.tipo === 'fugas'
  const esCarguio = a.id === 'p0_carguio'
  // las aisladas se marcan en el retiro de tapas y en el carguío
  const marcaAisladas = esCarguio || a.id.startsWith('p0_retiro_tapas')
  const total = esMalla ? MALLAS_P0.length : TOTAL_P0 - aisladas.size
  const hechos = esMalla
    ? MALLAS_P0.filter((m) => hecho(m.id)).length
    : VASIJAS_P0.filter((v) => !aisladas.has(v) && hecho(v)).length
  const conFuga = esPrueba ? VASIJAS_P0.filter((v) => !aisladas.has(v) && hecho(v) && fugasDe(v).length > 0).length : 0
  const pct = total ? Math.round((hechos / total) * 1000) / 10 : 0
  const colorAvance = VERDE.c
  const nombreLado = LADOS.find((l) => l.codigo === lado)!.nombre

  const guardar = async (item: string, valor: boolean, datos: Record<string, unknown> = {}) => {
    const yo = quienSoy()
    await db.items.put({
      id: itemId(a.id, lado, rack, item), actividad: a.id, lado, rack, item, hecho: valor, datos,
      creadoPor: yo, createdAt: Date.now(), sincronizado: false,
    })
    await encolar('item_upsert', { actividad: a.id, lado, rack, item, hecho: valor, datos, creado_por: yo })
  }

  // ---- cómo se pinta cada vasija o pieza
  const colorVasija = (id: string): ColorVasija | null => {
    if (aisladas.has(id)) return AISLADA
    if (esPrueba) {
      if (!hecho(id)) return null
      return fugasDe(id).length ? { c: '#fff7d6', t: '#0f172a', anillo: true } : VERDE
    }
    return hecho(id) ? VERDE : null
  }
  const estado = Object.assign(
    (id: string): EstadoPieza => {
      if (aisladas.has(id)) return 'ais'
      if (hecho(id)) return retiro ? 'fuera' : 'nuevo'
      return retiro ? 'orig' : 'fuera'
    },
    { retiro },
  ) as EstadoPiezaFn
  const svg = (v: VistaP0, paraPdf = false) => pieza
    ? planoPiezas(lado, v, pieza, estado, paraPdf)
    : planoVasijas(lado, v, colorVasija, paraPdf)

  // ---- tocar
  const tocar = async (id: string) => {
    setAviso('')
    if (aislando && !esMalla) {
      const ya = todasAisladas.has(id)
      if (confirm(ya
        ? `¿La vasija ${id} deja de estar aislada? Vuelve a contar desde el carguío.`
        : `¿Aislar la vasija ${id}? No se interviene desde el carguío en adelante.`)) await marcarAislada(rack, id, !ya)
      return
    }
    if (!esMalla && aisladas.has(id)) {
      setAviso(`La vasija ${id} está aislada: no se interviene.${marcaAisladas && puedeEditar ? ' Para quitarla, usa "Marcar aisladas".' : ''}`)
      return
    }
    if (esPrueba) { setFugaAbierta(id); return }
    if (esMalla) { if (puedeEditar) await guardar(id, !hecho(id)); return }
    if (puedeEditar) await guardar(id, !hecho(id))
  }
  const alTocarPlano = (e: MouseEvent<HTMLDivElement>) => {
    const g = (e.target as Element).closest('[data-v]')
    const id = g?.getAttribute('data-v')
    if (id) void tocar(id)
  }

  const marcarTodos = async (valor: boolean) => {
    setConfirmarTodo(false)
    for (const v of VASIJAS_P0) {
      if (aisladas.has(v) || hecho(v) === valor) continue
      await guardar(v, valor)
    }
  }

  // ---- PDF en formato United, una sola hoja (plano, avance y leyenda; sin detalle)
  const exportarPDF = async () => {
    setGenerando(true)
    try {
      const leyenda: LeyendaP0[] = esPrueba
        ? [
          { color: VERDE.c, borde: '#15803d', nombre: 'Sin fuga', n: hechos - conFuga },
          { color: '#f0b400', borde: '#8a6d03', nombre: 'Con fuga', n: conFuga },
          { color: '#ffffff', nombre: 'Sin revisar', n: total - hechos },
        ]
        : [
          { color: VERDE.c, borde: '#15803d', nombre: retiro ? 'Retirado' : 'Hecho', n: hechos },
          { color: pieza ? '#8a95a3' : '#ffffff', nombre: pieza && retiro ? 'Todavía puesto' : 'Pendiente', n: total - hechos },
        ]
      if (aisladas.size) leyenda.push({ color: CELESTE, borde: '#0369a1', nombre: 'Aislada', n: aisladas.size })
      const doc = await generarPDFP0({
        titulo: a.nombre,
        subtitulo: a.sinLado ? nombreRack(rack) : `${nombreRack(rack)} · ${nombreLado}`,
        svg: svg('todo', true),
        vb: pieza ? { ancho: ANCHO_P, alto: ALTO_P } : { ancho: ANCHO_V, alto: ALTO_V },
        avance: { pct, detalle: `${hechos} de ${total} ${retiro ? 'retirados' : 'hechos'}`, color: '#15803d' },
        leyenda,
        total: { nombre: aisladas.size ? 'Vasijas a intervenir' : 'Vasijas del rack', n: total },
        generadoPor: quienSoy(),
      })
      doc.save(nombrePdf(a, lado))
    } finally {
      setGenerando(false)
    }
  }

  const nombrePieza = pieza === 'codo' ? 'Codo inox' : pieza === 'ppr' ? 'Bajada PPR' : 'Tapa'
  const fem = pieza === 'tapa' ? 'a' : 'o'
  const filaIcono = (html: string, texto: string, n: number) => (
    <span className="leg-item leg-pieza">
      <span className="leg-icono" dangerouslySetInnerHTML={{ __html: html }} />
      <span className="leg-texto">{texto}</span>
      <i>{n}</i>
    </span>
  )

  return (
    <div>
      <div className="plano-titulo">
        <b>{a.nombre.toUpperCase()}</b>
        <span>{a.sinLado ? nombreRack(rack).toUpperCase() : `${nombreLado.toUpperCase()} · ${nombreRack(rack).toUpperCase()}`}</span>
      </div>

      {a.lados.length > 1 && !a.sinLado && (
        <div className="lado-seg">
          {a.lados.map((l) => (
            <button key={l} className={lado === l ? 'on' : ''} onClick={() => { setLadoSel(l); setVista(ordenSemiP0(l)[0]); setConfirmarTodo(false) }}>
              {LADOS.find((x) => x.codigo === l)!.corto}
              <small>{items.filter((i) => i.lado === l && i.hecho).length} hechos</small>
            </button>
          ))}
        </div>
      )}

      <div className="avance">
        <div className="avance-top">
          <b>{pct}%</b>
          <span>
            {esMalla ? `${hechos} de ${total} mallas`
              : esPrueba ? `${hechos} de ${total} revisadas · ${conFuga} con fuga`
              : `${hechos} de ${total} ${pieza ? (retiro ? 'retirad' + fem + 's' : 'instalad' + fem + 's') : 'hechos'}`}
          </span>
          {!esMalla && (
            <button className="btn sm ghost" disabled={generando} onClick={() => void exportarPDF()}>
              {generando ? 'Generando…' : 'PDF'}
            </button>
          )}
        </div>
        <div className="avance-bar"><span style={{ width: `${pct}%`, background: colorAvance }} /></div>
      </div>

      {/* codos y PPR son trabajo rápido: se puede confirmar el lado completo de una vez */}
      {(pieza === 'codo' || pieza === 'ppr') && puedeEditar && (
        <div className="avance rapido">
          <b>Marcado rápido · {nombreLado.toLowerCase()}</b>
          {confirmarTodo ? (
            <>
              <span className="hint" style={{ margin: 0 }}>
                ¿Confirmas que se {retiro ? 'retiraron' : 'instalaron'} {pieza === 'codo' ? 'los codos inox' : 'las bajadas PPR'} de
                las {total} vasijas de {nombreLado.toLowerCase()}? Las aisladas no se tocan.
              </span>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn sm" onClick={() => void marcarTodos(true)}>Sí, todos {retiro ? 'retirados' : 'instalados'}</button>
                <button className="btn sm ghost" onClick={() => setConfirmarTodo(false)}>No</button>
              </div>
            </>
          ) : (
            <>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button className="btn sm" disabled={hechos >= total} onClick={() => setConfirmarTodo(true)}>
                  ✓ Todos {retiro ? 'retirados' : 'instalados'} ({total - hechos} pendientes)
                </button>
                <button className="btn sm ghost" disabled={hechos === 0} onClick={() => { if (confirm('¿Desmarcar todas las vasijas de este lado?')) void marcarTodos(false) }}>
                  Desmarcar todos
                </button>
              </div>
              <span className="hint" style={{ margin: 0 }}>Para cuando el lado completo quedó listo de una vez. Después se corrige vasija por vasija.</span>
            </>
          )}
        </div>
      )}

      {marcaAisladas && puedeEditar && (
        <div className="seg aislar-seg">
          <button className={!aislando ? 'on' : ''} onClick={() => { setAislando(false); setAviso('') }}>{esCarguio ? 'Marcar cargadas' : 'Marcar retiradas'}</button>
          <button className={aislando ? 'on aislar' : ''} onClick={() => { setAislando(true); setAviso('') }}>
            Marcar aisladas{todasAisladas.size ? ` (${todasAisladas.size})` : ''}
          </button>
        </div>
      )}
      {aislando && (
        <p className="hint aviso-aislar">
          Toca las vasijas aisladas: quedan en celeste, no se abren y salen del total desde el retiro de tapas en adelante. Otro toque la vuelve a habilitar.
        </p>
      )}
      {aviso && <p className="hint aviso-aislar">{aviso}</p>}

      {esMalla ? (
        <>
          <p className="hint" style={{ margin: '0 0 8px' }}>
            Vista desde {nombreLado.toLowerCase()}. Toca la malla para marcarla {retiro ? 'retirada' : 'instalada'}: amarilla = puesta · verde punteada = retirada.
          </p>
          <div className="fugas-scroll" onClick={alTocarPlano}>
            <div dangerouslySetInnerHTML={{ __html: planoMallas(
              lado,
              // puesta: en el retiro, mientras no se marque; en la instalación, cuando se marca
              (m) => (retiro ? !hecho(m) : hecho(m)),
              (m) => hecho(m),
            ) }} />
          </div>
        </>
      ) : (
        <>
          <div className="vista-seg">
            {ordenSemiP0(lado).map((sr) => (
              <button key={sr} className={vista === sr ? 'on' : ''} onClick={() => setVista(sr)}>Semi Rack {sr}</button>
            ))}
            <button className={vista === 'todo' ? 'on' : ''} onClick={() => setVista('todo')}>Todo</button>
          </div>
          {pieza && (
            <p className="hint" style={{ margin: '0 0 8px' }}>
              {pieza === 'codo' && `Toca el codo inox de cada vasija para marcarlo ${retiro ? 'retirado' : 'instalado'}. Cada codo baja de su salida en el cabezal de la fila, con un piedmont arriba y otro abajo.`}
              {pieza === 'ppr' && `Toca la bajada PPR de cada vasija para marcarla ${retiro ? 'retirada' : 'instalada'}. Sube del centro de la tapa al manifold PPR de la fila.`}
              {pieza === 'tapa' && `Toca la tapa y queda ${retiro ? 'retirada: se ve el contorno punteado y la vasija hueca' : 'instalada'}. Otro toque la deshace.`}
            </p>
          )}
          {esPrueba && <p className="hint" style={{ margin: '0 0 8px' }}>Toca una vasija: márcala sin fuga o elige dónde filtra.</p>}
          <div className={'fugas-scroll' + (pieza ? ' scrollx' : '')} onClick={alTocarPlano}>
            <div style={pieza ? { minWidth: vista === 'todo' ? 1100 : 620 } : undefined} dangerouslySetInnerHTML={{ __html: svg(vista) }} />
          </div>
        </>
      )}

      <div className="leyenda abajo">
        <b className="leg-titulo">LEYENDA{pieza ? ` · ${nombrePieza.toUpperCase()}` : ''}</b>
        {pieza ? (
          retiro ? <>
            {filaIcono(iconoPieza(pieza, 'fuera', true, lado), `${nombrePieza} retirad${fem}`, hechos)}
            {filaIcono(iconoPieza(pieza, 'orig', false, lado), `${nombrePieza} todavía puest${fem}`, total - hechos)}
          </> : <>
            {filaIcono(iconoPieza(pieza, 'nuevo', false, lado), `${nombrePieza} instalad${fem}`, hechos)}
            {filaIcono(iconoPieza(pieza, 'fuera', false, lado), 'Falta instalar', total - hechos)}
          </>
        ) : esPrueba ? <>
          <span className="leg-item"><span className="leg-dot" style={{ background: VERDE.c }} /> Sin fuga<em /><i>{hechos - conFuga}</i></span>
          <span className="leg-item"><span className="leg-dot" style={{ background: '#f0b400' }} /> Con fuga<em /><i>{conFuga}</i></span>
          <span className="leg-item"><span className="leg-dot vacio" /> Sin revisar<em /><i>{total - hechos}</i></span>
        </> : <>
          {esMalla ? <>
            <span className="leg-item"><span className="leg-dot" style={{ background: '#f2c200', border: '1.5px solid #a37800' }} /> Malla puesta<em /><i>{retiro ? total - hechos : hechos}</i></span>
            <span className="leg-item"><span className="leg-dot" style={{ background: 'rgba(34,197,94,.15)', border: '1.5px dashed #16a34a' }} /> Malla retirada<em /><i>{retiro ? hechos : total - hechos}</i></span>
          </> : <>
            <span className="leg-item"><span className="leg-dot" style={{ background: colorAvance }} /> {retiro ? 'Retirado' : 'Hecho'}<em /><i>{hechos}</i></span>
            <span className="leg-item"><span className="leg-dot vacio" /> Pendiente<em /><i>{total - hechos}</i></span>
          </>}
        </>}
        {(aisladas.size > 0 || marcaAisladas) && !esMalla && (
          <span className="leg-item"><span className="leg-dot" style={{ background: CELESTE, border: '1.5px solid #0369a1' }} /> Aislada<em /><i>{aisladas.size}</i></span>
        )}
        <span className="leg-item total">
          <span className="leg-dot oculto" /> TOTAL
          <em>{esMalla ? 'Mallas de este lado' : aisladas.size ? 'Vasijas a intervenir' : 'Vasijas del rack'}</em>
          <i>{total}</i>
        </span>
      </div>

      {fugaAbierta && (
        <div className="p0-velo" onClick={() => setFugaAbierta(null)}>
          <div className="p0-hoja" onClick={(e) => e.stopPropagation()}>
            <b>{nombreRack(rack)} · Vasija {fugaAbierta} · {nombreLado}</b>
            <div className="chips-fuga">
              {componentesFugaP0(a.id, lado).map((c) => {
                const on = fugasDe(fugaAbierta).includes(c)
                return (
                  <button key={c} className={on ? 'on' : ''} disabled={!puedeEditar} onClick={() => {
                    const actual = fugasDe(fugaAbierta)
                    const next = on ? actual.filter((x) => x !== c) : [...actual, c]
                    void guardar(fugaAbierta, true, { fugas: next })
                  }}>{c}</button>
                )
              })}
            </div>
            <div className="row" style={{ gap: 8 }}>
              {puedeEditar && <button className="btn sm" onClick={() => { void guardar(fugaAbierta, true, { fugas: [] }); setFugaAbierta(null) }}>Revisada sin fuga</button>}
              {puedeEditar && hecho(fugaAbierta) && <button className="btn sm ghost" onClick={() => { void guardar(fugaAbierta, false, {}); setFugaAbierta(null) }}>Borrar</button>}
              <button className="btn sm ghost" onClick={() => setFugaAbierta(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
