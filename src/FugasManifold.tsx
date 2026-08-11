// Manifold dentro del levantamiento de fuga: el mismo plano de los 40, pero
// marcando dónde FILTRA en vez de qué se avanzó.
//
// Va por rack (R1-R12) igual que el resto del levantamiento. Como `avance_item`
// no tiene columna de rack —todo lo demás que guarda es del Rack 12— el rack va
// dentro del `item` (`itemFugaManifold`).
//
// Acá el brazo SÍ se marca: en el outage no se registra, pero filtrar puede.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { encolar } from './sync'
import { quienSoy } from './identidad'
import { itemId, type DatosManifold } from './types'
import {
  FUGA_MANIFOLD, MANIFOLDS, PARTES_FUGA, PLANO_MF, ZONAS_MANIFOLD,
  itemFugaManifold, resumirManifold,
} from './actividades'
import { MARCA, MARCA_BORDE } from './rackLayout'
import DetalleManifold from './DetalleManifold'

const LADO = 'descarga' as const   // los manifolds solo existen en descarga

export default function FugasManifold({ rack }: { rack: number }) {
  const [abierto, setAbierto] = useState<string | null>(null)
  const items = useLiveQuery(
    () => db.items.where('actividad').equals(FUGA_MANIFOLD).toArray(), [],
  ) ?? []

  const datosDe = (mid: string): DatosManifold =>
    (items.find((i) => i.item === itemFugaManifold(rack, mid))?.datos as DatosManifold | undefined) ?? {}

  const fugasDe = (mid: string) => resumirManifold(mid, PARTES_FUGA, datosDe(mid)).hechas
  const conFuga = MANIFOLDS.filter((m) => fugasDe(m.id) > 0)
  const piezas = conFuga.reduce((n, m) => n + fugasDe(m.id), 0)

  /** Lee de la base dentro de la transacción: dos marcas seguidas no se pisan. */
  const marcar = async (mid: string, cambio: (actual: DatosManifold) => DatosManifold) => {
    const yo = quienSoy()
    const item = itemFugaManifold(rack, mid)
    const id = itemId(FUGA_MANIFOLD, LADO, item)
    const datos = await db.transaction('rw', db.items, async () => {
      const actual = ((await db.items.get(id))?.datos as DatosManifold | undefined) ?? {}
      const next = cambio(actual)
      await db.items.put({
        id, actividad: FUGA_MANIFOLD, lado: LADO, item, datos: next,
        hecho: resumirManifold(mid, PARTES_FUGA, next).hechas > 0,
        creadoPor: yo, createdAt: Date.now(), sincronizado: false,
      })
      return next
    })
    await encolar('item_upsert', {
      actividad: FUGA_MANIFOLD, lado: LADO, item, datos, creado_por: yo,
      hecho: resumirManifold(mid, PARTES_FUGA, datos).hechas > 0,
    })
  }

  const { ancho, alto } = PLANO_MF

  return (
    <div>
      <div className="plano-titulo">
        <b>MANIFOLD · RACK {rack}</b>
        <span>LADO DESCARGA</span>
      </div>

      <p className="hint" style={{ margin: '0 0 10px' }}>
        Toca un manifold y marca dónde filtra: barra, stub end, brazo o tubing.
      </p>

      <div className="avance">
        <div className="avance-top">
          <b>{conFuga.length}</b>
          <span>
            {conFuga.length === 1 ? 'manifold con fuga' : 'manifolds con fuga'} ·
            {' '}{piezas} {piezas === 1 ? 'pieza' : 'piezas'}
          </span>
        </div>
      </div>

      <div className="fugas-scroll">
        <svg viewBox={`0 0 ${ancho} ${alto}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
          <image href="./manifold_descarga.png" x={0} y={0} width={ancho} height={alto} />
          {ZONAS_MANIFOLD.map((z) => {
            const n = fugasDe(z.id)
            return (
              <g key={z.id} onClick={() => setAbierto(z.id)} style={{ cursor: 'pointer' }}>
                <rect
                  x={z.x} y={z.y} width={z.w} height={z.h} rx={5}
                  fill={n > 0 ? 'rgba(240,180,0,.4)' : 'transparent'}
                  stroke={n > 0 ? MARCA_BORDE : 'rgba(120,130,145,.35)'}
                  strokeWidth={n > 0 ? 2.2 : 1}
                  strokeDasharray={n > 0 ? undefined : '3 3'}
                />
                {n > 0 && (
                  <text
                    x={z.x + z.w - 14} y={z.y + z.h / 2 + 5} textAnchor="middle"
                    fontSize={15} fontWeight={800} fill={MARCA_BORDE}
                  >{n}</text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="leyenda abajo">
        <b className="leg-titulo">LEYENDA</b>
        <span className="leg-item">
          <span className="leg-dot" style={{ background: MARCA }} /> Con fuga
          <em>El número dice cuántas piezas filtran</em>
          <i>{conFuga.length}</i>
        </span>
        <span className="leg-item">
          <span className="leg-dot vacio" /> Sin fuga registrada
          <em>Todavía no se marca nada</em>
          <i>{MANIFOLDS.length - conFuga.length}</i>
        </span>
        <span className="leg-item total">
          <span className="leg-dot oculto" /> TOTAL
          <em>Manifolds del rack</em>
          <i>{MANIFOLDS.length}</i>
        </span>
      </div>

      {abierto && (
        <DetalleManifold
          modo="fuga"
          encabezado={`Rack ${rack}`}
          manifold={abierto}
          partes={PARTES_FUGA}
          datos={datosDe(abierto)}
          onMarcar={(cambio) => void marcar(abierto, cambio)}
          onCerrar={() => setAbierto(null)}
        />
      )}
    </div>
  )
}
