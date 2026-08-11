// Diagrama genérico de una actividad del outage.
//  · tipo 'simple'   → el plano de 295 vasijas, sin componentes: se toca y queda hecho.
//  · tipo 'manifold' → los 40 manifolds (10 filas × 4).
// Ambos guardan en la misma tabla `items`, así que agregar una actividad nueva
// es elegir el tipo en el catálogo, no programar una pantalla.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { encolar } from './sync'
import { quienSoy } from './identidad'
import { itemId, LADOS, type DatosManifold, type LadoRack } from './types'
import {
  MANIFOLDS, PLANO_MF, piezasPorLado, resumirManifold, vasijasDeManifold,
  ZONAS_MANIFOLD, type Actividad,
} from './actividades'
import { TOTAL_VASIJAS, type Vista } from './rackLayout'
import PlanoRack from './PlanoRack'
import DetalleManifold from './DetalleManifold'

const HECHO = '#22c55e'
const EMPEZADO = '#d97706'
// Lo que se RETIRA no se pinta verde: verde dice "está puesto", y un manifold
// retirado justamente ya no está. Va en el plomo del bastidor, con su visto.
const RETIRADO = '#8e99a8'
const RETIRADO_BORDE = '#5b6675'

export default function PlanoActividad({ actividad }: { actividad: Actividad }) {
  const [lado, setLado] = useState<LadoRack>(actividad.lados[0])
  const [vista, setVista] = useState<Vista>('A')
  const [abierto, setAbierto] = useState<string | null>(null)
  const items = useLiveQuery(
    () => db.items.where('actividad').equals(actividad.id).toArray(),
    [actividad.id],
  ) ?? []

  const delLado = items.filter((i) => i.lado === lado)
  const hechos = new Set(delLado.filter((i) => i.hecho).map((i) => i.item))
  const datosDe = (item: string): DatosManifold =>
    (delLado.find((i) => i.item === item)?.datos as DatosManifold | undefined) ?? {}
  // manifolds empezados pero no terminados: se ven distinto en el plano general
  const empezados = new Set(
    actividad.partes
      ? delLado.filter((i) => !i.hecho && resumirManifold(i.item, actividad.partes!, i.datos as DatosManifold).hechas > 0)
        .map((i) => i.item)
      : [],
  )
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
    : { total: totalLado, hechas: hechos.size, unidad: 'hechos' }
  const pct = Math.round((avance.hechas / avance.total) * 1000) / 10

  const guardar = async (item: string, hecho: boolean, datos: DatosManifold = {}) => {
    const yo = quienSoy()
    await db.items.put({
      id: itemId(actividad.id, lado, item),
      actividad: actividad.id, lado, item, hecho, datos,
      creadoPor: yo, createdAt: Date.now(), sincronizado: false,
    })
    await encolar('item_upsert', {
      actividad: actividad.id, lado, item, hecho, datos, creado_por: yo,
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
    const id = itemId(actividad.id, lado, item)
    const datos = await db.transaction('rw', db.items, async () => {
      const actual = ((await db.items.get(id))?.datos as DatosManifold | undefined) ?? {}
      const next = cambio(actual)
      await db.items.put({
        id, actividad: actividad.id, lado, item, datos: next,
        hecho: resumirManifold(item, actividad.partes!, next).completo,
        creadoPor: yo, createdAt: Date.now(), sincronizado: false,
      })
      return next
    })
    await encolar('item_upsert', {
      actividad: actividad.id, lado, item, datos, creado_por: yo,
      hecho: resumirManifold(item, actividad.partes!, datos).completo,
    })
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
        <span>{actividad.sinLado ? 'RACK 12' : LADOS.find((l) => l.codigo === lado)!.nombre.toUpperCase()}</span>
      </div>

      {actividad.lados.length > 1 && !actividad.sinLado && (
        <div className="lado-seg">
          {actividad.lados.map((l) => (
            <button key={l} className={lado === l ? 'on' : ''} onClick={() => setLado(l)}>
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
        </div>
        <div className="avance-bar">
          <span style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>

      {actividad.tipo === 'simple' ? (
        <>
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
              hechos={hechos}
              onVasija={(id) => void toggle(id)}
            />
          </div>
        </>
      ) : (
        <Manifolds
          hechos={hechos}
          empezados={empezados}
          color={color}
          colorBorde={colorBorde}
          onTocar={(id) => (actividad.partes ? setAbierto(id) : void toggle(id))}
        />
      )}

      {abierto && actividad.partes && (
        <DetalleManifold
          modo={actividad.retira ? 'retirado' : 'hecho'}
          manifold={abierto}
          partes={actividad.partes}
          datos={datosDe(abierto)}
          onMarcar={(cambio) => void marcarPiezas(abierto, cambio)}
          onCerrar={() => setAbierto(null)}
        />
      )}

      {actividad.tipo === 'manifold' && (
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button className="btn sm ghost" onClick={() => void marcarTodo(true)}>Marcar todos</button>
          <button className="btn sm ghost" onClick={() => void marcarTodo(false)}>Limpiar todos</button>
        </div>
      )}

      <div className="leyenda abajo">
        <b className="leg-titulo">LEYENDA</b>
        <span className="leg-item">
          <span className="leg-dot" style={{ background: color }} /> {actividad.retira ? 'Retirado' : 'Hecho'}
          <em>{actividad.retira ? 'Ya salió del rack' : 'Ya ejecutado'}</em>
          <i>{hechos.size}</i>
        </span>
        {actividad.partes && (
          <span className="leg-item">
            <span className="leg-dot" style={{ background: EMPEZADO }} /> Empezado
            <em>Con piezas puestas, pero incompleto</em>
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

// --- manifolds: se usa EL PLANO REAL de Planificación ---
// El fondo es el PDF "Manifold pvc lado descarga enumerados" recortado y
// cuantizado a 16 colores (86 KB, sin pérdida visible porque son colores
// planos). Encima van las 40 zonas tocables. Así el diagrama de la app es
// idéntico al de planta, no una réplica dibujada a mano.
function Manifolds({
  hechos, empezados, color, colorBorde, onTocar,
}: {
  hechos: Set<string>; empezados: Set<string>
  color: string; colorBorde: string
  onTocar: (id: string) => void
}) {
  const { ancho, alto } = PLANO_MF
  return (
    <div className="fugas-scroll">
      <svg viewBox={`0 0 ${ancho} ${alto}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
        <image href="./manifold_descarga.png" x={0} y={0} width={ancho} height={alto} />
        {ZONAS_MANIFOLD.map((z) => {
          const on = hechos.has(z.id)
          const medio = !on && empezados.has(z.id)
          return (
            <g key={z.id} onClick={() => onTocar(z.id)} style={{ cursor: 'pointer' }}>
              <rect
                x={z.x} y={z.y} width={z.w} height={z.h} rx={5}
                fill={on ? color + '6b' : medio ? 'rgba(217,119,6,.2)' : 'transparent'}
                stroke={on ? colorBorde : medio ? EMPEZADO : 'rgba(120,130,145,.35)'}
                strokeWidth={on || medio ? 2.2 : 1}
                strokeDasharray={on ? undefined : '3 3'}
              />
              {/* el visto va AL MEDIO del manifold, que es donde se busca */}
              {on && (
                <path
                  d={`M ${z.x + z.w / 2 - 10} ${z.y + z.h / 2} l 7 8 l 15 -17`}
                  fill="none" stroke={colorBorde} strokeWidth={4.5}
                  strokeLinecap="round" strokeLinejoin="round"
                />
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
