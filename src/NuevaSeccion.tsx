// El asistente para agregar una sección nueva: una conversación corta que
// pregunta qué se quiere anotar, lo va armando y lo muestra en VISTA PREVIA
// antes de crear nada. Recién cuando se aprueba se guarda y aparece en la app.
//
// Ojo: no es una IA, es un guion de preguntas. Funciona sin llaves, sin mandar
// nada afuera y sin depender de la señal de la planta.
import { useState } from 'react'
import { quienSoy } from './identidad'
import { uuid } from './util'
import {
  ICONOS, TIPOS_CAMPO, claveDe, guardarSeccion,
  type Campo, type Seccion, type TipoCampo,
} from './secciones'

type Paso = 'nombre' | 'que' | 'columnas' | 'icono' | 'vista'

/** Las tres formas que puede tomar una sección nueva. */
const FORMAS: { codigo: 'lista' | 'tabla' | 'notas'; nombre: string; bajada: string }[] = [
  { codigo: 'lista', nombre: 'Una lista de cosas por hacer', bajada: 'Se escriben y se van marcando, como la minuta' },
  { codigo: 'tabla', nombre: 'Una tabla con columnas', bajada: 'Tú decides las columnas: equipo, fecha, responsable…' },
  { codigo: 'notas', nombre: 'Notas sueltas', bajada: 'Un cuadro de texto por cada cosa que quieras dejar anotada' },
]

