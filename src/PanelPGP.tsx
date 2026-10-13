// PGP: los cuatro registros diarios del turno de supervisión.
//
// Se elige el registro, se ven sus 7 días (martes a lunes) y cada día se abre
// para cargarle una o varias fotos. El día con algo cargado queda verde. Se
// baja en PDF un día o todos los días cargados de la semana.
//
// Sin señal se carga igual: la foto queda en el celular con "↑ por subir" y
// sube sola cuando vuelve la señal (`subirPendientes` en `pgp.ts`).
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { quienSoy } from './identidad'
import { hoyISO } from './util'
import { diasDeLaSemana, martesDe, rotuloSemana, sumarDias } from './minuta'
import { useModal } from './useModal'
import {
  REGISTROS_PGP, bajarSemana, borrarImagen, cargarImagenes, conDatos, dbPgp, imagenesDe,
  nombreRegistro, urlImagen, type ImagenPgp, type RegistroPgp,
} from './pgp'
import { nombreDia, pdfPgp } from './pdfPgp'

const CORTO = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']

/** Cuántas imágenes tiene cada día de la semana, de un registro o de todos. */
function useConteo(dias: string[], registro?: RegistroPgp): Map<string, number> {
  const filas = useLiveQuery(
    () => (registro
      ? dbPgp.imagenes.where('registro').equals(registro).toArray()
      : dbPgp.imagenes.toArray()),
    [registro],
  ) ?? []
  const m = new Map<string, number>()
  for (const f of filas) if (dias.includes(f.dia)) m.set(f.dia, (m.get(f.dia) ?? 0) + 1)
  return m
}

function TarjetaRegistro({
  r, dias, onAbrir,
}: { r: (typeof REGISTROS_PGP)[number]; dias: string[]; onAbrir: () => void }) {
  const conteo = useConteo(dias, r.codigo)
  const cargados = dias.filter((d) => conteo.has(d)).length
  return (
    <button className="menu-card" onClick={onAbrir}>
      <span className="mc-ico rojo">{r.icono}</span>
      <span className="mc-txt">
        <b>{r.nombre}</b>
        <small>{r.bajada}</small>
        <span className="pgp-puntos">
          {dias.map((d) => <i key={d} className={conteo.has(d) ? 'on' : ''} />)}
          <em>{cargados} de 7 días</em>
        </span>
      </span>
      <span className="mc-arrow">›</span>
    </button>
  )
}

/** La foto del celular, o la que cargó otro pedida con enlace firmado. */
function Foto({ img, onClick }: { img: ImagenPgp; onClick?: () => void }) {
  const [src, setSrc] = useState(img.imagen)
  const [falla, setFalla] = useState(false)
  useEffect(() => {
    let vivo = true
    if (img.imagen) { setSrc(img.imagen); return }
    urlImagen(img).then((u) => { if (vivo) setSrc(u) }).catch(() => { if (vivo) setFalla(true) })
    return () => { vivo = false }
  }, [img])
  if (!src) return <div className="pgp-sin-imagen" onClick={onClick}>{falla ? 'Sin señal' : 'Cargando…'}</div>
  return <img src={src} alt="" onClick={onClick} />
}

/** PDF con las fotos de todos: las que cargó otro se bajan antes. */
async function bajarPdf(
  registro: RegistroPgp, imgs: ImagenPgp[], rotulo: string, archivo: string, setError: (e: string) => void,
) {
  setError('')
  try {
    await pdfPgp(registro, await conDatos(imgs), rotulo, archivo)
  } catch {
    setError('Faltan fotos que cargó otra persona y sin señal no se pueden bajar. Prueba con señal.')
  }
}

