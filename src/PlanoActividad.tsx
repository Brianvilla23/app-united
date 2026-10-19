// Diagrama genérico de una actividad del outage.
//  · tipo 'simple'   → el plano de 295 vasijas, sin componentes: se toca y queda hecho.
//  · tipo 'manifold' → los 40 manifolds (10 filas × 4).
// Ambos guardan en la misma tabla `items`, así que agregar una actividad nueva
// es elegir el tipo en el catálogo, no programar una pantalla.
import { createElement, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { encolar } from './sync'
import { quienSoy } from './identidad'
import { itemId, LADOS, type DatosManifold, type LadoRack } from './types'
import {
  MANIFOLDS, NOMBRE_PARTE, PLANO_MF, piezasPorLado, resumirManifold, vasijasDeManifold,
  type Actividad,
} from './actividades'
import { ALTO, ANCHO, CELDAS, TOTAL_VASIJAS, ordenSemiRacks, type Vista } from './rackLayout'
import PlanoRack from './PlanoRack'
import PlanoManifolds, { type EstadoManifold } from './PlanoManifolds'
import DetalleManifold from './DetalleManifold'
import { agruparPorFila, generarPDFDiagrama, nombreArchivo } from './pdfDiagrama'
import { rackDe, usePuedeRegistrar, useRack } from './rackOutage'
import { useModal } from './useModal'
import DetalleMembranas from './DetalleMembranas'
import {
  MEMBRANAS_POR_VASIJA, completa as membranasCompleta,
  puestas as membranasPuestas, type DatosMembranas,
} from './membranas'
import { bajarExcelMembranas } from './xlsxMembranas'
import { COLOR_AISLADA, marcarAislada, useAisladasDe } from './aisladas'

const HECHO = '#22c55e'
const EMPEZADO = '#d97706'
// Lo que se RETIRA no se pinta verde: verde dice "está puesto", y un manifold
// retirado justamente ya no está. Va en el plomo del bastidor, con su visto.
const RETIRADO = '#8e99a8'
const RETIRADO_BORDE = '#5b6675'

export default function PlanoActividad({ actividad }: { actividad: Actividad }) {
  const [lado, setLado] = useState<LadoRack>(actividad.lados[0])
  // arranca en el semi rack que va primero en ese lado (en descarga, el B)
  const [vista, setVista] = useState<Vista>(ordenSemiRacks(actividad.lados[0] === 'descarga')[0])
  const [abierto, abrirManifold, cerrarManifold] = useModal<string>()
  const [vasijaAbierta, abrirVasija, cerrarVasija] = useModal<string>()
  const esMembranas = !!actividad.membranas
  const rack = useRack()
  const puedeEditar = usePuedeRegistrar()
  // del carguío en adelante, las aisladas no se intervienen (`aisladas.ts`)
  const aisladas = useAisladasDe(actividad.id, rack)
  const esCarguio = actividad.id === 'carguio_membrana'
  const [aislando, setAislando] = useState(false)
  const [aviso, setAviso] = useState('')
  const items = useLiveQuery(
    () => db.items.where('[actividad+rack]').equals([actividad.id, rack]).toArray(),
    [actividad.id, rack],
  ) ?? []

  const delLado = items.filter((i) => i.lado === lado)
  const hechos = new Set(delLado.filter((i) => i.hecho && !aisladas.has(i.item)).map((i) => i.item))
  const datosDe = (item: string): DatosManifold =>
    (delLado.find((i) => i.item === item)?.datos as DatosManifold | undefined) ?? {}
  // manifolds (o vasijas) empezados pero no terminados: se ven distinto
  const empezados = new Set(
    actividad.partes
      ? delLado.filter((i) => !i.hecho && resumirManifold(i.item, actividad.partes!, i.datos as DatosManifold, aisladas).hechas > 0)
        .map((i) => i.item)
      : esMembranas
        ? delLado.filter((i) => {
          if (aisladas.has(i.item)) return false
          const d = i.datos as DatosMembranas
          return !membranasCompleta(d) && membranasPuestas(d) > 0
        }).map((i) => i.item)
        : [],
  )

  /** Las membranas de cada vasija, para el detalle y para avisar de series repetidas. */
  const membranasPorVasija = new Map<string, DatosMembranas>(
    esMembranas ? delLado.map((i) => [i.item, i.datos as DatosMembranas]) : [],
  )
  const membranasPuestasTotal = esMembranas
    ? delLado.filter((i) => !aisladas.has(i.item)).reduce((n, i) => n + membranasPuestas(i.datos as DatosMembranas), 0)
    : 0
  // la vasija empezada (1 a 6 membranas) se pinta ámbar; la completa, verde;
  // la aislada, azul
  const coloresMembranas = esMembranas || aisladas.size
    ? new Map<string, { color: string; texto: string }>([
      ...(esMembranas ? [...empezados].map((v) => [v, { color: '#fcd34d', texto: '#422006' }] as const) : []),
      ...[...aisladas].map((v) => [v, COLOR_AISLADA] as const),
    ])
    : undefined
  const totalLado = actividad.tipo === 'manifold' ? MANIFOLDS.length : TOTAL_VASIJAS - aisladas.size
  const piezasPorVasija = (actividad.partes ?? []).filter((p) => p !== 'manifold').length
  const color = actividad.retira ? RETIRADO : HECHO
  const colorBorde = actividad.retira ? RETIRADO_BORDE : '#15803d'
  // con piezas la barra cuenta piezas puestas; si no, ítems terminados
  const avance = actividad.partes
    ? {
      total: piezasPorLado(actividad.partes) - aisladas.size * piezasPorVasija,
      hechas: delLado.reduce(
        (n, i) => n + resumirManifold(i.item, actividad.partes!, i.datos as DatosManifold, aisladas).hechas, 0,
      ),
      unidad: 'piezas',
    }
    : esMembranas
      ? { total: totalLado * MEMBRANAS_POR_VASIJA, hechas: membranasPuestasTotal, unidad: 'membranas' }
      : { total: totalLado, hechas: hechos.size, unidad: 'hechos' }
  const pct = Math.round((avance.hechas / avance.total) * 1000) / 10

  /** Cómo se pinta cada manifold en el plano general. */
  const estadoManifold = (id: string): EstadoManifold | undefined => {
    if (hechos.has(id)) return { color: color + '6b', borde: colorBorde, visto: true }
    if (empezados.has(id)) return { color: 'rgba(217,119,6,.2)', borde: EMPEZADO }
    return undefined
  }

  const [generando, setGenerando] = useState(false)
  const hecho = actividad.retira ? 'Retirado' : 'Hecho'

  const exportarPDF = async () => {
    setGenerando(true)
    try {
      const esManifold = actividad.tipo === 'manifold'
      const doc = await generarPDFDiagrama({
        titulo: actividad.nombre,
        subtitulo: actividad.sinLado
          ? `Rack ${rack}`
          : `Rack ${rack} · ${LADOS.find((l) => l.codigo === lado)!.nombre}`,
        hoja: esManifold ? 'compacta' : 'ancha',
        vb: esManifold ? PLANO_MF : { ancho: ANCHO, alto: ALTO },
        diagrama: esManifold
          ? createElement(PlanoManifolds, { estado: estadoManifold, paraPdf: true })
          : createElement(PlanoRack, {
            modo: 'simple' as const, vista: 'todo' as const, espejo: lado === 'descarga',
            tapaRec: new Map(), porVasija: new Map(), hechos, colores: coloresMembranas,
            paraPdf: true,
          }),
        avance: { pct, detalle: `${avance.hechas} de ${avance.total} ${avance.unidad}`, color },
        leyenda: [
          { color, nombre: hecho, desc: actividad.retira ? 'Ya salió del rack' : 'Ya ejecutado', n: hechos.size },
          ...(actividad.partes || esMembranas
            ? [{
              color: esMembranas ? '#fcd34d' : EMPEZADO,
              nombre: 'Empezado',
              desc: esMembranas ? 'Con membranas puestas, pero incompleta' : 'Con piezas puestas, pero incompleto',
              n: empezados.size,
            }]
            : []),
          ...(aisladas.size && !esManifold
            ? [{ color: COLOR_AISLADA.color, nombre: 'Aislada', desc: 'No se interviene', n: aisladas.size }]
            : []),
          { color: '#ffffff', hueco: true, nombre: 'Pendiente', desc: 'Todavía no se hace', n: totalLado - hechos.size - empezados.size },
          { color: '#ffffff', hueco: true, nombre: 'TOTAL', desc: esManifold ? 'Manifolds del rack' : aisladas.size ? 'Vasijas a intervenir' : 'Vasijas del rack', n: totalLado },
        ],
        detalle: esManifold
          ? detallePiezas()
          : [
            { titulo: 'Vasijas pendientes', lineas: agruparPorFila(CELDAS.filter((c) => !hechos.has(c.id) && !aisladas.has(c.id)).map((c) => c.id)) },
            ...(aisladas.size ? [{ titulo: 'Vasijas aisladas (no se intervienen)', lineas: agruparPorFila([...aisladas]) }] : []),
          ],
        generadoPor: quienSoy(),
      })
      doc.save(nombreArchivo(actividad.nombre, `Rack${rack}`, actividad.sinLado ? '' : lado))
    } finally {
      setGenerando(false)
    }
  }

  /** Qué le falta a cada manifold, para la hoja 2. */
  function detallePiezas(): { titulo: string; lineas: string[] }[] {
    if (!actividad.partes) {
      return [{ titulo: 'Pendientes', lineas: MANIFOLDS.filter((m) => !hechos.has(m.id)).map((m) => m.id) }]
    }
    const lineas: string[] = []
    for (const m of MANIFOLDS) {
      if (hechos.has(m.id)) continue
      const datos = datosDe(m.id)
      const r = resumirManifold(m.id, actividad.partes, datos, aisladas)
      const faltan = actividad.partes
        .filter((p) => p !== 'manifold')
        .map((p) => {
          const propias = vasijasDeManifold(m.id).map((v) => v.vasija).filter((v) => !aisladas.has(v))
          const total = propias.length
          const puestas = propias.filter((v) => datos[p as 'stubend' | 'tubing']?.includes(v)).length
          return total - puestas > 0 ? `${total - puestas} ${NOMBRE_PARTE[p].toLowerCase()}` : ''
        })
        .filter(Boolean)
      if (actividad.partes.includes('manifold') && !datos.manifold) faltan.push('la barra')
      lineas.push(`${m.id}  ·  ${r.hechas}/${r.total}${faltan.length ? ` — faltan ${faltan.join(', ')}` : ''}`)
    }
    return [{ titulo: 'Manifolds pendientes', lineas }]
  }

  const guardar = async (item: string, hecho: boolean, datos: DatosManifold = {}) => {
    const yo = quienSoy()
    await db.items.put({
      id: itemId(actividad.id, lado, rack, item),
      actividad: actividad.id, lado, rack, item, hecho, datos,
      creadoPor: yo, createdAt: Date.now(), sincronizado: false,
    })
    await encolar('item_upsert', {
      actividad: actividad.id, lado, rack, item, hecho, datos, creado_por: yo,
    })
  }

  const toggle = (item: string) => guardar(item, !hechos.has(item))

  /**
   * Marca piezas de un manifold. Parte de lo que hay en la base y no de lo que
   * tiene en pantalla: si se tocan dos piezas seguidas, la segunda llegaría con
   * una copia vieja de `datos` y borraría la primera. La lectura y la escritura
   * van en la misma transacción para que dos toques no se pisen.
   * El manifold queda hecho cuando están todas sus piezas.
   */
  const marcarPiezas = async (item: string, cambio: (actual: DatosManifold) => DatosManifold) => {
    const yo = quienSoy()
    const id = itemId(actividad.id, lado, rack, item)
    const datos = await db.transaction('rw', db.items, async () => {
      const actual = ((await db.items.get(id))?.datos as DatosManifold | undefined) ?? {}
      const next = cambio(actual)
      await db.items.put({
        id, actividad: actividad.id, lado, rack, item, datos: next,
        hecho: resumirManifold(item, actividad.partes!, next, aisladas).completo,
        creadoPor: yo, createdAt: Date.now(), sincronizado: false,
      })
      return next
    })
    await encolar('item_upsert', {
      actividad: actividad.id, lado, rack, item, datos, creado_por: yo,
      hecho: resumirManifold(item, actividad.partes!, datos, aisladas).completo,
    })
  }

  /** Igual que `marcarPiezas`, pero para las 7 membranas de una vasija: lee lo
      guardado dentro de la transacción para que dos lecturas seguidas de la
      cámara no se pisen. La vasija queda hecha con las 7 puestas. */
  const marcarMembranas = async (vasija: string, cambio: (actual: DatosMembranas) => DatosMembranas) => {
    const yo = quienSoy()
    const id = itemId(actividad.id, lado, rack, vasija)
    const datos = await db.transaction('rw', db.items, async () => {
      const actual = ((await db.items.get(id))?.datos as DatosMembranas | undefined) ?? {}
      const next = cambio(actual)
      await db.items.put({
        id, actividad: actividad.id, lado, rack, item: vasija, datos: next,
        hecho: membranasCompleta(next),
        creadoPor: yo, createdAt: Date.now(), sincronizado: false,
      })
      return next
    })
    await encolar('item_upsert', {
      actividad: actividad.id, lado, rack, item: vasija, datos, creado_por: yo,
      hecho: membranasCompleta(datos),
    })
  }

  /** Planilla de trazabilidad: una fila por membrana. Va en CSV con `;` y BOM
      porque es lo que Excel abre de una en los computadores de la planta. */
  const exportarExcel = async () => {
    setGenerando(true)
    try {
      await bajarExcelMembranas(rack, rackDe(rack).planta, delLado.map((i) => ({
        vasija: i.item, datos: i.datos as DatosMembranas,
      })))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo armar el Excel.')
    } finally {
      setGenerando(false)
    }
  }

  /** Qué hace tocar una vasija del plano. */
  const tocarVasija = async (id: string) => {
    setAviso('')
    if (aislando) {
      const ya = aisladas.has(id)
      const puestas = membranasPuestas((delLado.find((i) => i.item === id)?.datos as DatosMembranas | undefined) ?? {})
      const pregunta = ya
        ? `¿La vasija ${id} deja de estar aislada? Vuelve a contar en el carguío y en lo que sigue.`
        : `¿Aislar la vasija ${id}? No se interviene desde el carguío en adelante.`
          + (puestas ? `\n\nTiene ${puestas} membrana${puestas === 1 ? '' : 's'} registrada${puestas === 1 ? '' : 's'}: quedan guardadas, pero no cuentan.` : '')
      if (confirm(pregunta)) await marcarAislada(rack, id, !ya)
      return
    }
    if (aisladas.has(id)) {
      setAviso(`La vasija ${id} está aislada: no se interviene.${esCarguio && puedeEditar ? ' Para quitarla, usa "Marcar aisladas".' : ''}`)
      return
    }
    if (esMembranas) abrirVasija(id)
    else if (puedeEditar) await toggle(id)
  }

  const marcarTodo = async (valor: boolean) => {
    if (actividad.tipo !== 'manifold') return
    for (const m of MANIFOLDS) {
      if (hechos.has(m.id) === valor && !empezados.has(m.id)) continue
      if (!actividad.partes) { await toggle(m.id); continue }
      const vasijas = valor ? vasijasDeManifold(m.id).map((v) => v.vasija).filter((v) => !aisladas.has(v)) : []
      await marcarPiezas(m.id, () => {
        const datos: DatosManifold = {}
        for (const parte of actividad.partes!) {
          if (parte === 'manifold') datos.manifold = valor
          else datos[parte] = vasijas
        }
        return datos
      })
    }
  }

  return (
    <div>
      <div className="plano-titulo">
        <b>{actividad.nombre.toUpperCase()}</b>
        <span>{actividad.sinLado ? `RACK ${rack}` : LADOS.find((l) => l.codigo === lado)!.nombre.toUpperCase()}</span>
      </div>

      {actividad.lados.length > 1 && !actividad.sinLado && (
        <div className="lado-seg">
          {actividad.lados.map((l) => (
            <button key={l} className={lado === l ? 'on' : ''} onClick={() => { setLado(l); setVista(ordenSemiRacks(l === 'descarga')[0]) }}>
              {LADOS.find((x) => x.codigo === l)!.corto}
              <small>{items.filter((i) => i.lado === l && i.hecho).length} hechos</small>
            </button>
          ))}
        </div>
      )}

      {actividad.pasos && (
        <p className="hint" style={{ margin: '0 0 10px' }}>
          Orden: {actividad.pasos.join(' → ')}
          {actividad.partes && ' · toca un manifold para marcar sus piezas'}
        </p>
      )}

      <div className="avance">
        <div className="avance-top">
          <b>{pct}%</b>
          <span>{avance.hechas} de {avance.total} {avance.unidad}</span>
          <button className="btn sm ghost" disabled={generando} onClick={() => void exportarPDF()}>
            {generando ? 'Generando…' : 'PDF'}
          </button>
          {esMembranas && (
            <button className="btn sm ghost" disabled={generando} onClick={() => void exportarExcel()}>Excel</button>
          )}
        </div>
        <div className="avance-bar">
          <span style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>

      {esCarguio && puedeEditar && (
        <div className="seg aislar-seg">
          <button className={!aislando ? 'on' : ''} onClick={() => { setAislando(false); setAviso('') }}>
            {esMembranas ? 'Cargar membranas' : 'Marcar cargadas'}
          </button>
          <button className={aislando ? 'on aislar' : ''} onClick={() => { setAislando(true); setAviso('') }}>
            Marcar aisladas{aisladas.size ? ` (${aisladas.size})` : ''}
          </button>
        </div>
      )}
      {aislando && (
        <p className="hint aviso-aislar">
          Toca las vasijas aisladas: quedan en azul y no se intervienen desde el
          carguío en adelante (tapas, pruebas, limpieza exterior y manifold).
          Otro toque la vuelve a habilitar.
        </p>
      )}
      {aviso && <p className="hint aviso-aislar">{aviso}</p>}

      {actividad.tipo === 'simple' ? (
        <>
          <div className="vista-seg">
            {/* en descarga el plano va espejado y el Semi Rack B queda a la
                izquierda: el selector se lee en ese mismo orden */}
            {ordenSemiRacks(lado === 'descarga').map((sr) => (
              <button key={sr} className={vista === sr ? 'on' : ''} onClick={() => setVista(sr)}>
                Semi Rack {sr}
              </button>
            ))}
            <button className={vista === 'todo' ? 'on' : ''} onClick={() => setVista('todo')}>Todo</button>
          </div>
          <div className="fugas-scroll">
            <PlanoRack
              modo="simple"
              vista={vista}
              espejo={lado === 'descarga'}
              tapaRec={new Map()}
              porVasija={new Map()}
              hechos={hechos}
              colores={coloresMembranas}
              // con membranas la vasija se abre siempre: en modo lectura sirve
              // para consultar qué series quedaron puestas
              onVasija={esMembranas || puedeEditar || aisladas.size ? (id) => void tocarVasija(id) : undefined}
            />
          </div>
        </>
      ) : (
        <div className="fugas-scroll">
          <PlanoManifolds
            estado={estadoManifold}
            onTocar={actividad.partes
              ? (id) => abrirManifold(id)
              : puedeEditar ? (id) => void toggle(id) : undefined}
          />
        </div>
      )}

      {vasijaAbierta && esMembranas && (
        <DetalleMembranas
          rack={rack}
          vasija={vasijaAbierta}
          datos={(delLado.find((i) => i.item === vasijaAbierta)?.datos as DatosMembranas | undefined) ?? {}}
          porVasija={membranasPorVasija}
          onMarcar={(cambio) => void marcarMembranas(vasijaAbierta, cambio)}
          onCerrar={cerrarVasija}
        />
      )}

      {abierto && actividad.partes && (
        <DetalleManifold
          modo={actividad.retira ? 'retirado' : 'hecho'}
          manifold={abierto}
          partes={actividad.partes}
          datos={datosDe(abierto)}
          aisladas={aisladas}
          onMarcar={(cambio) => void marcarPiezas(abierto, cambio)}
          onCerrar={cerrarManifold}
        />
      )}

      {actividad.tipo === 'manifold' && (
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          {puedeEditar && <>
            <button className="btn sm ghost" onClick={() => void marcarTodo(true)}>Marcar todos</button>
            <button className="btn sm ghost" onClick={() => void marcarTodo(false)}>Limpiar todos</button>
          </>}
        </div>
      )}

      <div className="leyenda abajo">
        <b className="leg-titulo">LEYENDA</b>
        <span className="leg-item">
          <span className="leg-dot" style={{ background: color }} /> {actividad.retira ? 'Retirado' : 'Hecho'}
          <em>{actividad.retira ? 'Ya salió del rack' : 'Ya ejecutado'}</em>
          <i>{hechos.size}</i>
        </span>
        {(actividad.partes || esMembranas) && (
          <span className="leg-item">
            <span className="leg-dot" style={{ background: esMembranas ? '#fcd34d' : EMPEZADO }} /> Empezado
            <em>{esMembranas ? 'Con membranas puestas, pero incompleta' : 'Con piezas puestas, pero incompleto'}</em>
            <i>{empezados.size}</i>
          </span>
        )}
        {(aisladas.size > 0 || esCarguio) && actividad.tipo !== 'manifold' && (
          <span className="leg-item">
            <span className="leg-dot" style={{ background: COLOR_AISLADA.color }} /> Aislada
            <em>No se interviene del carguío en adelante</em>
            <i>{aisladas.size}</i>
          </span>
        )}
        <span className="leg-item">
          <span className="leg-dot vacio" /> Pendiente
          <em>{actividad.nombre} pendiente</em>
          <i>{totalLado - hechos.size - empezados.size}</i>
        </span>
        <span className="leg-item total">
          <span className="leg-dot oculto" /> TOTAL
          <em>{actividad.tipo === 'manifold' ? 'Manifolds del rack' : aisladas.size ? 'Vasijas a intervenir' : 'Vasijas del rack'}</em>
          <i>{totalLado}</i>
        </span>
      </div>
    </div>
  )
}

