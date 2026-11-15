// Catálogo del outage del Rack 4 de Planta 0 (Codeline 80E). Es distinto al de
// los racks EWS: mallas de protección (4 por lado), codo inox con un piedmont en
// cada extremo, tapa del plano Codeline con tapón al centro y, solo en descarga,
// una bajada PPR por vasija al manifold PPR de la fila. Sin venteos.
//
// Orden dado por Brayan (14-11-2026), con el carguío de membranas agregado entre
// la instalación de tapas de descarga y la de codos. Todo se guarda en
// `avance_item` (una fila por pieza y lado); las tapas también, para no mezclar
// este rack con la tabla de tapas de los EWS.
import type { Actividad } from './actividades'
import type { PiezaP0 } from './planoP0'

const AMBOS = ['alimentacion', 'descarga'] as Actividad['lados']

export const ACTIVIDADES_P0: Actividad[] = [
  { id: 'p0_retiro_mallas', nombre: 'Retiro de mallas de seguridad', tipo: 'malla', lados: AMBOS, retira: true,
    nota: '4 mallas por lado, una por bloque. Tapan las filas G y H.' },
  { id: 'p0_retiro_codos', nombre: 'Retiro de codos inox', tipo: 'simple', lados: AMBOS, retira: true,
    nota: 'Codo inox con su piedmont en cada extremo.' },
  { id: 'p0_retiro_ppr', nombre: 'Retiro de manifold PPR', tipo: 'simple', lados: ['descarga'], retira: true,
    nota: 'Una bajada PPR por vasija, solo en descarga.' },
  { id: 'p0_retiro_tapas_alim', nombre: 'Retiro de tapas · alimentación', tipo: 'tapa', lados: ['alimentacion'], retira: true,
    nota: 'Aquí se pueden marcar las vasijas aisladas: no se abren.' },
  { id: 'p0_retiro_tapas_desc', nombre: 'Retiro de tapas · descarga', tipo: 'tapa', lados: ['descarga'], retira: true,
    nota: 'Aquí se pueden marcar las vasijas aisladas: no se abren.' },
  { id: 'p0_retiro_membrana', nombre: 'Retiro de membrana', tipo: 'simple', lados: ['alimentacion'], sinLado: true, retira: true },
  { id: 'p0_limpieza', nombre: 'Limpieza de vasijas', tipo: 'simple', lados: ['alimentacion'], sinLado: true },
  { id: 'p0_instalacion_tapas_desc', nombre: 'Instalación de tapas · descarga', tipo: 'tapa', lados: ['descarga'] },
  { id: 'p0_carguio', nombre: 'Carguío de membrana', tipo: 'simple', lados: ['alimentacion'], sinLado: true,
    nota: 'Se marca la vasija cuando quedó cargada. También se pueden marcar aisladas.' },
  { id: 'p0_instalacion_codos', nombre: 'Instalación de codos inox', tipo: 'simple', lados: AMBOS },
  { id: 'p0_instalacion_tapas_alim', nombre: 'Instalación de tapas · alimentación', tipo: 'tapa', lados: ['alimentacion'] },
  { id: 'p0_instalacion_tapones', nombre: 'Instalación de tapones', tipo: 'simple', lados: ['alimentacion'], nota: 'Solo alimentación.' },
  { id: 'p0_prueba_baja', nombre: 'Prueba de baja', tipo: 'fugas', lados: AMBOS,
    nota: 'Fugas: tapón, tapa, codo inox o piedmont e interconector.' },
  { id: 'p0_instalacion_ppr', nombre: 'Instalación de manifold PPR', tipo: 'simple', lados: ['descarga'] },
  { id: 'p0_prueba_alta', nombre: 'Prueba de alta', tipo: 'fugas', lados: AMBOS, nota: 'Como la de baja, más la bajada PPR.' },
  { id: 'p0_instalacion_mallas', nombre: 'Instalación de mallas de seguridad', tipo: 'malla', lados: AMBOS },
]

// Las aisladas se pueden marcar desde el retiro de tapas (Brayan, 14-11-2026): una
// vasija aislada no se abre, así que desde ahí no se interviene y sale del total.
const DESDE = ACTIVIDADES_P0.findIndex((a) => a.id === 'p0_retiro_tapas_alim')

/** Desde el retiro de tapas en adelante las vasijas aisladas no se intervienen y salen del total. */
export function respetaAisladasP0(id: string): boolean {
  return ACTIVIDADES_P0.findIndex((a) => a.id === id) >= DESDE
}

/** Qué pieza se dibuja en el plano de esa actividad (null = la vasija como círculo). */
export function piezaDe(a: Actividad): PiezaP0 | null {
  if (a.tipo === 'tapa') return 'tapa'
  if (a.id.includes('codos')) return 'codo'
  if (a.id.includes('ppr')) return 'ppr'
  return null
}

/** Las 4 mallas de un lado, en el orden en que se ven desde ese lado. */
export const MALLAS_P0 = [
  { id: 'A1', nombre: 'A-1', cols: [1, 5] },
  { id: 'A2', nombre: 'A-2', cols: [6, 10] },
  { id: 'B1', nombre: 'B-1', cols: [11, 15] },
  { id: 'B2', nombre: 'B-2', cols: [16, 20] },
]

/** Dónde puede aparecer una fuga en las pruebas de este rack. */
export function componentesFugaP0(actividad: string, lado: 'alimentacion' | 'descarga'): string[] {
  const base = lado === 'alimentacion'
    ? ['Tapón', 'Tapa', 'Codo inox / piedmont', 'Interconector']
    : ['Tapa', 'Codo inox / piedmont', 'Interconector']
  if (actividad === 'p0_prueba_alta' && lado === 'descarga') base.push('Bajada PPR')
  return base
}
