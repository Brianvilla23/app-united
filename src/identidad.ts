// Quién está usando la app en este celular.
// Se pregunta una vez y queda guardado; se puede cambiar desde la barra superior.
const CLAVE = 'united_quien_soy'

export function quienSoy(): string {
  return (localStorage.getItem(CLAVE) ?? '').trim()
}

export function guardarQuienSoy(nombre: string): void {
  const n = nombre.trim()
  if (n) localStorage.setItem(CLAVE, n)
}

export function olvidarQuienSoy(): void {
  localStorage.removeItem(CLAVE)
}
