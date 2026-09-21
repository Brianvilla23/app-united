// Catálogo del Outage del Rack 3 (EWS Planta 1) — solo el CAMBIO DE MEMBRANA.
//
// Fuente: `OCDN2502_Rack_03_P1_-_EWS_-_Carta_Gantt.pdf` (emitida el 18-09-2026),
// paquete de trabajo «36M Mec Camb Membrana Hydranaut Rack 3» (fila 43 de la
// Gantt): arranca el 22-09 a las 10:30 y cierra el 03-10 a las 06:21 con
// «Desbloqueo y 2da prueba controlada en alta presion, Entrega de Rack a
// operaciones» (fila 496). El orden de este array es el orden de inicio real
// de la Gantt, y cada actividad lleva su fila de origen en el comentario.
//
// QUÉ NO ESTÁ ACÁ, a propósito:
//  · Los preparativos (filas 3-37: segregación, traslado de membranas,
//    capacitación, tierras eléctricas) y el Rump Down con su drenaje y bloqueo
//    (filas 38-41) — son previos al cambio de membrana y ya estaban corriendo.
//  · El cambio de válvulas de venteo (fila 548, «36M Mec Rest Valv Venteo
//    Rack 3») — es otro paquete de trabajo, no el del cambio de membrana.
//  · El RUN UP de planta (filas 658-661) y el Post Outage (fila 662), que son
//    posteriores a la entrega del rack a operaciones.
//
// El Rack 3 es EWS igual que el 12: mismas 295 vasijas (filas A-S, columnas
// 1-16) y mismos 40 manifolds de PVC de permeado, así que reusa tal cual
// `rackLayout.ts` y `manifoldDetalle.ts`. La Gantt lo confirma en el nombre de
// cada tarea de manifold: «Retiro Manifold PVC Permeado Fila K Semirack B
// Vasijas K16-K15-K14-K13 / K12-K11-K10-K9».
import type { Actividad } from './actividades'

/** Niveles de andamio del pasillo seguro, como los enumera la Gantt. */
const NIVELES = ['1er nivel', '2do nivel', '3er nivel', '4to nivel']

