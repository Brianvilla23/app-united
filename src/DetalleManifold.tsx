// Detalle de UN manifold: el recorte del plano de Planificación con sus piezas
// tocables encima. Se marca por separado el stub end y el tubing de cada vasija,
// más la barra del manifold; todo queda en `datos` del avance_item.
//
// Cada pieza sabe a qué vasija sirve, así que en terreno se marca "el tubing de
// la D14", no "el tercero de la izquierda".
//
// El BRAZO (la barra celeste que va al cuerpo central) no se marca: es otra
// pieza y en estas actividades no se registra. Queda dibujado, nada más.
import {
  NOMBRE_PARTE, resumirManifold, vasijaDeParte, vasijasDeManifold,
  type ParteManifold,
} from './actividades'
import { ARQUETIPOS, ARQUETIPO_DE, SPRITE, TILE, type ZonaParte } from './manifoldDetalle'
import type { DatosManifold } from './types'

// El mismo detalle sirve para tres cosas, y el color dice cuál: verde = la
// pieza quedó puesta, plomo = la pieza se retiró, amarillo = filtra (la regla
// de color del levantamiento). El relleno va translúcido a propósito: marcar
// una pieza NO puede taparla, si no se pierde de vista qué es.
const PALETA = {
  hecho: { fondo: 'rgba(34,197,94,.26)', borde: '#15803d' },
  // plomo para lo que se saca: verde diría "está puesto"
  retirado: { fondo: 'rgba(125,135,148,.4)', borde: '#5b6675' },
  fuga: { fondo: 'rgba(240,180,0,.35)', borde: '#8a6d03' },
}
export type ModoDetalle = keyof typeof PALETA

const CLASE_MARCA: Record<ModoDetalle, string> = {
  hecho: ' on', retirado: ' retirado', fuga: ' fuga',
}

const PENDIENTE_BORDE = 'rgba(100,116,139,.55)'
// Lo pendiente se rellena 'transparent' y NO 'none': con 'none' el interior de
// la figura no recibe el toque y la pieza sin marcar quedaba imposible de tocar.
const PENDIENTE = 'transparent'

// El dedo no cae sobre el dibujo exacto: el stub end mide 4 pt de ancho y el
// tubing menos de 5. Alrededor de cada uno hay papel de sobra (el brazo, que
// va entremedio, no se marca), así que el área de toque crece pareja y quedan
// bien separados entre sí.
const MARGEN_TOQUE = 3.6

function zonaTocable(z: ZonaParte): ZonaParte {
  return {
    ...z,
    x: z.x - MARGEN_TOQUE, y: z.y - MARGEN_TOQUE,
    w: z.w + 2 * MARGEN_TOQUE, h: z.h + 2 * MARGEN_TOQUE,
  }
}