export default function NuevaSeccion({
  orden, onListo, onCerrar,
}: {
  /** Para que la sección nueva quede al final de las tarjetas. */
  orden: number
  onListo: (s: Seccion) => void
  onCerrar: () => void
}) {
  const [paso, setPaso] = useState<Paso>('nombre')
  const [nombre, setNombre] = useState('')
  const [forma, setForma] = useState<'lista' | 'tabla' | 'notas'>('lista')
  const [campos, setCampos] = useState<Campo[]>([])
  const [nuevoCampo, setNuevoCampo] = useState('')
  const [tipoCampo, setTipoCampo] = useState<TipoCampo>('texto')
  const [icono, setIcono] = useState('📋')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const bajada = forma === 'lista'
    ? 'Cosas por hacer, se van marcando'
    : forma === 'notas' ? 'Notas de esta sección' : `${campos.length} columnas`

  /** Cómo va a quedar la sección: es lo que se guarda si se aprueba. */
  const armada = (): Seccion => ({
    id: uuid(),
    nombre: nombre.trim(),
    bajada,
    icono,
    tipo: forma === 'tabla' ? 'tabla' : 'lista',
    campos: forma === 'tabla'
      ? campos
      : forma === 'notas'
        ? [{ clave: 'nota', nombre: 'Nota', tipo: 'parrafo' }]
        : [],
    orden,
    activa: true,
  })

  const agregarCampo = () => {
    const n = nuevoCampo.trim()
    if (!n) return
    if (campos.some((c) => c.clave === claveDe(n))) { setNuevoCampo(''); return }
    setCampos([...campos, { clave: claveDe(n), nombre: n, tipo: tipoCampo }])
    setNuevoCampo('')
    setTipoCampo('texto')
  }

  const crear = async () => {
    setGuardando(true); setError('')
    try {
      const s = armada()
      await guardarSeccion(s, quienSoy())
      onListo(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la sección.')
    } finally {
      setGuardando(false)
    }
  }

  /** La vista previa: la sección dibujada con dos filas de ejemplo. */
  const vistaPrevia = () => {
    const s = armada()
    const ejemplos = ['Ejemplo de lo que anotarías acá', 'Otra cosa más']
    return (
      <div className="vista-previa">
        <div className="vp-tarjeta">
          <span className="mc-ico rojo">{s.icono}</span>
          <span className="mc-txt"><b>{s.nombre || 'Sin nombre'}</b><small>{s.bajada}</small></span>
          <span className="mc-arrow">›</span>
        </div>
        <div className="vp-pantalla">
          <div className="plano-titulo"><b>{(s.nombre || 'SIN NOMBRE').toUpperCase()}</b><span>PLANIFICACIÓN</span></div>
          {s.tipo === 'lista' ? (
            <ul className="plan-lista">
              {ejemplos.map((t) => (
                <li key={t} className="plan-tarea"><button className="plan-check" /><span className="plan-cuerpo"><b>{t}</b></span></li>
              ))}
              <li className="plan-nueva"><input readOnly placeholder="Agregar" /><button className="btn sm">Agregar</button></li>
            </ul>
          ) : (
            <div className="tabla-seccion">
              <table>
                <thead><tr>{s.campos.map((c) => <th key={c.clave}>{c.nombre}</th>)}<th /></tr></thead>
                <tbody>
                  {ejemplos.map((t, i) => (
                    <tr key={t}>
                      {s.campos.map((c, j) => (
                        <td key={c.clave}>
                          {c.tipo === 'fecha' ? '2026-10-0' + (i + 1)
                            : c.tipo === 'numero' ? String((i + 1) * 12)
                              : c.tipo === 'si_no' ? (i === 0 ? 'Sí' : 'No')
                                : j === 0 ? t : '—'}
                        </td>
                      ))}
                      <td />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  const burbuja = (quien: 'app' | 'yo', texto: string) => (
    <div className={'burbuja ' + quien}>{texto}</div>
  )

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal ancho" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <b>Agregar una sección</b>
          <button className="modal-x" onClick={onCerrar}>✕</button>
        </div>

        <div className="chat">
          {burbuja('app', '¿Cómo se va a llamar la sección?')}
          {paso === 'nombre' ? (
            <div className="plan-nueva">
              <input
                autoFocus value={nombre} placeholder="Por ejemplo: Repuestos críticos"
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && nombre.trim()) setPaso('que') }}
              />
              <button className="btn sm" disabled={!nombre.trim()} onClick={() => setPaso('que')}>Sigue</button>
            </div>
          ) : burbuja('yo', nombre)}

          {paso !== 'nombre' && burbuja('app', '¿Qué vas a anotar ahí?')}
          {paso === 'que' && (
            <div className="lista">
              {FORMAS.map((f) => (
                <button
                  key={f.codigo} className="fila-entrega como-boton"
                  onClick={() => { setForma(f.codigo); setPaso(f.codigo === 'tabla' ? 'columnas' : 'icono') }}
                >
                  <div><b>{f.nombre}</b><small>{f.bajada}</small></div>
                  <span className="mc-arrow">›</span>
                </button>
              ))}
            </div>
          )}
          {paso !== 'nombre' && paso !== 'que' && burbuja('yo', FORMAS.find((f) => f.codigo === forma)!.nombre)}

          {paso === 'columnas' && (
            <>
              {burbuja('app', '¿Qué columnas lleva? Agrégalas una por una.')}
              <ul className="plan-lista">
                {campos.map((c) => (
                  <li key={c.clave} className="plan-tarea">
                    <span className="plan-cuerpo">
                      <b>{c.nombre}</b>
                      <small>{TIPOS_CAMPO.find((t) => t.codigo === c.tipo)?.nombre}</small>
                    </span>
                    <button className="memb-x" onClick={() => setCampos(campos.filter((x) => x.clave !== c.clave))}>✕</button>
                  </li>
                ))}
                <li className="plan-nueva">
                  <input
                    value={nuevoCampo} placeholder="Nombre de la columna"
                    onChange={(e) => setNuevoCampo(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') agregarCampo() }}
                  />
                  <select value={tipoCampo} onChange={(e) => setTipoCampo(e.target.value as TipoCampo)}>
                    {TIPOS_CAMPO.map((t) => <option key={t.codigo} value={t.codigo}>{t.nombre}</option>)}
                  </select>
                  <button className="btn sm" onClick={agregarCampo}>Agregar</button>
                </li>
              </ul>
              <button className="btn" disabled={campos.length === 0} onClick={() => setPaso('icono')}>
                Listo con las columnas
              </button>
            </>
          )}

          {paso === 'icono' && (
            <>
              {burbuja('app', 'Elige un ícono y te la muestro antes de crearla.')}
              <div className="iconos">
                {ICONOS.map((i) => (
                  <button key={i} className={'icono' + (i === icono ? ' on' : '')} onClick={() => setIcono(i)}>{i}</button>
                ))}
              </div>
              <button className="btn" onClick={() => setPaso('vista')}>Ver cómo queda</button>
            </>
          )}

          {paso === 'vista' && (
            <>
              {burbuja('app', 'Así se vería. Si te gusta la creo y queda en la app.')}
              {vistaPrevia()}
              {error && <p className="memb-aviso">{error}</p>}
              <div className="row" style={{ gap: 8, marginTop: 10 }}>
                <button className="btn primary" disabled={guardando} onClick={() => void crear()}>
                  {guardando ? 'Creando…' : 'Créala'}
                </button>
                <button className="btn ghost" onClick={() => setPaso(forma === 'tabla' ? 'columnas' : 'que')}>
                  Ajustar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
