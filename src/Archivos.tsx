// Los archivos de una actividad, para cualquier lista de Planificación: se
// suben PDF, fotos o lo que sea, se abren con un enlace firmado y se borran.
import { useCallback, useEffect, useState } from 'react'
import { quienSoy } from './identidad'
import { uuid } from './util'
import {
  borrarAdjunto, enlaceAdjunto, pesoLegible, subirAdjunto, traerAdjuntos,
  type Adjunto, type AmbitoAdjunto,
} from './adjuntos'

export default function Archivos({ ambito, objetoId }: { ambito: AmbitoAdjunto; objetoId: string }) {
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    try { setAdjuntos(await traerAdjuntos(ambito, objetoId)) } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron leer los archivos.')
    }
  }, [ambito, objetoId])

  useEffect(() => { void cargar() }, [cargar])

  const subir = async (archivo: File | undefined) => {
    if (!archivo) return
    setSubiendo(true); setError('')
    try {
      await subirAdjunto(ambito, objetoId, archivo, quienSoy(), uuid)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir.')
    } finally {
      setSubiendo(false)
    }
  }

  const abrir = async (a: Adjunto) => {
    try { window.open(await enlaceAdjunto(a.ruta), '_blank') } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir.')
    }
  }

  return (
    <div>
      {error && <p className="memb-aviso">{error}</p>}
      <div className="lista">
        {adjuntos.map((a) => (
          <div key={a.id} className="fila-entrega">
            <div>
              <b>{a.nombre}</b>
              <small>{pesoLegible(a.tamano)}{a.subidoPor ? ` · ${a.subidoPor}` : ''}</small>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn sm ghost" onClick={() => void abrir(a)}>Abrir</button>
              <button className="memb-x" onClick={() => void borrarAdjunto(a).then(cargar)}>✕</button>
            </div>
          </div>
        ))}
      </div>
      <label className="btn add" style={{ marginTop: 8 }}>
        {subiendo ? 'Subiendo…' : '+ Adjuntar PDF, foto o documento'}
        <input type="file" hidden onChange={(e) => void subir(e.target.files?.[0])} />
      </label>
    </div>
  )
}
