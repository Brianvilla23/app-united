// Las 7 membranas de una vasija: se escanean con la cámara en el orden en que
// se instalan (posición 7 → 1) y quedan guardadas con su serie.
//
// Es el reemplazo, dentro del outage, del escáner de membranas que vivía en una
// app aparte: la vasija ya está en el plano del carguío, así que tocarla abre
// directamente sus siete posiciones.
import { useEffect, useRef, useState } from 'react'
import { quienSoy } from './identidad'
import { usePuedeRegistrar } from './rackOutage'
import { useModal } from './useModal'
import EscanerMembrana, { type Respuesta } from './EscanerMembrana'
import {
  MARCAS, MARCA_POR_DEFECTO, MEMBRANAS_POR_VASIJA, POSICIONES,
  completa, conMembrana, membranaEn, modeloPorDefecto, modelosDe, puestas,
  siguientePosicion, tipoDePosicion, vasijaConLaSerie,
  type DatosMembranas, type MarcaMembrana,
} from './membranas'

export default function DetalleMembranas({
  rack, vasija, datos, porVasija, onMarcar, onCerrar,
}: {
  rack: number
  vasija: string
  datos: DatosMembranas
  /** Todas las vasijas del rack, para avisar si una serie ya está usada. */
  porVasija: Map<string, DatosMembranas>
  /** Recibe cómo cambiar los datos, no los datos ya cambiados: dos lecturas
      seguidas no pueden partir de una copia vieja. */
  onMarcar: (cambio: (actual: DatosMembranas) => DatosMembranas) => void
  onCerrar: () => void
}) {
  const puedeEditar = usePuedeRegistrar()
  const [camara, abrirCamara, cerrarCamara] = useModal<boolean>()
  const [escribiendo, setEscribiendo] = useState<number | null>(null)
  const [texto, setTexto] = useState('')
  const [aviso, setAviso] = useState('')
  const marca = datos.marca ?? MARCA_POR_DEFECTO
  const listas = puestas(datos)
  const proxima = siguientePosicion(datos)
  const faltan = MEMBRANAS_POR_VASIJA - listas

  // Las posiciones que faltan, en orden de instalación. Va en un ref y no en el
  // estado porque entre dos lecturas seguidas la base todavía no alcanzó a
  // devolver los datos nuevos y la segunda escribiría sobre la misma posición.
  const pendientes = useRef<number[]>([])
  useEffect(() => {
    pendientes.current = POSICIONES.filter((p) => !membranaEn(datos, p)?.serie)
  }, [datos])

  const guardar = (pos: number, serie: string, metodo: 'camara' | 'manual', formato = '') => {
    const limpia = serie.trim().toUpperCase()
    onMarcar((actual) => conMembrana(actual, pos, {
      serie: limpia,
      modelo: modeloPorDefecto(actual.marca ?? MARCA_POR_DEFECTO, pos),
      metodo, formato, quien: quienSoy(), ts: Date.now(),
    }))
  }

  /** Revisa que la serie no esté ya en esta vasija ni en otra. */
  const revisar = (serie: string): string => {
    const limpia = serie.trim().toUpperCase()
    if (limpia.length < 4) return 'La serie es muy corta.'
    const aqui = POSICIONES.find((p) => membranaEn(datos, p)?.serie.toUpperCase() === limpia)
    if (aqui) return `Esa serie ya está en la posición ${aqui} de esta vasija.`
    const otra = vasijaConLaSerie(limpia, porVasija, vasija)
    if (otra) return `Esa serie ya está registrada en la vasija ${otra}.`
    return ''
  }

  /** Cada lectura de la cámara cae en la siguiente posición que falte, y
      contesta qué mostrar: el escáner avisa "listo" y cuál viene. */
  const alLeer = (serie: string, formato: string): Respuesta => {
    const problema = revisar(serie)
    if (problema) { setAviso(problema); return { ok: false, mensaje: problema } }
    const pos = pendientes.current.shift()
    if (pos === undefined) {
      const m = 'Esta vasija ya tiene sus 7 membranas.'
      setAviso(m)
      return { ok: false, mensaje: m }
    }
    setAviso('')
    guardar(pos, serie, 'camara', formato)
    const sigue = pendientes.current[0]
    if (sigue === undefined) setTimeout(cerrarCamara, 1600)
    return {
      ok: true,
      mensaje: sigue === undefined
        ? `Posición ${pos}: ${serie.trim().toUpperCase()} · las 7 membranas quedaron registradas`
        : `Posición ${pos}: ${serie.trim().toUpperCase()} · sigue la posición ${sigue}`,
    }
  }

  const escribir = (pos: number) => {
    const problema = revisar(texto)
    if (problema) { setAviso(problema); return }
    setAviso('')
    guardar(pos, texto, 'manual')
    setEscribiendo(null)
    setTexto('')
  }

  const borrar = (pos: number) => {
    if (!puedeEditar) return
    onMarcar((actual) => conMembrana(actual, pos, null))
  }

  const cambiarMarca = (m: MarcaMembrana) => {
    if (!puedeEditar) return
    // solo cambia lo que viene: las series ya guardadas conservan su modelo
    onMarcar((actual) => ({ ...actual, marca: m }))
  }

  const guardarCampo = (campo: 'supervisor' | 'observacion', valor: string) => {
    if (!puedeEditar) return
    const limpio = valor.trim()
    if ((datos[campo] ?? '') === limpio) return
    onMarcar((actual) => ({ ...actual, [campo]: limpio }))
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal ancho" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <b>Rack {rack} · Vasija {vasija}</b>
          <button className="modal-x" onClick={onCerrar}>✕</button>
        </div>

        <div className="memb-resumen">
          <b className={completa(datos) ? 'ok' : ''}>{listas} de {MEMBRANAS_POR_VASIJA}</b>
          <span>membranas registradas</span>
        </div>

        <div className="memb-marca">
          {MARCAS.map((m) => (
            <button
              key={m.codigo}
              className={marca === m.codigo ? 'on' : ''}
              disabled={!puedeEditar}
              onClick={() => cambiarMarca(m.codigo)}
            >
              {m.nombre}
              <small>{modelosDe(m.codigo, 'C6')[0]?.codigo} · {modelosDe(m.codigo, 'C5')[0]?.codigo}</small>
            </button>
          ))}
        </div>

        {aviso && <p className="memb-aviso">{aviso}</p>}

        <ol className="memb-lista">
          {POSICIONES.map((pos) => {
            const m = membranaEn(datos, pos)
            const activa = proxima === pos
            return (
              <li key={pos} className={'memb-fila' + (m?.serie ? ' puesta' : '') + (activa ? ' activa' : '')}>
                <span className="memb-pos">{pos}</span>
                <span className="memb-cuerpo">
                  <b>{m?.serie || (activa ? 'Siguiente' : 'Pendiente')}</b>
                  <small>
                    {tipoDePosicion(pos)} · {m?.modelo || modeloPorDefecto(marca, pos)}
                    {m?.metodo === 'manual' && ' · a mano'}
                  </small>
                </span>
                {escribiendo === pos ? (
                  <span className="memb-escribir">
                    <input
                      autoFocus
                      value={texto}
                      placeholder="Serie"
                      onChange={(e) => setTexto(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') escribir(pos) }}
                    />
                    <button className="btn sm" onClick={() => escribir(pos)}>OK</button>
                  </span>
                ) : puedeEditar && (
                  m?.serie
                    ? <button className="memb-x" onClick={() => borrar(pos)} title="Borrar">✕</button>
                    : <button className="btn sm ghost" onClick={() => { setEscribiendo(pos); setTexto('') }}>Escribir</button>
                )}
              </li>
            )
          })}
        </ol>

        {puedeEditar && (
          <>
            <button
              className="btn primary"
              disabled={completa(datos)}
              onClick={() => { setAviso(''); abrirCamara(true) }}
            >
              {faltan === 0 ? 'Las 7 membranas listas'
                : listas === 0 ? 'Escanear las 7 membranas'
                  : `Escanear (falta${faltan === 1 ? '' : 'n'} ${faltan})`}
            </button>

            <label className="lab">Supervisor responsable</label>
            <input
              defaultValue={datos.supervisor ?? ''}
              placeholder="Nombre y apellido"
              onBlur={(e) => guardarCampo('supervisor', e.target.value)}
            />

            <label className="lab">Observación</label>
            <input
              defaultValue={datos.observacion ?? ''}
              placeholder="Opcional"
              onBlur={(e) => guardarCampo('observacion', e.target.value)}
            />
          </>
        )}

        {!puedeEditar && datos.supervisor && (
          <p className="hint">Supervisor: <b>{datos.supervisor}</b></p>
        )}
        {!puedeEditar && datos.observacion && <p className="hint">{datos.observacion}</p>}

        {camara && (
          <EscanerMembrana
            titulo={`Vasija ${vasija} · posición ${proxima ?? ''}`}
            onCodigo={alLeer}
            onCerrar={cerrarCamara}
          />
        )}
      </div>
    </div>
  )
}
