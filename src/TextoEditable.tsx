// Un texto que se corrige donde está (25-11, Brayan: las subtareas no se podían
// modificar). Se toca el texto o el lápiz, se escribe y se guarda con
// «Guardar» o Enter; «Cancelar» o Escape lo deja como estaba.
import { useState } from 'react'

export default function TextoEditable({
  texto, onGuardar, tachado = false,
}: {
  texto: string
  onGuardar: (nuevo: string) => Promise<void> | void
  tachado?: boolean
}) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(texto)
  const [guardando, setGuardando] = useState(false)

  const abrir = () => { setValor(texto); setEditando(true) }
  const guardar = async () => {
    const t = valor.trim()
    if (!t || t === texto) { setEditando(false); return }
    setGuardando(true)
    try { await onGuardar(t); setEditando(false) } finally { setGuardando(false) }
  }

  if (!editando) {
    return (
      <span className="texto-editable" onClick={abrir} title="Tocar para corregir el texto">
        <b style={tachado ? { textDecoration: 'line-through' } : undefined}>{texto}</b>
        <button className="texto-lapiz" aria-label="Corregir el texto" onClick={(e) => { e.stopPropagation(); abrir() }}>✎</button>
      </span>
    )
  }
  return (
    <span className="texto-editando" onClick={(e) => e.stopPropagation()}>
      <textarea
        autoFocus rows={2} value={valor}
        onChange={(e) => setValor(e.target.value)}
        onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void guardar() }
          if (e.key === 'Escape') setEditando(false)
        }}
      />
      <span className="row" style={{ gap: 6 }}>
        <button className="btn sm primary" disabled={guardando || !valor.trim()} onClick={() => void guardar()}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button className="btn sm ghost" onClick={() => setEditando(false)}>Cancelar</button>
      </span>
    </span>
  )
}
