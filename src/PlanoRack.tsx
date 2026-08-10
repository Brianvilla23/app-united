// El plano del rack. ESTE componente es la única fuente del dibujo:
// lo usa la app en pantalla y el PDF lo renderiza tal cual, así el papel
// sale exactamente igual que la pantalla y no se pueden desincronizar.
import {
  FILAS, CELL, MY, R, cx, cy, ALTO,
  runsPara, runsDibujo, celdasPara, semiRackEn, vistaDibujo,
  POSTE1_X, POSTE2_X, POSTE_W,
  enVista, viewBoxPara,
  MARCA, MARCA_BORDE, PLOMO, PLOMO_BORDE,
  type ComponenteFuga, type Vista,
} from './rackLayout'
import { defEstadoTapa, estadoTapaDe, type TapaEstado } from './types'

export const VERDE = '#0e9f6e'
export const AZUL = '#38bdf8'
export const GRIS = '#c3cad3'
export const GRIS_BORDE = '#9aa5b1'

// cople victaulic (banda con ranura). x = borde izquierdo, y = centro.
export function cpl(key: string, x: number, y: number, on: boolean) {
  return (
    <g key={key}>
      <rect x={x} y={y - 8} width={6} height={16} rx={2} fill={on ? MARCA : PLOMO} stroke={on ? MARCA_BORDE : PLOMO_BORDE} strokeWidth={0.9} />
      <line x1={x + 3} y1={y - 6} x2={x + 3} y2={y + 6} stroke={on ? MARCA_BORDE : PLOMO_BORDE} strokeWidth={0.7} />
    </g>
  )
}

// posición del cople victaulic de una vasija hacia un lado (N = derecha, S = izquierda)
function copleX(fila: string, col: number, lado: 'N' | 'S'): number {
  const run = runsPara(fila).find((r) => r.includes(col))!
  const i = run.indexOf(col)
  if (lado === 'N') {
    const next = run[i + 1]
    return next !== undefined ? (cx(col) + cx(next)) / 2 : cx(col) + R + 9
  }
  const prev = run[i - 1]
  return prev !== undefined ? (cx(col) + cx(prev)) / 2 : cx(col) - R - 9
}

export interface PlanoRackProps {
  modo: 'fugas' | 'tapas' | 'simple'
  vista: Vista
  espejo: boolean
  tapaRec: Map<string, TapaEstado>
  porVasija: Map<string, Set<ComponenteFuga>>
  onVasija?: (id: string) => void
  /** modo 'simple': ids ya marcados como hechos */
  hechos?: Set<string>
  /** true cuando se dibuja para el PDF: sin cursor ni handlers */
  paraPdf?: boolean
}

