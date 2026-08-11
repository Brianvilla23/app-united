// El plano de los 40 manifolds. ESTE componente es la única fuente del dibujo:
// lo usan la pantalla de avance del outage, la de fugas y el PDF, que lo
// renderiza tal cual. Igual que PlanoRack con las vasijas, así el papel no se
// puede desincronizar de la pantalla.
//
// El fondo ES el plano de Planificación recortado (`manifold_descarga.png`);
// encima van las 40 zonas, y cada pantalla decide de qué color va cada una.
import { PLANO_MF, ZONAS_MANIFOLD } from './actividades'

export interface EstadoManifold {
  /** Relleno translúcido de la zona. Sin color, la zona va vacía. */
  color?: string
  borde?: string
  /** Visto al medio: la actividad terminó en ese manifold. */
  visto?: boolean
  /** Número al costado: cuántas piezas (por ejemplo, cuántas filtran). */
  numero?: number
}

export default function PlanoManifolds({
  estado, onTocar, paraPdf = false,
}: {
  estado: (id: string) => EstadoManifold | undefined
  onTocar?: (id: string) => void
  /** true = se dibuja para el PDF: sin cursor ni handlers. */
  paraPdf?: boolean
}) {
  const { ancho, alto } = PLANO_MF
  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      xmlns="http://www.w3.org/2000/svg"
      style={paraPdf ? { display: 'block' } : { display: 'block', width: '100%', height: 'auto' }}
    >
      <image href="./manifold_descarga.png" x={0} y={0} width={ancho} height={alto} />
      {ZONAS_MANIFOLD.map((z) => {
        const e = estado(z.id)
        const marcado = !!e?.color
        return (
          <g
            key={z.id}
            onClick={onTocar ? () => onTocar(z.id) : undefined}
            style={paraPdf ? undefined : { cursor: 'pointer' }}
          >
            <rect
              x={z.x} y={z.y} width={z.w} height={z.h} rx={5}
              fill={e?.color ?? 'transparent'}
              stroke={marcado ? (e?.borde ?? '#15803d') : 'rgba(120,130,145,.35)'}
              strokeWidth={marcado ? 2.2 : 1}
              strokeDasharray={marcado ? undefined : '3 3'}
            />
            {/* el visto va AL MEDIO del manifold, que es donde se busca */}
            {e?.visto && (
              <path
                d={`M ${z.x + z.w / 2 - 10} ${z.y + z.h / 2} l 7 8 l 15 -17`}
                fill="none" stroke={e.borde ?? '#15803d'} strokeWidth={4.5}
                strokeLinecap="round" strokeLinejoin="round"
              />
            )}
            {e?.numero !== undefined && e.numero > 0 && (
              <text
                x={z.x + z.w - 14} y={z.y + z.h / 2 + 5} textAnchor="middle"
                fontSize={15} fontWeight={800} fill={e.borde ?? '#8a6d03'}
              >{e.numero}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
