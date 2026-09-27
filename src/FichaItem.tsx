// La ficha de una actividad de las secciones que se crean desde la app: lo
// mismo que tienen las tareas de la minuta —información, fecha de cierre,
// responsable, archivos y subtareas— para que toda actividad se pueda abrir.
import { useCallback, useEffect, useState } from 'react'
import { quienSoy } from './identidad'
import { uuid } from './util'
import {
  borrarAdjunto, enlaceAdjunto, pesoLegible, subirAdjunto, traerAdjuntos, type Adjunto,
} from './adjuntos'
import {
  borrarItem, cambiarItem, guardarItem, tituloItem,
  type Campo, type ItemSeccion, type Seccion,
} from './secciones'

export default function FichaItem({
  seccion, item, subtareas, onCambio, onCerrar,
}: {
  seccion: Seccion
  item: ItemSeccion
  subtareas: ItemSeccion[]
  onCambio: () => Promise<void> | void
  onCerrar: () => void
}) {
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const [nuevaSub, setNuevaSub] = useState('')

  const cargarAdjuntos = useCallback(async () => {
    try { setAdjuntos(await traerAdjuntos('seccion', item.id)) } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron leer los archivos.')
    }
  }, [item.id])

  useEffect(() => { void cargarAdjuntos() }, [cargarAdjuntos])

  const guardar = async (cambio: Parameters<typeof cambiarItem>[1]) => {
    await cambiarItem(item.id, cambio, quienSoy())
    await onCambio()
  }

  const subir = async (archivo: File | undefined) => {
    if (!archivo) return
    setSubiendo(true); setError('')
    try {
      await subirAdjunto('seccion', item.id, archivo, quienSoy(), uuid)
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

  const agregarSub = async () => {
    const t = nuevaSub.trim()
    if (!t) return
    await guardarItem({
      id: uuid(), seccionId: seccion.id, datos: { nota: t }, estado: 'pendiente',
      orden: subtareas.length + 1, padreId: item.id, nota: '', cierre: null, correo: '',
    }, quienSoy())
    setNuevaSub('')
    await onCambio()
  }

  /** Los campos de la sección, editables acá también. */
  const campo = (c: Campo) => {
    const valor = item.datos[c.clave]
    const poner = (v: string | number | boolean) =>
      void guardar({ datos: { ...item.datos, [c.clave]: v } })
    if (c.tipo === 'si_no') {
      return (
        <label key={c.clave} className="lab">
          {c.nombre}
          <button className={'btn sm' + (valor ? '' : ' ghost')} onClick={() => poner(!valor)}>
            {valor ? 'Sí' : 'No'}
          </button>
        </label>
      )
    }
    if (c.tipo === 'parrafo') {
      return (
        <label key={c.clave} className="lab">
          {c.nombre}
          <textarea rows={2} defaultValue={String(valor ?? '')}
            onBlur={(e) => { if (e.target.value !== String(valor ?? '')) poner(e.target.value) }} />
        </label>
      )
    }
    return (
      <label key={c.clave} className="lab">
        {c.nombre}
        <input
          type={c.tipo === 'fecha' ? 'date' : c.tipo === 'numero' ? 'number' : 'text'}
          defaultValue={String(valor ?? '')}
          onBlur={(e) => { if (e.target.value !== String(valor ?? '')) poner(e.target.value) }}
        />
      </label>
    )
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal ancho" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <b>{seccion.nombre}</b>
          <button className="modal-x" onClick={onCerrar}>✕</button>
        </div>

        {seccion.campos.map(campo)}

        <div className="row" style={{ gap: 8 }}>
          <label className="lab" style={{ flex: 1 }}>
            Estado
            <button
              className={'btn sm' + (item.estado === 'lista' ? '' : ' ghost')}
              onClick={() => void guardar({ estado: item.estado === 'lista' ? 'pendiente' : 'lista' })}
            >
              {item.estado === 'lista' ? 'Lista' : 'Pendiente'}
            </button>
          </label>
          <label className="lab" style={{ flex: 1 }}>
            Fecha de cierre
            <input
              type="date" defaultValue={item.cierre ?? ''}
              onChange={(e) => void guardar({ cierre: e.target.value || null })}
            />
          </label>
        </div>

        <label className="lab">Quién responde</label>
        <input
          defaultValue={item.correo} placeholder="Nombre, empresa o correo"
          onBlur={(e) => { if (e.target.value !== item.correo) void guardar({ correo: e.target.value.trim() }) }}
        />

        <label className="lab">Información</label>
        <textarea
          rows={4} defaultValue={item.nota}
          placeholder="Todo lo que haya que saber: acuerdos, números de OT, qué se respondió"
          onBlur={(e) => { if (e.target.value !== item.nota) void guardar({ nota: e.target.value }) }}
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
                <button className="memb-x" onClick={() => void borrarAdjunto(a).then(cargarAdjuntos)}>✕</button>
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
            <li key={s.id} className={'plan-tarea sub' + (s.estado === 'lista' ? ' tachada' : '')}>
              <button
                className="plan-check"
                onClick={() => void guardarItem(
                  { ...s, estado: s.estado === 'lista' ? 'pendiente' : 'lista' }, quienSoy(),
                ).then(onCambio)}
              >
                {s.estado === 'lista' ? '✓' : ''}
              </button>
              <span className="plan-cuerpo"><b>{tituloItem(s, seccion.campos)}</b></span>
              <button className="memb-x" onClick={() => void borrarItem(s.id).then(onCambio)}>✕</button>
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