export default function PlanoRack({
  modo, vista, espejo, tapaRec, porVasija, onVasija, hechos, paraPdf = false,
}: PlanoRackProps) {
  const vb = viewBoxPara(vista, espejo)
  const vDib = vistaDibujo(vista, espejo)
  const celdasVista = celdasPara(espejo).filter((c) => enVista(vDib, c.col))

  return (
    <svg
      viewBox={`${vb.x} 0 ${vb.w} ${ALTO}`}
      xmlns="http://www.w3.org/2000/svg"
      style={paraPdf
        ? { display: 'block' }
        : { display: 'block', width: '100%', maxWidth: '100%', height: 'auto', margin: '0 auto' }}
    >
      {vDib !== 'B' && <text x={(cx(1) + cx(8)) / 2} y={30} textAnchor="middle" fontSize={13} fontWeight={800} fill="#0f172a">SEMI RACK {semiRackEn('izq', espejo)}</text>}
      {vDib !== 'A' && <text x={(cx(9) + cx(16)) / 2} y={30} textAnchor="middle" fontSize={13} fontWeight={800} fill="#0f172a">SEMI RACK {semiRackEn('der', espejo)}</text>}

      {/* barra inferior del bastidor */}
      <rect x={POSTE1_X - 30} y={MY + FILAS.length * CELL + 8} width={POSTE2_X - POSTE1_X + POSTE_W + 60} height={15} rx={7.5} fill={GRIS} stroke={GRIS_BORDE} strokeWidth={0.8} />

      {/* postes cilíndricos */}
      {[POSTE1_X, POSTE2_X].map((px) => (
        <g key={px}>
          <rect x={px} y={MY - 14} width={POSTE_W} height={FILAS.length * CELL + 30} fill={GRIS} stroke={GRIS_BORDE} strokeWidth={0.8} />
          <ellipse cx={px + POSTE_W / 2} cy={MY - 14} rx={POSTE_W / 2} ry={4.5} fill="#dde3ea" stroke={GRIS_BORDE} strokeWidth={0.8} />
        </g>
      ))}

      {/* letras de fila */}
      {FILAS.map((f, i) => (
        <text key={f} x={vb.letrasX} y={cy(i) + 4} fontSize={11} fontWeight={700} fill="#64748b">{f}</text>
      ))}

      {/* cañería + coples victaulic + SPOOL contra el manifold (nada cruza el poste) */}
      {FILAS.map((f, i) =>
        runsDibujo(f, espejo).filter((run) => enVista(vDib, run[0])).map((run) => {
          const y = cy(i)
          const first = run[0], last = run[run.length - 1]
          const manifoldDer = last === 4 || last === 12
          const posteX = first <= 8 ? POSTE1_X : POSTE2_X
          const x0 = manifoldDer ? cx(first) - R - 12 : posteX + POSTE_W
          const x1 = manifoldDer ? posteX : cx(last) + R + 12
          return (
            <g key={'run' + f + first}>
              <rect x={x0} y={y - 3.5} width={x1 - x0} height={7} rx={3.5} fill={AZUL} />
              {run.slice(0, -1).map((c, k) => cpl(`m${f}${c}`, (cx(c) + cx(run[k + 1])) / 2 - 3, y, false))}
              {cpl(`ext${f}${first}`, manifoldDer ? cx(first) - R - 12 : cx(last) + R + 6, y, false)}
              {manifoldDer
                ? [cpl(`spa${f}${first}`, cx(last) + R + 6, y, false), cpl(`spb${f}${first}`, posteX - 10, y, false)]
                : [cpl(`spa${f}${first}`, posteX + POSTE_W + 4, y, false), cpl(`spb${f}${first}`, cx(first) - R - 12, y, false)]}
            </g>
          )
        }),
      )}

      {/* vasijas */}
      {celdasVista.map((celda) => {
        const i = FILAS.indexOf(celda.fila as typeof FILAS[number])
        const x = cx(celda.col), y = cy(i)
        const set = porVasija.get(celda.id)
        const rec = tapaRec.get(celda.id)
        const simpleHecho = modo === 'simple' && hechos?.has(celda.id)
        const tc = modo === 'tapas' && rec ? defEstadoTapa(estadoTapaDe(rec))
          : simpleHecho ? { color: '#22c55e', texto: '#052e16' }
          : undefined
        return (
          <g
            key={celda.id}
            onClick={onVasija ? () => onVasija(celda.id) : undefined}
            style={paraPdf ? undefined : { cursor: 'pointer' }}
          >
            <circle cx={x} cy={y} r={R} fill={tc ? tc.color : '#fff'} stroke={VERDE} strokeWidth={4.2} />
            {modo === 'fugas' && set?.has('C') && <circle cx={x} cy={y} r={13} fill="none" stroke={MARCA} strokeWidth={4} />}
            {modo === 'fugas' && set?.has('T') && <circle cx={x} cy={y} r={9.5} fill={MARCA} stroke={MARCA_BORDE} strokeWidth={1} />}
            {/* En el PDF la etiqueta va más grande: el plano se imprime reducido
                y con 10.5 quedaba al límite de lo legible. */}
            <text x={x} y={y + 4.5} textAnchor="middle" fontSize={paraPdf ? 13.5 : 10.5} fontWeight={700} fill={tc ? tc.texto : '#0f172a'}>{celda.id}</text>
            {modo === 'fugas' && set?.has('UN') && cpl(`un${celda.id}`, copleX(celda.fila, celda.col, 'N') - 3, y, true)}
            {modo === 'fugas' && set?.has('US') && cpl(`us${celda.id}`, copleX(celda.fila, celda.col, 'S') - 3, y, true)}
            {modo === 'fugas' && set?.has('SN') && <circle cx={x + R} cy={y} r={4.6} fill={MARCA} stroke={MARCA_BORDE} strokeWidth={1} />}
            {modo === 'fugas' && set?.has('SS') && <circle cx={x - R} cy={y} r={4.6} fill={MARCA} stroke={MARCA_BORDE} strokeWidth={1} />}
          </g>
        )
      })}
    </svg>
  )
}
