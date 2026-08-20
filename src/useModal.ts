// Un modal enganchado al botón de atrás del teléfono: abrirlo empuja una capa,
// y cerrarlo —con la ✕, tocando el fondo o con el gesto de atrás— pasa siempre
// por el historial. Así los tres caminos hacen lo mismo y no se desalinean.
import { useState } from 'react'
import { empujarCapa, volver } from './navegacion'

export function useModal<T>(): [T | null, (v: T) => void, () => void] {
  const [valor, setValor] = useState<T | null>(null)
  const abrir = (v: T) => {
    setValor(v)
    empujarCapa(() => setValor(null))
  }
  return [valor, abrir, volver]
}
