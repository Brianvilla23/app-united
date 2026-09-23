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
import { usePuedeRegistrar, useRack } from './rackOutage'
import { useModal } from './useModal'
import DetalleMembranas from './DetalleMembranas'
import {
  MEMBRANAS_POR_VASIJA, completa as membranasCompleta, filasDe,
  puestas as membranasPuestas, type DatosMembranas,
} from './membranas'
import { fechaCorta } from './fecha'

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
  const items = useLiveQuery(
    () => db.items.where('[actividad+rack]').equals([actividad.id, rack]).toArray(),
    [actividad.id, rack],
  ) ?? []

  const delLado = items.filter((i) => i.lado === lado)
  const hechos = new Set(delLado.filter((i) => i.hecho).map((i) => i.item))
  const datosDe = (item: string): DatosManifold =>
    (delLado.find((i) => i.item === item)?.datos as DatosManifold | undefined) ?? {}
  // manifolds (o vasijas) empezados pero no terminados: se ven distinto
  const empezados = new Set(
    actividad.partes
      ? delLado.filter((i) => !i.hecho && resumirManifold(i.item, actividad.partes!, i.datos as DatosManifold).hechas > 0)
        .map((i) => i.item)
      : esMembranas
        ? delLado.filter((i) => {
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
    ? delLado.reduce((n, i) => n + membranasPuestas(i.datos as DatosMembranas), 0)
    : 0
  // la vasija empezada (1 a 6 membranas) se pinta ámbar; la completa, verde
  const coloresMembranas = esMembranas
    ? new Map([...empezados].map((v) => [v, { color: '#fcd34d', texto: '#422006' }]))
    : undefined
  const totalLado = actividad.tipo === 'manifold' ? MANIFOLDS.length : TOTAL_VASIJAS
  const color = actividad.retira ? RETIRADO : HECHO
  const colorBorde = actividad.retira ? RETIRADO_BORDE : '#15803d'
  // con piezas la barra cuenta piezas puestas; si no, ítems terminados
  const avance = actividad.partes
    ? {
      total: piezasPorLado(actividad.partes),
      hechas: delLado.reduce(
        (n, i) => n + resumirManifold(i.item, actividad.partes!, i.datos as DatosManifold).hechas, 0,
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
          { color: '#ffffff', hueco: true, nombre: 'Pendiente', desc: 'Todavía no se hace', n: totalLado - hechos.size - empezados.size },
          { color: '#ffffff', hueco: true, nombre: 'TOTAL', desc: esManifold ? 'Manifolds del rack' : 'Vasijas del rack', n: totalLado },
        ],
        detalle: esManifold
          ? detallePiezas()
          : [{ titulo: 'Vasijas pendientes', lineas: agruparPorFila(CELDAS.filter((c) => !hechos.has(c.id)).map((c) => c.id)) }],
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
      const r = resumirManifold(m.id, actividad.partes, datos)
      const faltan = actividad.partes
        .filter((p) => p !== 'manifold')
        .map((p) => {
          const total = vasijasDeManifold(m.id).length
          const puestas = (datos[p as 'stubend' | 'tubing']?.length) ?? 0
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
        hecho: resumirManifold(item, actividad.partes!, next).completo,
        creadoPor: yo, createdAt: Date.now(), sincronizado: false,
      })
      return next
    })
    await encolar('item_upsert', {
      actividad: actividad.id, lado, rack, item, datos, creado_por: yo,
      hecho: resumirManifold(item, actividad.partes!, datos).completo,
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
  const exportarCSV = () => {
    const orden = new Map(CELDAS.map((c, i) => [c.id, i]))
    const filas = delLado
      .flatMap((i) => filasDe(rack, i.item, i.datos as DatosMembranas, (ts) => (ts ? fechaCorta(ts) : '')))
      .sort((a, b) => (orden.get(a.vasija) ?? 0) - (orden.get(b.vasija) ?? 0) || b.posicion - a.posicion)
    const cab = ['RACK', 'VASIJA', 'POSICION', 'TIPO', 'MARCA', 'MODELO', 'SERIE', 'METODO', 'REGISTRO', 'FECHA']
    const texto = [
      cab.join(';'),
      ...filas.map((f) => [
        f.rack, f.vasija, f.posicion, f.tipo, f.marca, f.modelo, f.serie, f.metodo, f.quien, f.fecha,
      ].join(';')),
    ].join('\r\n')
    const url = URL.createObjectURL(new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `Membranas_Rack${rack}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const marcarTodo = async (valor: boolean) => {
    if (actividad.tipo !== 'manifold') return
    for (const m of MANIFOLDS) {
      if (hechos.has(m.id) === valor && !empezados.has(m.id)) continue
      if (!actividad.partes) { await toggle(m.id); continue }
      const vasijas = valor ? vasijasDeManifold(m.id).map((v) => v.vasija) : []
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
            <button className="btn sm ghost" onClick={exportarCSV}>Planilla</button>
          )}
        </div>
        <div className="avance-bar">
          <span style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>

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
              onVasija={esMembranas
                ? (id) => abrirVasija(id)
                : puedeEditar ? (id) => void toggle(id) : undefined}
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
        <span className="leg-item">
          <span className="leg-dot vacio" /> Pendiente
          <em>{actividad.nombre} pendiente</em>
          <i>{totalLado - hechos.size - empezados.size}</i>
        </span>
        <span className="leg-item total">
          <span className="leg-dot oculto" /> TOTAL
          <em>{actividad.tipo === 'manifold' ? 'Manifolds del rack' : 'Vasijas del rack'}</em>
          <i>{totalLado}</i>
        </span>
      </div>
    </div>
  )
}

