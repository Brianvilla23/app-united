// Los equipos del formato oficial de entrega de turno (PYC-EG-MEL-6001-01,
// hoja "Entrega de Turno", filas 97-119). Nombre, detalle, número interno y
// ubicación vienen del formato; lo que cambia cada turno es el estado, la
// observación y el horómetro, y eso lo pone el supervisor.
export interface EquipoFormato {
  nombre: string
  detalle: string
  interno: string
  ubicacion: string
}

export const EQUIPOS: EquipoFormato[] = [
  { nombre: 'Alza hombre', detalle: 'GS-3246 E-Drive', interno: 'C-6701', ubicacion: 'Instalaciones la negra' },
  { nombre: 'Camión pluma (12 toneladas)', detalle: 'C440', interno: 'VCLX-73', ubicacion: 'Instalaciones la negra' },
  { nombre: 'Camioneta', detalle: 'Hilux DCAB MT 4X4 2.4', interno: 'C-RF47', ubicacion: 'Coloso' },
  { nombre: 'Camioneta', detalle: 'Hilux DCAB MT 4X4 2.4', interno: 'C-RF48', ubicacion: 'Coloso' },
  { nombre: 'Compresor de aire', detalle: '375 CFM', interno: 'CO-0023', ubicacion: 'Instalaciones la negra' },
  { nombre: 'Excavadora (20 toneladas)', detalle: 'PC210LC 10M0', interno: 'C-YG19', ubicacion: 'Instalaciones la negra' },
  { nombre: 'Generador 80 KVA', detalle: 'J110K', interno: '9550', ubicacion: 'Instalaciones la negra' },
  { nombre: 'Generador 15 KVA', detalle: 'GSW15P', interno: 'SMR-02099', ubicacion: 'Instalaciones la negra' },
  { nombre: 'Grúa horquilla', detalle: 'CPCD50 CU9G', interno: 'C-PC48', ubicacion: 'Coloso' },
  { nombre: 'Máquina soldadora', detalle: 'Vantage 500', interno: '7037', ubicacion: 'Instalaciones la negra' },
  { nombre: 'Máquina soldadora', detalle: 'Vantage 500', interno: '7038', ubicacion: 'Instalaciones la negra' },
  { nombre: 'Máquina soldadora', detalle: 'Vantage 500', interno: 'MSA-026', ubicacion: 'Instalaciones la negra' },
  { nombre: 'Motobomba', detalle: '3 x 3” Diesel partida eléctrica', interno: '9CUG0034', ubicacion: 'Instalaciones la negra' },
  { nombre: 'Motobomba', detalle: '3 x 3” Diesel partida eléctrica', interno: 'BBJC0061', ubicacion: 'Coloso' },
  { nombre: 'Motobomba', detalle: '3 x 3” Diesel partida eléctrica', interno: 'BBJC0072', ubicacion: 'Coloso' },
  { nombre: 'Retroexcavadora', detalle: 'WD-932', interno: 'C-0979', ubicacion: 'Instalaciones la negra' },
  { nombre: 'Tablero eléctrico', detalle: '380/220V/32A/Trifásico', interno: 'TEC-027', ubicacion: 'Instalaciones la negra' },
  { nombre: 'Tablero eléctrico', detalle: '380/Trifásico', interno: 'TEC-051', ubicacion: 'Instalaciones la negra' },
  { nombre: 'Tablero eléctrico', detalle: '220 VOLTS/220 Trifásico', interno: 'TEC-021', ubicacion: 'Instalaciones la negra' },
  { nombre: 'Tablero eléctrico', detalle: '220 VOLTS/220 Trifásico', interno: 'TEC-022', ubicacion: 'Instalaciones la negra' },
  { nombre: 'Tablero eléctrico', detalle: '220V', interno: 'TEC-074', ubicacion: 'Instalaciones la negra' },
  { nombre: 'Tablero eléctrico', detalle: '220V', interno: 'TEC-075', ubicacion: 'Instalaciones la negra' },
  { nombre: 'Tablero eléctrico', detalle: '220V Monofásico', interno: 'TEC-079', ubicacion: 'Coloso' },
]

export const ESTADOS_EQUIPO = ['Operativo', 'En mantenimiento', 'Fuera de servicio', 'No aplica'] as const
export type EstadoEquipo = typeof ESTADOS_EQUIPO[number]

/** Los estados que usa el formato para las OT y las actividades. */
export const ESTADOS_OT = ['Realizado', 'En ejecución', 'No realizado'] as const
export type EstadoOT = typeof ESTADOS_OT[number]
