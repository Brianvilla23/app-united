// Comentario libre por rack: lo que el supervisor encuentre y no entre en
// ninguna casilla del diagrama (una anomalía, algo raro, un pendiente).
//
// Se guarda en `avance_item` y no en una tabla nueva a propósito: una tabla que
// falte en Supabase hace fallar la subida, y la cola se sube en orden y se
// detiene al primer error — un ítem que nunca sube deja trancados también los
// avisos y las tapas.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { encolar } from './sync'
import { quienSoy } from './identidad'
import { itemId, type LadoRack } from './types'
import { fechaCorta } from './fecha'

export const COMENTARIO_RACK = 'comentario_rack'
// El comentario es del rack completo: el lado no aplica, pero es parte de la
// llave de avance_item, así que va fijo.
const LADO: LadoRack = 'alimentacion'

// `type` y no `interface` para que entre en el `datos: Record<string, unknown>`
type DatosComentario = { texto?: string; quien?: string; fecha?: number }

/** El comentario del rack, para mostrarlo y para meterlo en los PDF. */
export function useComentarioRack(rack: number): DatosComentario {
  const g = useLiveQuery(() => db.items.get(itemId(COMENTARIO_RACK, LADO, String(rack))), [rack])
  return (g?.datos as DatosComentario | undefined) ?? {}
}

export default function ComentarioRack({ rack }: { rack: number }) {
  const id = itemId(COMENTARIO_RACK, LADO, String(rack))
  const guardado = useLiveQuery(() => db.items.get(id), [id])
  const datos = (guardado?.datos as DatosComentario | undefined) ?? {}

  const [texto, setTexto] = useState('')
  const [editando, setEditando] = useState(false)
  // al cambiar de rack (o al llegar lo que bajó de la nube) se recarga el texto,
  // salvo que se esté escribiendo: si no, borraría lo que va tecleando
  useEffect(() => { if (!editando) setTexto(datos.texto ?? '') }, [datos.texto, editando])

  const sucio = editando && texto !== (datos.texto ?? '')

  const guardar = async () => {
    const yo = quienSoy()
    const limpio = texto.trim()
    const nuevos: DatosComentario = { texto: limpio, quien: yo, fecha: Date.now() }
    await db.items.put({
      id, actividad: COMENTARIO_RACK, lado: LADO, item: String(rack),
      hecho: limpio.length > 0, datos: nuevos,
      creadoPor: yo, createdAt: Date.now(), sincronizado: false,
    })
    await encolar('item_upsert', {
      actividad: COMENTARIO_RACK, lado: LADO, item: String(rack),
      hecho: limpio.length > 0, datos: nuevos, creado_por: yo,
    })
    setEditando(false)
  }

  return (
    <div className="comentario">
      <b className="leg-titulo">COMENTARIO DEL RACK {rack}</b>
      <textarea
        value={texto}
        rows={3}
        placeholder="Anomalías, pendientes o cualquier cosa que el turno siguiente tenga que saber."
        onChange={(e) => { setEditando(true); setTexto(e.target.value) }}
      />
      <div className="comentario-pie">
        <small>
          {datos.quien
            ? <>Último: <b>{datos.quien}</b>{datos.fecha ? ` · ${fechaCorta(datos.fecha)}` : ''}</>
            : 'Sin comentario todavía'}
        </small>
        <button className="btn sm" disabled={!sucio} onClick={() => void guardar()}>
          {sucio ? 'Guardar' : 'Guardado'}
        </button>
      </div>
    </div>
  )
}