export const ACTIVIDADES_RACK3: Actividad[] = [
  {
    // Gantt 44-45
    id: 'r3_verificacion_bloqueo',
    nombre: 'Verificación de puntos de bloqueo',
    tipo: 'pasos',
    lados: ['alimentacion'],
    sinLado: true,
    ventana: '22/09 10:30 → 11:00',
    checklist: ['Verificación de puntos de bloqueo de energía'],
    nota: 'Primera actividad del cambio de membrana, con el rack ya drenado y bloqueado.',
  },
  {
    // Gantt 46-50
    id: 'r3_retiro_pantalla_desc',
    nombre: 'Retiro de pantallas de protección · pasillo seguro descarga',
    tipo: 'pasos',
    lados: ['descarga'],
    ventana: '22/09 11:00 → 19:30',
    checklist: NIVELES.map((n) => `Retiro ${n} de andamios`),
  },
  {
    // Gantt 371-373. Logística: corre en paralelo, no frena la secuencia.
    id: 'r3_recepcion_membranas',
    nombre: 'Recepción y disposición de membranas',
    tipo: 'pasos',
    lados: ['alimentacion'],
    sinLado: true,
    libre: true,
    ventana: '22/09 20:30 → 23/09 00:30',
    checklist: ['Recepción y disposición de membranas', 'Organización UP membranas'],
  },
  {
    // Gantt 374-375
    id: 'r3_recepcion_manifold',
    nombre: 'Recepción de material de manifold',
    tipo: 'pasos',
    lados: ['descarga'],
    libre: true,
    ventana: '22/09 20:30 → 21:30',
    checklist: ['Recepción de material para reparación de filtraciones'],
  },
  {
    // Gantt 51-56
    id: 'r3_retiro_pantalla_alim',
    nombre: 'Retiro de pantallas de protección · pasillo seguro alimentación',
    tipo: 'pasos',
    lados: ['alimentacion'],
    ventana: '22/09 20:30 → 23/09 05:00',
    checklist: [
      ...NIVELES.map((n) => `Retiro ${n} de andamios`),
      'Traslado y acopio de elementos',
    ],
  },
  {
    // Gantt 57-69: 5 niveles por lado, con malla de protección.
    id: 'r3_normalizacion_andamios',
    nombre: 'Armado y normalización de andamios',
    tipo: 'pasos',
    lados: ['alimentacion', 'descarga'],
    ventana: '23/09 05:00 → 15:00',
    checklist: [
      ...NIVELES, '5to nivel',
    ].map((n) => `Instalación de mallas de protección · ${n}`),
  },
  {
    // Gantt 70-112. Igual que en el Rack 12: sale el manifold entero y el
    // tubing se cambia, así que lo que se registra es que ningún stub end
    // se quedó atrás.
    id: 'r3_retiro_manifold',
    nombre: 'Retiro de manifold',
    tipo: 'manifold',
    lados: ['descarga'],
    partes: ['stubend'],
    retira: true,
    ventana: '23/09 15:00 → 24/09 15:12',
    nota: 'Se marca el stub end de cada vasija: el manifold queda retirado cuando están todos.',
  },
  {
    // Gantt 113-155
    id: 'r3_retiro_tapas_alim',
    nombre: 'Retiro de tapas · alimentación',
    tipo: 'tapa',
    lados: ['alimentacion'],
    ventana: '23/09 15:42 → 24/09 03:42',
  },
  {
    // Gantt 156-198
    id: 'r3_retiro_tapas_desc',
    nombre: 'Retiro de tapas · descarga',
    tipo: 'tapa',
    lados: ['descarga'],
    ventana: '24/09 15:12 → 25/09 03:12',
    nota: 'Va después de retirar el manifold.',
  },
  {
    // Gantt 199-241
    id: 'r3_retiro_membrana',
    nombre: 'Retiro de membranas',
    tipo: 'simple',
    lados: ['alimentacion'],
    sinLado: true,
    ventana: '25/09 03:27 → 27/09 03:33',
  },
  {
    // Gantt 242-246
    id: 'r3_reparacion_sideport',
    nombre: 'Reparación de filtraciones de sideport',
    tipo: 'pasos',
    lados: ['descarga', 'alimentacion'],
    ventana: '27/09 03:33 → 19:33',
    checklist: ['Reparación de filtraciones de sideport'],
  },
  {
    // Gantt 247-289: la Gantt lo detalla fila por fila (K1 a K16, L1 a L16…)
    // en los dos lados, así que va sobre el plano de 295.
    id: 'r3_ovalamiento',
    nombre: 'Alineamiento y control de ovalamiento de puertos laterales',
    tipo: 'simple',
    lados: ['descarga', 'alimentacion'],
    ventana: '27/09 19:33 → 28/09 03:33',
  },
  {
    // Gantt 290-370, parte «Limp Int Vasija …». La Gantt junta la limpieza
    // interior y el montaje de tapas en un solo bloque; acá van separadas
    // porque son dos registros distintos por vasija.
    id: 'r3_limpieza_interior_desc',
    nombre: 'Limpieza de vasijas interior · descarga',
    tipo: 'simple',
    lados: ['descarga'],
    ventana: '28/09 03:33 → 16:21',
  },
  {
    // Gantt 290-370, parte «Montaje Tapas Lado Desc. …»
    id: 'r3_instalacion_tapas_desc',
    nombre: 'Instalación de tapas · descarga',
    tipo: 'tapa',
    lados: ['descarga'],
    ventana: '28/09 03:33 → 16:21',
  },
  {
    // Gantt 376-415: 7 membranas por vasija, más el control de montaje.
    id: 'r3_carguio_membrana',
    nombre: 'Montaje de membranas',
    tipo: 'simple',
    lados: ['alimentacion'],
    sinLado: true,
    ventana: '28/09 16:21 → 30/09 16:21',
    nota: '7 membranas por vasija.',
  },
  {
    // Gantt 416-432: tapas, canastillos y tapones, más el control de calidad.
    id: 'r3_instalacion_tapas_alim',
    nombre: 'Montaje de tapas, tapones y canastillos · alimentación',
    tipo: 'tapa',
    lados: ['alimentacion'],
    pasos: ['Graduación de shim (mm)', 'Instalación de tapa'],
    ventana: '30/09 08:21 → 01/10 00:21',
    nota: 'Lleva tapón al centro y se anota el shim en milímetros.',
  },
  {
    // Gantt 433-436
    id: 'r3_prueba_baja',
    nombre: 'Prueba de baja presión',
    tipo: 'fugas',
    lados: ['alimentacion', 'descarga'],
    ventana: '01/10 00:21 → 13:21',
    nota: 'Fugas: tapón, tapa, interconector de membrana y venteo.',
  },
  {
    // Gantt 437-442
    id: 'r3_limpieza_exterior',
    nombre: 'Limpieza exterior de vasijas',
    tipo: 'simple',
    lados: ['descarga', 'alimentacion'],
    ventana: '01/10 13:21 → 02/10 01:21',
  },
  {
    // Gantt 443-444
    id: 'r3_preparacion_manifold',
    nombre: 'Preparación de manifold',
    tipo: 'pasos',
    lados: ['descarga'],
    libre: true,
    ventana: '01/10 15:21 → 02/10 01:21',
    checklist: ['Preparación de manifold'],
  },
  {
    // Gantt 445-484
    id: 'r3_instalacion_manifold',
    nombre: 'Instalación de manifold',
    tipo: 'manifold',
    lados: ['descarga'],
    pasos: ['Stub end', 'Manifold completo', 'Tubing en cada brazo'],
    partes: ['stubend', 'manifold', 'tubing'],
    ventana: '02/10 01:21 → 19:21',
    nota: 'En ese orden. El tubing es la manguerita del extremo del brazo.',
  },
  {
    // Gantt 485-487
    id: 'r3_prueba_marcha',
    nombre: 'Prueba de marcha',
    tipo: 'pasos',
    lados: ['alimentacion'],
    sinLado: true,
    ventana: '02/10 19:21 → 22:21',
    checklist: [
      'Desbloqueo y prueba controlada en alta presión (evaluación de filtraciones)',
      'Bloqueo y drenaje para reparación de filtraciones y anomalías',
    ],
  },
  {
    // Gantt 489-492
    id: 'r3_reparacion_final_desc',
    nombre: 'Reparación de filtraciones y anomalías · descarga',
    tipo: 'pasos',
    lados: ['descarga'],
    ventana: '02/10 22:21 → 03/10 01:21',
    checklist: [
      'Reparación de filtraciones de manifold',
      'Reparación de filtraciones de tapas, canastillo y tapones',
      'Reparación de filtraciones de sideport',
    ],
  },
  {
    // Gantt 493-495
    id: 'r3_reparacion_final_alim',
    nombre: 'Reparación de filtraciones y anomalías · alimentación',
    tipo: 'pasos',
    lados: ['alimentacion'],
    ventana: '03/10 01:21 → 03:21',
    checklist: [
      'Reparación de filtraciones de tapas, canastillo y tapones',
      'Reparación de filtraciones de sideport',
    ],
  },
  {
    // Gantt 496: cierre del paquete de cambio de membrana.
    id: 'r3_desbloqueo_entrega',
    nombre: 'Desbloqueo y entrega del rack a operaciones',
    tipo: 'pasos',
    lados: ['alimentacion'],
    sinLado: true,
    ventana: '03/10 03:21 → 06:21',
    checklist: [
      'Desbloqueo del rack',
      '2da prueba controlada en alta presión',
      'Entrega del rack a operaciones',
    ],
    nota: 'Última actividad del cambio de membrana.',
  },
]