function DetalleDia({
  registro, dia, onCerrar,
}: { registro: RegistroPgp; dia: string; onCerrar: () => void }) {
  const imagenes = useLiveQuery(() => imagenesDe(registro, [dia]), [registro, dia]) ?? []
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [grande, setGrande] = useState<ImagenPgp | null>(null)
  const porSubir = imagenes.filter((i) => i.subido === 0).length

  const borrar = async (i: ImagenPgp) => {
    if (!confirm('¿Borrar esta imagen?')) return
    setError('')
    try { await borrarImagen(i) } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar.')
    }
  }

  const cargar = async (lista: FileList | null) => {
    if (!lista?.length) return
    setCargando(true); setError('')
    try {
      const n = await cargarImagenes(registro, dia, [...lista], quienSoy())
      if (n === 0) setError('Eso no es una imagen.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <b style={{ textTransform: 'capitalize' }}>{nombreDia(dia)}</b>
          <button className="modal-x" onClick={onCerrar}>✕</button>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>{nombreRegistro(registro)}</p>

        {imagenes.length === 0 ? (
          <p className="pgp-vacio">Todavía no hay nada cargado este día.</p>
        ) : (
          <div className="pgp-fotos">
            {imagenes.map((i) => (
              <div key={i.id} className="pgp-foto">
                <Foto img={i} onClick={() => setGrande(i)} />
                <button className="memb-x" title="Borrar esta imagen" onClick={() => void borrar(i)}>✕</button>
                {i.subido === 0 && <span className="pgp-por-subir">↑ por subir</span>}
                <small>{i.subidoPor}</small>
              </div>
            ))}
          </div>
        )}

        {porSubir > 0 && (
          <p className="hint">
            {porSubir === 1 ? '1 foto espera' : `${porSubir} fotos esperan`} señal para subir. Quedan guardadas en
            este celular y suben solas.
          </p>
        )}
        {error && <p className="memb-aviso">{error}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <label className="btn tool" style={{ textAlign: 'center', flex: 1 }}>
            📷 Sacar foto
            <input type="file" accept="image/*" capture="environment" hidden
              onChange={(e) => { void cargar(e.target.files); e.target.value = '' }} />
          </label>
          <label className="btn tool" style={{ textAlign: 'center', flex: 1 }}>
            🖼️ Cargar imágenes
            <input type="file" accept="image/*" multiple hidden
              onChange={(e) => { void cargar(e.target.files); e.target.value = '' }} />
          </label>
        </div>
        {cargando && <p className="hint">Cargando…</p>}

        <button
          className="btn" style={{ width: '100%', marginTop: 10 }} disabled={imagenes.length === 0}
          onClick={() => void bajarPdf(registro, imagenes, nombreDia(dia), `PGP_${registro}_${dia}.pdf`, setError)}
        >
          PDF de este día ({imagenes.length} {imagenes.length === 1 ? 'imagen' : 'imágenes'})
        </button>
      </div>

      {grande && (
        <div className="pgp-grande" onClick={(e) => { e.stopPropagation(); setGrande(null) }}>
          <Foto img={grande} />
        </div>
      )}
    </div>
  )
}

function Registro({ registro, inicio }: { registro: RegistroPgp; inicio: string }) {
  const dias = diasDeLaSemana(inicio)
  const conteo = useConteo(dias, registro)
  const [dia, abrirDia, cerrarDia] = useModal<string>()
  const hoy = hoyISO()
  const cargados = dias.filter((d) => conteo.has(d))
  const total = cargados.reduce((s, d) => s + (conteo.get(d) ?? 0), 0)
  const [error, setError] = useState('')

  const pdfSemana = async () => {
    const imgs = await imagenesDe(registro, dias)
    await bajarPdf(registro, imgs, rotuloSemana(inicio), `PGP_${registro}_semana_${inicio}.pdf`, setError)
  }

  return (
    <div>
      <div className="pgp-dias">
        {dias.map((d) => {
          const n = conteo.get(d) ?? 0
          const f = new Date(d + 'T12:00:00')
          return (
            <button
              key={d}
              className={'pgp-dia' + (n ? ' on' : '') + (d === hoy ? ' hoy' : '') + (d > hoy ? ' futuro' : '')}
              onClick={() => abrirDia(d)}
            >
              <small>{CORTO[f.getDay()]}</small>
              <b>{d.slice(8)}</b>
              <span>{n ? `✓ ${n}` : '—'}</span>
            </button>
          )
        })}
      </div>
      <div className="leyenda" style={{ marginTop: 8 }}>
        <span className="leg-item"><span className="leg-dot" style={{ background: '#16a34a' }} />Cargado</span>
        <span className="leg-item"><span className="leg-dot" style={{ background: '#cbd5e1' }} />Sin cargar</span>
        <span className="leg-item"><span className="leg-dot" style={{ background: 'transparent', border: '2px solid #c00000' }} />Hoy</span>
      </div>

      <button className="btn primary" style={{ width: '100%', marginTop: 12 }}
        disabled={total === 0} onClick={() => void pdfSemana()}>
        PDF de la semana · {cargados.length} {cargados.length === 1 ? 'día cargado' : 'días cargados'} · {total} {total === 1 ? 'imagen' : 'imágenes'}
      </button>
      {error && <p className="memb-aviso">{error}</p>}
      <p className="hint">Toca un día para cargarle fotos o bajar solo ese día.</p>

      {dia && <DetalleDia registro={registro} dia={dia} onCerrar={cerrarDia} />}
    </div>
  )
}

export default function PanelPGP() {
  const [inicio, setInicio] = useState(martesDe(hoyISO()))
  const [registro, setRegistro] = useState<RegistroPgp | null>(null)
  const dias = diasDeLaSemana(inicio)
  const [sinSenal, setSinSenal] = useState(false)

  // lo que cargó el resto de la supervisión esa semana
  useEffect(() => {
    let vivo = true
    const traer = () => bajarSemana(inicio)
      .then(() => { if (vivo) setSinSenal(false) })
      .catch(() => { if (vivo) setSinSenal(true) })
    void traer()
    const t = setInterval(() => { void traer() }, 60_000)
    return () => { vivo = false; clearInterval(t) }
  }, [inicio])

  return (
    <div>
      <div className="plano-titulo">
        <b>{registro ? nombreRegistro(registro).toUpperCase() : 'PGP'}</b>
        <span>SUPERVISIÓN</span>
      </div>

      <div className="pgp-semana">
        <button className="btn sm ghost" onClick={() => setInicio(sumarDias(inicio, -7))}>‹</button>
        <span>{rotuloSemana(inicio)}</span>
        <button className="btn sm ghost" onClick={() => setInicio(sumarDias(inicio, 7))}>›</button>
      </div>

      {registro ? (
        <>
          <button className="btn sm ghost" style={{ marginBottom: 10 }} onClick={() => setRegistro(null)}>
            ‹ Los cuatro registros
          </button>
          <Registro registro={registro} inicio={inicio} />
        </>
      ) : (
        <div className="menu-grid">
          {REGISTROS_PGP.map((r) => (
            <TarjetaRegistro key={r.codigo} r={r} dias={dias} onAbrir={() => setRegistro(r.codigo)} />
          ))}
        </div>
      )}

      {sinSenal && (
        <p className="hint" style={{ marginTop: 14 }}>
          Sin señal: ves lo cargado desde este celular. Lo de los demás aparece cuando vuelva la señal.
        </p>
      )}
    </div>
  )
}
