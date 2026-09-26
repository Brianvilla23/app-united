// La ficha de una tarea de la minuta: todo lo que hay que saber de ella en un
// solo lugar — para cuándo, con quién, la información anexa, los archivos
// (PDF, fotos, lo que sea) y sus subtareas.
//
// Los archivos van a un bucket PRIVADO de Supabase y se abren con un enlace
// firmado que dura 5 minutos: nadie llega a ellos con la URL suelta.
import { useCallback, useEffect, useState } from 'react'
import { quienSoy } from './identidad'
import { uuid } from './util'
import {
  ESTADOS_MINUTA, borrarAdjunto, borrarTarea, enlaceAdjunto, guardarTarea, pesoLegible,
  subirAdjunto, traerAdjuntos,
  type Adjunto, type EstadoMinuta, type TareaMinuta,
} from './minuta'
import type { Proyecto } from './planDatos'

function siguienteEstado(e: EstadoMinuta): EstadoMinuta {
  return e === 'pendiente' ? 'en_curso' : e === 'en_curso' ? 'lista' : 'pendiente'
}

export default function FichaTarea({
  tarea, subtareas, proyectos, onCambio, onCerrar,
}: {
  tarea: TareaMinuta
  subtareas: TareaMinuta[]
  proyectos: Proyecto[]
  /** Se llama después de cada cambio para que la lista de atrás se refresque. */
  onCambio: () => Promise<void> | void
  onCerrar: () => void
}) {
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const [nuevaSub, setNuevaSub] = useState('')

  const cargarAdjuntos = useCallback(async () => {
    try { setAdjuntos(await traerAdjuntos(tarea.id)) } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron leer los archivos.')
    }
  }, [tarea.id])

  useEffect(() => { void cargarAdjuntos() }, [cargarAdjuntos])

  const guardar = async (cambio: Partial<TareaMinuta>) => {
    await guardarTarea({ ...tarea, ...cambio }, quienSoy())
    await onCambio()
  }

  const subir = async (archivo: File | undefined) => {
    if (!archivo) return
    setSubiendo(true); setError('')
    try {
      await subirAdjunto(tarea.id, archivo, quienSoy(), uuid)
      await cargarAdjuntos()
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

  const quitarAdjunto = async (a: Adjunto) => {
    await borrarAdjunto(a)
    await cargarAdjuntos()
  }

  const agregarSub = async () => {
    const t = nuevaSub.trim()
    if (!t) return
    await guardarTarea({
      id: uuid(), inicio: tarea.inicio, titulo: t, estado: 'pendiente',
      proyectoId: tarea.proyectoId, nota: '', orden: subtareas.length + 1,
      vieneDe: null, cierre: null, correo: '', padreId: tarea.id,
    }, quienSoy())
    setNuevaSub('')
    await onCambio()
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal ancho" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <b>Tarea de la semana</b>
          <button className="modal-x" onClick={onCerrar}>✕</button>
        </div>

        <label className="lab">Título</label>
        <input
          defaultValue={tarea.titulo}
          onBlur={(e) => { if (e.target.value.trim() && e.target.value !== tarea.titulo) void guardar({ titulo: e.target.value.trim() }) }}
        />

        <div className="row" style={{ gap: 8 }}>
          <label className="lab" style={{ flex: 1 }}>
            Estado
            <button
              className={'btn sm estado-' + tarea.estado}
              onClick={() => void guardar({ estado: siguienteEstado(tarea.estado) })}
            >
              {ESTADOS_MINUTA.find((e) => e.codigo === tarea.estado)?.nombre}
            </button>
          </label>
          <label className="lab" style={{ flex: 1 }}>
            Fecha de cierre
            <input
              type="date" defaultValue={tarea.cierre ?? ''}
              onChange={(e) => void guardar({ cierre: e.target.value || null })}
            />
          </label>
        </div>

        <label className="lab">Proyecto</label>
        <select
          value={tarea.proyectoId ?? ''}
          onChange={(e) => void guardar({ proyectoId: e.target.value || null })}
        >
          <option value="">Sin proyecto</option>
          {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>

        <label className="lab">Correo de contacto</label>
        <input
          type="email" inputMode="email" defaultValue={tarea.correo}
          placeholder="A quién se le pidió o con quién se coordina"
          onBlur={(e) => { if (e.target.value !== tarea.correo) void guardar({ correo: e.target.value.trim() }) }}
        />

        <label className="lab">Información</label>
        <textarea
          rows={4} defaultValue={tarea.nota}
          placeholder="Todo lo que haya que saber: acuerdos, números de OT, qué se respondió"
          onBlur={(e) => { if (e.target.value !== tarea.nota) void guardar({ nota: e.target.value }) }}
        />

        <h3 className="sec">Archivos</h3>
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
                <button className="memb-x" onClick={() => void quitarAdjunto(a)}>✕</button>
              </div>
            </div>
          ))}
        </div>
        <label className="btn add" style={{ marginTop: 8 }}>
          {subiendo ? 'Subiendo…' : '+ Adjuntar PDF, foto o documento'}
          <input type="file" hidden onChange={(e) => void subir(e.target.files?.[0])} />
        </label>

        <h3 className="sec">Subtareas</h3>
        <ul className="plan-lista">
          {subtareas.map((s) => (
            <li key={s.id} className={'plan-tarea sub min-' + s.estado}>
              <button
                className="plan-check"
                onClick={() => void guardarTarea({ ...s, estado: siguienteEstado(s.estado) }, quienSoy()).then(onCambio)}
              >
                {ESTADOS_MINUTA.find((e) => e.codigo === s.estado)?.corto}
              </button>
              <span className="plan-cuerpo"><b>{s.titulo}</b></span>
              <button
                className="memb-x"
                onClick={() => void borrarTarea(s.id).then(onCambio)}
              >✕</button>
            </li>
          ))}
          <li className="plan-nueva">
            <input
              value={nuevaSub} placeholder="Subtarea"
              onChange={(e) => setNuevaSub(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void agregarSub() }}
            />
            <button className="btn sm" onClick={() => void agregarSub()}>Agregar</button>
          </li>
        </ul>
      </div>
    </div>
  )
}
