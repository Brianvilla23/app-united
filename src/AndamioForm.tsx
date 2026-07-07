import { useEffect, useState } from 'react'
import { db, generarFolioAndamio } from './db'
import { generarPDFAndamio } from './pdfAndamio'
import { ZONAS } from './types'
import type { Andamio, EstadoTarjeta } from './types'
import { uuid, fileToJpeg, hoyISO } from './util'

const CREADO_POR = 'B. Villalobos'
const ESTADOS: EstadoTarjeta[] = ['Verde', 'Amarilla', 'Roja']
const ESTADO_CLASE: Record<EstadoTarjeta, string> = { Verde: 'verde', Amarilla: 'amarilla', Roja: 'roja' }

const vacio = {
  lugar: '', equipo: '', descripcionUso: '',
  temporalidad: 'trabajo' as 'dias' | 'trabajo', dias: 1,
  cantidadCuerpos: 5, fechaConstruccion: hoyISO(),
  estadoTarjeta: 'Verde' as EstadoTarjeta, inspeccionadoPor: '', proximaInspeccion: '',
  subsecuenteGenerado: false, correoRespaldo: '',
}

export default function AndamioForm({ onSaved, onCrearSubsecuente }: { onSaved: () => void; onCrearSubsecuente: () => void }) {
  const [f, setF] = useState({ ...vacio })
  const [fotosAndamio, setFotosAndamio] = useState<string[]>([])
  const [fotosTarjeta, setFotosTarjeta] = useState<string[]>([])
  const [folio, setFolio] = useState('…')
  const [errores, setErrores] = useState<string[]>([])

  useEffect(() => { generarFolioAndamio().then(setFolio) }, [])

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  const cargarFotos = async (files: FileList | null, set: (u: (p: string[]) => string[]) => void) => {
    if (!files) return
    const nuevas: string[] = []
    for (const file of Array.from(files)) nuevas.push(await fileToJpeg(file))
    set((p) => [...p, ...nuevas])
  }

  const validar = (): boolean => {
    const e: string[] = []
    if (!f.lugar) e.push('Lugar')
    if (!f.descripcionUso.trim()) e.push('Descripción de uso')
    if (!f.cantidadCuerpos) e.push('Cantidad de cuerpos')
    setErrores(e)
    return e.length === 0
  }

  const guardar = async (generar: boolean) => {
    if (!validar()) return
    const andamio: Andamio = {
      ...f,
      id: uuid(),
      folio,
      fotosAndamio,
      fotosTarjeta,
      creadoPor: CREADO_POR,
      createdAt: Date.now(),
      sincronizado: false,
    }
    await db.andamios.add(andamio)
    if (generar) generarPDFAndamio(andamio)
    setF({ ...vacio, fechaConstruccion: hoyISO() })
    setFotosAndamio([]); setFotosTarjeta([]); setErrores([])
    setFolio(await generarFolioAndamio())
    onSaved()
  }

  return (
    <div className="form">
      <div className="folio-bar">
        <span>Folio <b>{folio}</b></span>
        <span className="off-mini">borrador local</span>
      </div>

      {errores.length > 0 && (
        <div className="banner err">Faltan campos obligatorios: {errores.join(', ')}</div>
      )}

      <div className="sec">Lugar y uso</div>
      <label className="lab">Lugar / zona <span className="req">*</span></label>
      <select value={f.lugar} onChange={(e) => set('lugar', e.target.value)}>
        <option value="">Seleccionar zona…</option>
        {ZONAS.map((z) => <option key={z}>{z}</option>)}
      </select>
      <label className="lab" style={{ marginTop: 10 }}>Equipo / área específica</label>
      <input value={f.equipo} onChange={(e) => set('equipo', e.target.value)} placeholder="Ej: Vasija Rack 12" />
      <label className="lab" style={{ marginTop: 10 }}>Descripción para el uso del andamio <span className="req">*</span></label>
      <textarea rows={3} value={f.descripcionUso} onChange={(e) => set('descripcionUso', e.target.value)} placeholder="¿Para qué se monta el andamio?" />

      <div className="sec">Andamio</div>
      <label className="lab">Temporalidad</label>
      <div className="seg">
        <button type="button" className={f.temporalidad === 'dias' ? 'on' : ''} onClick={() => set('temporalidad', 'dias')}>Por días</button>
        <button type="button" className={f.temporalidad === 'trabajo' ? 'on' : ''} onClick={() => set('temporalidad', 'trabajo')}>Solo por el trabajo</button>
      </div>
      {f.temporalidad === 'dias' && (
        <>
          <label className="lab" style={{ marginTop: 10 }}>Cantidad de días</label>
          <input type="number" min={1} value={f.dias} onChange={(e) => set('dias', Number(e.target.value))} />
        </>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="lab">Cantidad de cuerpos <span className="req">*</span></label>
          <input type="number" min={1} value={f.cantidadCuerpos} onChange={(e) => set('cantidadCuerpos', Number(e.target.value))} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="lab">Fecha de construcción</label>
          <input type="date" value={f.fechaConstruccion} onChange={(e) => set('fechaConstruccion', e.target.value)} />
        </div>
      </div>

      <div className="sec">Tarjeta de andamio</div>
      <label className="lab">Estado</label>
      <div className="seg tarjeta">
        {ESTADOS.map((es) => (
          <button key={es} type="button" className={(f.estadoTarjeta === es ? 'on ' : '') + ESTADO_CLASE[es]} onClick={() => set('estadoTarjeta', es)}>{es}</button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <div style={{ flex: 1 }}>
          <label className="lab">Inspeccionado por</label>
          <input value={f.inspeccionadoPor} onChange={(e) => set('inspeccionadoPor', e.target.value)} placeholder="Prevención / supervisor" />
        </div>
        <div style={{ flex: 1 }}>
          <label className="lab">Próx. inspección</label>
          <input type="date" value={f.proximaInspeccion} onChange={(e) => set('proximaInspeccion', e.target.value)} />
        </div>
      </div>

      <div className="sec">Evidencia</div>
      <label className="btn ev">
        📷 Foto del andamio
        <input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => cargarFotos(e.target.files, setFotosAndamio)} />
      </label>
      {fotosAndamio.length > 0 && (
        <div className="thumbs">
          {fotosAndamio.map((src, i) => (
            <div className="thumb" key={i}><img src={src} alt={`andamio ${i + 1}`} /><button type="button" onClick={() => setFotosAndamio((p) => p.filter((_, j) => j !== i))}>✕</button></div>
          ))}
        </div>
      )}
      <label className="btn ev" style={{ marginTop: 10 }}>
        🪪 Foto de la tarjeta del andamio
        <input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => cargarFotos(e.target.files, setFotosTarjeta)} />
      </label>
      {fotosTarjeta.length > 0 && (
        <div className="thumbs">
          {fotosTarjeta.map((src, i) => (
            <div className="thumb" key={i}><img src={src} alt={`tarjeta ${i + 1}`} /><button type="button" onClick={() => setFotosTarjeta((p) => p.filter((_, j) => j !== i))}>✕</button></div>
          ))}
        </div>
      )}

      <div className="sec">Aviso subsecuente</div>
      <label className="lab">¿Se generó el aviso subsecuente?</label>
      <div className="seg">
        <button type="button" className={f.subsecuenteGenerado ? 'on' : ''} onClick={() => set('subsecuenteGenerado', true)}>Sí</button>
        <button type="button" className={!f.subsecuenteGenerado ? 'on' : ''} onClick={() => set('subsecuenteGenerado', false)}>No</button>
      </div>
      {!f.subsecuenteGenerado && (
        <button type="button" className="btn add" style={{ marginTop: 10 }} onClick={onCrearSubsecuente}>+ Crear subsecuente (nuevo aviso)</button>
      )}

      <div className="sec">Cierre</div>
      <label className="lab">Correo de respaldo</label>
      <input type="email" value={f.correoRespaldo} onChange={(e) => set('correoRespaldo', e.target.value)} placeholder="correo@united.cl" />
      <div className="cc-note">✉️ Siempre con copia a brayan.villalobos.c@gmail.com</div>

      <div className="actions">
        <button type="button" className="btn secondary" onClick={() => guardar(false)}>Guardar</button>
        <button type="button" className="btn primary" onClick={() => guardar(true)}>Guardar y generar PDF</button>
      </div>
    </div>
  )
}