export default function DetalleManifold({
  manifold, partes, datos, onMarcar, onCerrar, modo = 'hecho', encabezado,
}: {
  manifold: string
  partes: ParteManifold[]
  datos: DatosManifold
  /** Recibe cómo cambiar los datos, no los datos ya cambiados: si se marcan dos
      piezas seguidas, la segunda no puede partir de una copia vieja. */
  onMarcar: (cambio: (actual: DatosManifold) => DatosManifold) => void
  onCerrar: () => void
  /** 'hecho' = quedó puesta · 'retirado' = se sacó · 'fuga' = filtra. */
  modo?: ModoDetalle
  /** Texto extra del título, por ejemplo el rack en el levantamiento. */
  encabezado?: string
}) {
  const arq = ARQUETIPOS[ARQUETIPO_DE[manifold]]
  const vasijas = vasijasDeManifold(manifold)
  const resumen = resumirManifold(manifold, partes, datos)
  const porVasija = partes.filter((p): p is Exclude<ParteManifold, 'manifold'> => p !== 'manifold')
  const color = PALETA[modo]
  const esFuga = modo === 'fuga'
  const esRetiro = modo === 'retirado'

  const marcada = (parte: ParteManifold, vasija: string) =>
    parte === 'manifold' ? !!datos.manifold : !!datos[parte]?.includes(vasija)

  const toggle = (parte: ParteManifold, vasija = '') => {
    onMarcar((actual) => {
      if (parte === 'manifold') return { ...actual, manifold: !actual.manifold }
      const actuales = actual[parte] ?? []
      return {
        ...actual,
        [parte]: actuales.includes(vasija)
          ? actuales.filter((v) => v !== vasija)
          : [...actuales, vasija],
      }
    })
  }

  const marcarTodo = (valor: boolean) => {
    const ids = vasijas.map((v) => v.vasija)
    onMarcar((actual) => {
      const next: DatosManifold = { ...actual }
      for (const parte of partes) {
        if (parte === 'manifold') next.manifold = valor
        else next[parte] = valor ? ids : []
      }
      return next
    })
  }

  const zonas = (parte: Exclude<ParteManifold, 'manifold'>) =>
    arq[parte].map((z) => {
      const vasija = vasijaDeParte(manifold, z.brazo, z.fila)
      const on = marcada(parte, vasija)
      const t = zonaTocable(z)
      return (
        <g key={parte + z.fila + z.brazo} onClick={() => toggle(parte, vasija)} style={{ cursor: 'pointer' }}>
          {/* el recuadro calza justo con la pieza: marcarla no puede taparla */}
          <rect
            x={z.x - 0.6} y={z.y - 0.6} width={z.w + 1.2} height={z.h + 1.2} rx={1.2}
            fill={on ? color.fondo : PENDIENTE}
            stroke={on ? color.borde : PENDIENTE_BORDE}
            strokeWidth={on ? 1.3 : 0.5}
            strokeDasharray={on ? undefined : '1.4 1.4'}
          />
          {/* el área que recibe el dedo es más grande que la pieza */}
          <rect x={t.x} y={t.y} width={t.w} height={t.h} fill="transparent" />
        </g>
      )
    })

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <b>Manifold {manifold}{encabezado ? ` · ${encabezado}` : ''}</b>
          <button className="modal-x" onClick={onCerrar}>✕</button>
        </div>
        <p className="hint" style={{ margin: '0 0 8px' }}>
          {esFuga
            ? `${resumen.hechas} ${resumen.hechas === 1 ? 'pieza con fuga' : 'piezas con fuga'} · toca dónde filtra`
            : `${resumen.hechas} de ${resumen.total} piezas · toca la pieza en el plano o úsala de la lista`}
        </p>

        <div className="fugas-scroll">
          <svg viewBox={`0 0 ${TILE.w} ${TILE.h}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
            {/* la tira trae los 7 dibujos apilados: se corre para mostrar el que toca */}
            <image href={SPRITE} x={0} y={-arq.i * TILE.h} width={TILE.w} height={TILE.h * TILE.n} />
            {partes.includes('manifold') && (
              <g onClick={() => toggle('manifold')} style={{ cursor: 'pointer' }}>
                <rect
                  x={arq.barra[0] - 0.7} y={arq.barra[1] - 0.7}
                  width={arq.barra[2] + 1.4} height={arq.barra[3] + 1.4} rx={1.6}
                  fill={datos.manifold ? color.fondo : PENDIENTE}
                  stroke={datos.manifold ? color.borde : PENDIENTE_BORDE}
                  strokeWidth={datos.manifold ? 1.5 : 0.5}
                  strokeDasharray={datos.manifold ? undefined : '1.4 1.4'}
                />
              </g>
            )}
            {partes.includes('stubend') && zonas('stubend')}
            {partes.includes('brazo') && zonas('brazo')}
            {partes.includes('tubing') && zonas('tubing')}
          </svg>
        </div>

        <div className="piezas">
          {partes.includes('manifold') && (
            <div className="pieza-fila">
              <b>Barra</b>
              <button
                className={'pieza-chip' + (datos.manifold ? CLASE_MARCA[modo] : '')}
                onClick={() => toggle('manifold')}
              >
                {NOMBRE_PARTE.manifold}
              </button>
            </div>
          )}
          {vasijas.map((v) => (
            <div className="pieza-fila" key={v.vasija}>
              <b>{v.vasija}</b>
              {porVasija.map((parte) => (
                <button
                  key={parte}
                  className={'pieza-chip' + (marcada(parte, v.vasija) ? CLASE_MARCA[modo] : '')}
                  onClick={() => toggle(parte, v.vasija)}
                >
                  {NOMBRE_PARTE[parte]}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          {!esFuga && (
            <button className="btn sm" style={{ flex: 1 }} onClick={() => marcarTodo(true)}>
              {esRetiro ? 'Marcar el manifold retirado' : 'Marcar el manifold completo'}
            </button>
          )}
          <button className="btn sm ghost" style={esFuga ? { flex: 1 } : undefined} onClick={() => marcarTodo(false)}>
            {esFuga ? 'Sin fugas en este manifold' : 'Limpiar'}
          </button>
        </div>
      </div>
    </div>
  )
}
