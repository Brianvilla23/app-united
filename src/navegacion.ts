// El botón de atrás del teléfono, para toda la app.
//
// El problema que arregla: antes se guardaba UNA sola pantalla de retorno. Al
// entrar dos niveles (menú → outage → actividad) el segundo "atrás" volvía a la
// misma pantalla en la que ya estabas, y el tercero cerraba la app, porque las
// entradas del historial se acababan antes que las pantallas.
//
// Ahora cada pantalla y cada modal empuja UNA capa, y cada "atrás" cierra la de
// arriba. Los botones de cerrar de la app también pasan por acá (`volver()`),
// para que el gesto del teléfono y la ✕ hagan exactamente lo mismo y el
// historial no se desalinee.
const capas: (() => void)[] = []

/** Abre una pantalla o un modal: deja registrado cómo se cierra. */
export function empujarCapa(cerrar: () => void): void {
  capas.push(cerrar)
  window.history.pushState({ capas: capas.length }, '')
}

/** Cierra la capa de arriba. false = no quedaba ninguna (se sale de la app). */
export function cerrarCapaDeArriba(): boolean {
  const cerrar = capas.pop()
  if (!cerrar) return false
  cerrar()
  return true
}

/** Volver desde un botón de la app. Va por el historial a propósito. */
export function volver(): void {
  window.history.back()
}

export function cuantasCapas(): number {
  return capas.length
}
