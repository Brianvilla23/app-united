// Toda fecha/hora que se muestre va en horario de Santiago de Chile,
// sin importar la zona horaria que tenga configurada el celular o el PC.
const TZ = 'America/Santiago'
const LOCALE = 'es-CL'

/** 28-07-2026, 10:29 */
export function fechaHora(d: Date | number = Date.now()): string {
  return new Date(d).toLocaleString(LOCALE, {
    timeZone: TZ,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

/** 28-07-2026 */
export function fechaCorta(d: Date | number = Date.now()): string {
  return new Date(d).toLocaleDateString(LOCALE, {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

/** 28/07, 10:29 — para el historial, que es corto */
export function fechaHistorial(d: Date | number = Date.now()): string {
  return new Date(d).toLocaleString(LOCALE, {
    timeZone: TZ, day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

/** martes, 28 de julio */
export function fechaLarga(d: Date | number = Date.now()): string {
  return new Date(d).toLocaleDateString(LOCALE, {
    timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long',
  })
}
