// La pantalla de una sección creada desde la app. Una sola sirve para todas:
// dibuja una lista que se marca o una tabla con las columnas que se hayan
// definido, según cómo se armó la sección.
import { useCallback, useEffect, useState } from 'react'
import { quienSoy } from './identidad'
import { uuid } from './util'
import {
  borrarItem, guardarItem, tituloItem, traerItems, type Campo, type ItemSeccion, type Seccion,
} from './secciones'
import FichaItem from './FichaItem'
import { useModal } from './useModal'

const vacio = (campos: Campo[]): Record<string, string | number | boolean> =>
  Object.fromEntries(campos.map((c) => [c.clave, c.tipo === 'si_no' ? false : '']))

export default function PanelSeccion({ seccion }: { seccion: Seccion }) {
  const [items, setItems] = useState<ItemSeccion[]>([])
  const [error, setError] = useState('')
  const [nuevo, setNuevo] = useState<Record<string, string | number | boolean>>(vacio(seccion.campos))
  const [texto, setTexto] = useState('')
  const [abierta, abrirFicha, cerrarFicha] = useModal<string>()

  /** Las de primer nivel; las subtareas cuelgan de su ficha. */
  const madres = items.filter((i) => !i.padreId)
  const subtareasDe = (id: string) => items.filter((i) => i.padreId === id)

  const cargar = useCallback(async () => {
    try { setItems(await traerItems(seccion.id)); setError('') } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar.')
    }
  }, [seccion.id])

  useEffect(() => { void cargar() }, [cargar])

  const agregar = async (datos: Record<string, string | number | boolean>) => {
    const algo = Object.values(datos).some((v) => (typeof v === 'string' ? v.trim() !== '' : v !== false))
    if (!algo) return
    await guardarItem({
      id: uuid(), seccionId: seccion.id, datos, estado: 'pendiente',
      orden: madres.length + 1, padreId: null, nota: '', cierre: null, correo: '',
    }, quienSoy())
    setNuevo(vacio(seccion.campos))
    setTexto('')
    await cargar()
  }

  const cambiar = async (i: ItemSeccion, cambio: Partial<ItemSeccion>) => {
    await guardarItem({ ...i, ...cambio }, quienSoy())
    await cargar()
  }

  const quitar = async (id: string) => {
    await borrarItem(id)
    await cargar()
  }

  /** Lo que se muestra bajo el título: para cuándo, con quién y cuántas
      subtareas quedan abiertas. Así se ve de una qué está pendiente. */
  const detalleDe = (i: ItemSeccion) => {
    const subs = subtareasDe(i.id)
    const abiertas = subs.filter((x) => x.estado !== 'lista').length
    return [
      i.cierre ? `cierra ${i.cierre}` : '',
      i.correo,
      subs.length > 0 ? `${abiertas} de ${subs.length} subtareas abiertas` : '',
      i.nota ? 'con información' : '',
    ].filter(Boolean).join(' · ')
  }

  const campo = (
    c: Campo,
    valor: string | number | boolean,
    poner: (v: string | number | boolean) => void,
    chico = false,
  ) => {
    if (c.tipo === 'si_no') {
      return (
        <button
          key={c.clave} className={'btn sm' + (valor ? '' : ' ghost')}
          onClick={() => poner(!valor)}
        >
          {c.nombre}: {valor ? 'Sí' : 'No'}
        </button>
      )
    }
    if (c.tipo === 'parrafo' && !chico) {
      return (
        <textarea
          key={c.clave} rows={2} value={String(valor ?? '')} placeholder={c.nombre}
          onChange={(e) => poner(e.target.value)}
        />
      )
    }
    return (
      <input
        key={c.clave}
        type={c.tipo === 'fecha' ? 'date' : c.tipo === 'numero' ? 'number' : 'text'}
        inputMode={c.tipo === 'numero' ? 'numeric' : undefined}
        value={String(valor ?? '')} placeholder={c.nombre}
        onChange={(e) => poner(e.target.value)}
      />
    )
  }

  return (
    <div>
      {seccion.bajada && <p className="hint" style={{ margin: '0 0 10px' }}>{seccion.bajada}</p>}
      {error && <p className="memb-aviso">{error}</p>}

      {seccion.tipo === 'lista' ? (
        <ul className="plan-lista">
          <li className="plan-nueva">
            <input
              value={texto} placeholder="Agregar"
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void agregar({ nota: texto }) }}
            />
            <button className="btn sm" onClick={() => void agregar({ nota: texto })}>Agregar</button>
          </li>
          {madres.length === 0 && (
            <li className="hint" style={{ padding: '8px 2px' }}>Todavía no hay nada anotado acá.</li>
          )}
          {madres.map((i) => (
            <li key={i.id} className={'plan-tarea' + (i.estado === 'lista' ? ' tachada' : '')}>
              <button
                className="plan-check"
                onClick={() => void cambiar(i, { estado: i.estado === 'lista' ? 'pendiente' : 'lista' })}
              >
                {i.estado === 'lista' ? '✓' : ''}
              </button>
              <span className="plan-cuerpo" onClick={() => abrirFicha(i.id)}>
                <b>{tituloItem(i, seccion.campos)}</b>
                <small>{detalleDe(i) || 'Tócala para la ficha'}</small>
              </span>
              <button className="memb-x" onClick={() => void quitar(i.id)}>✕</button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <div className="form" style={{ gap: 8, marginBottom: 12 }}>
            {seccion.campos.map((c) => campo(c, nuevo[c.clave], (v) => setNuevo({ ...nuevo, [c.clave]: v })))}
            <button className="btn sm" onClick={() => void agregar(nuevo)}>Agregar</button>
          </div>
          {items.length === 0
            ? <p className="hint">Todavía no hay nada anotado acá.</p>
            : (
              <div className="tabla-seccion">
                <table>
                  <thead>
                    <tr>{seccion.campos.map((c) => <th key={c.clave}>{c.nombre}</th>)}<th /></tr>
                  </thead>
                  <tbody>
                    {madres.map((i) => (
                      <tr key={i.id}>
                        {seccion.campos.map((c) => (
                          <td key={c.clave}>
                            {campo(c, i.datos[c.clave], (v) => void cambiar(i, { datos: { ...i.datos, [c.clave]: v } }), true)}
                          </td>
                        ))}
                        <td>
                          <div className="row" style={{ gap: 4 }}>
                            <button className="btn sm ghost" onClick={() => abrirFicha(i.id)}>Ficha</button>
                            <button className="memb-x" onClick={() => void quitar(i.id)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </>
      )}

      {abierta && items.some((i) => i.id === abierta) && (
        <FichaItem
          seccion={seccion}
          item={items.find((i) => i.id === abierta)!}
          subtareas={subtareasDe(abierta)}
          onCambio={() => cargar()}
          onCerrar={cerrarFicha}
        />
      )}
    </div>
  )
}
