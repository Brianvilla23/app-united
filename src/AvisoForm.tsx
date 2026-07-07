import { useEffect, useState } from 'react'
import { db, generarFolio } from './db'
import { generarPDF } from './pdf'
import { ZONAS, TIPOS_AVISO, PRIORIDADES, MODOS_FALLA } from './types'
import type { Aviso, MaterialItem, Prioridad } from './types'

const CREADO_POR = 'B. Villalobos'
const hoyISO = () => new Date().toISOString().slice(0, 10)

function uuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c && typeof c.randomUUID === 'function') {
    try { return c.randomUUID() } catch { /* contexto no seguro (http en celular) */ }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    const v = ch === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function mejorarRedaccion(t: string): string {
  let s = t.trim().replace(/\s+/g, ' ')
  if (!s) return s
  s = s.replace(/(^|[.!?]\s+)([a-záéíóúñü])/g, (_, p, c) => p + c.toUpperCase())
  if (!/[.!?]$/.test(s)) s += '.'
  return s
}

function fileToJpeg(file: File, maxSize = 1200, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let { width, height } = img
      if (width > height && width > maxSize) { height = (height * maxSize) / width; width = maxSize }
      else if (height > maxSize) { width = (width * maxSize) / height; height = maxSize }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = url
  })
}

const vacio = {
  titulo: '', tipo: TIPOS_AVISO[0], prioridad: 'Media' as Prioridad, zona: '', equipo: '',
  descripcion: '', modoFalla: '', dotacion: 1, horas: 1, detencion: false,
  fechaTrabajo: hoyISO(), hse: '', correoRespaldo: '',
}

export default function AvisoForm({ onSaved }: { onSaved: () => void }) {
  const [f, setF] = useState({ ...vacio })
  const [materiales, setMateriales] = useState<MaterialItem[]>([])
  const [fotos, setFotos] = useState<string[]>([])
  const [folio, setFolio] = useState('…')
  const [errores, setErrores] = useState<string[]>([])

  useEffect(() => { generarFolio().then(setFolio) }, [])

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  const onModoFalla = (codigo: string) => {
    set('modoFalla', codigo)
    const mf = MODOS_FALLA.find((m) => m.codigo === codigo)
    if (mf) setMateriales(mf.materiales.map((m) => ({ ...m })))
  }

  const addMaterial = () => setMateriales((p) => [...p, { nombre: '', codigoSap: '', cantidad: 1 }])
  const setMaterial = (i: number, patch: Partial<MaterialItem>) =>
    setMateriales((p) => p.map((m, j) => (j === i ? { ...m, ...patch } : m)))
  const delMaterial = (i: number) => setMateriales((p) => p.filter((_, j) => j !== i))

  const onFotos = async (files: FileList | null) => {
    if (!files) return
    const nuevas: string[] = []
    for (const file of Array.from(files)) nuevas.push(await fileToJpeg(file))
    setFotos((p) => [...p, ...nuevas])
  }

  const dictar = () => {
    const SR = (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
    const Rec = SR.SpeechRecognition || SR.webkitSpeechRecognition
    if (!Rec) { alert('Tu navegador no soporta dictado por voz. Probá en Chrome.'); return }
    const r = new Rec(); r.lang = 'es-CL'; r.interimResults = false
    r.onresult = (e: any) => {
      const texto = e.results[0][0].transcript
      setF((p) => ({ ...p, descripcion: (p.descripcion + ' ' + texto).trim() }))
    }
    r.start()
  }

  const modoFallaLabel = (codigo: string) => {
    const mf = MODOS_FALLA.find((m) => m.codigo === codigo)
    return mf ? `${mf.codigo} · ${mf.nombre}` : codigo
  }

  const validar = (): boolean => {
    const e: string[] = []
    if (!f.titulo.trim()) e.push('Título')
    if (!f.zona) e.push('Zona')
    if (!f.equipo.trim()) e.push('Equipo')
    if (!f.descripcion.trim()) e.push('Descripción')
    setErrores(e)
    return e.length === 0
  }

  const guardar = async (generar: boolean) => {
    if (!validar()) return
    const aviso: Aviso = {
      ...f,
      id: uuid(),
      folio,
      materiales,
      fotos,
      modoFalla: f.modoFalla ? modoFallaLabel(f.modoFalla) : '',
      estado: 'completo',
      creadoPor: CREADO_POR,
      createdAt: Date.now(),
      sincronizado: false,
    }
    await db.avisos.add(aviso)
    if (generar) generarPDF(aviso)
    setF({ ...vacio, fechaTrabajo: hoyISO() })
    setMateriales([]); setFotos([]); setErrores([])
    setFolio(await generarFolio())
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

      <div className="sec">Identificación</div>
      <label className="lab">Título de la actividad <span className="req">*</span></label>
      <input value={f.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Ej: Cambio de membranas — Rack 12" />

      <label className="lab">Tipo de aviso <span className="req">*</span></label>
      <select value={f.tipo} onChange={(e) => set('tipo', e.target.value)}>
        {TIPOS_AVISO.map((t) => <option key={t}>{t}</option>)}
      </select>

      <label className="lab">Prioridad <span className="req">*</span></label>
      <div className={'seg p-' + f.prioridad.toLowerCase()}>
        {PRIORIDADES.map((p) => (
          <button key={p} type="button" className={f.prioridad === p ? 'on' : ''} onClick={() => set('prioridad', p)}>{p}</button>
        ))}
      </div>

      <label className="lab">Zona <span className="req">*</span></label>
      <select value={f.zona} onChange={(e) => set('zona', e.target.value)}>
        <option value="">Seleccionar zona…</option>
        {ZONAS.map((z) => <option key={z}>{z}</option>)}
      </select>

      <label className="lab">Equipo / activo <span className="req">*</span></label>
      <input value={f.equipo} onChange={(e) => set('equipo', e.target.value)} placeholder="Ej: Vasija Protec BPV 8-1200" />

      <div className="sec">Descripción del aviso</div>
      <textarea rows={4} value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} placeholder="Describí el trabajo… o usá el dictado." />
      <div className="desc-tools">
        <button type="button" className="btn tool" onClick={() => set('descripcion', mejorarRedaccion(f.descripcion))}>✦ Mejorar redacción</button>
        <button type="button" className="btn tool" onClick={dictar}>🎤 Dictar</button>
      </div>
      <div className="hint">La mejora de redacción es básica por ahora; la IA completa se conecta en el siguiente paso.</div>

      <div className="sec">Materiales</div>
      <label className="lab">Modo de falla</label>
      <select value={f.modoFalla} onChange={(e) => onModoFalla(e.target.value)}>
        <option value="">Sin especificar</option>
        {MODOS_FALLA.map((m) => <option key={m.codigo} value={m.codigo}>{m.codigo} · {m.nombre}</option>)}
      </select>
      {f.modoFalla && <div className="hint">Materiales sugeridos según la falla. Editá lo que necesites.</div>}

      {materiales.map((m, i) => (
        <div className="mat-row" key={i}>
          <input className="mat-nom" value={m.nombre} onChange={(e) => setMaterial(i, { nombre: e.target.value })} placeholder="Material" />
          <input className="mat-sap" value={m.codigoSap} onChange={(e) => setMaterial(i, { codigoSap: e.target.value })} placeholder="Cód. SAP" />
          <input className="mat-cant" type="number" min={1} value={m.cantidad} onChange={(e) => setMaterial(i, { cantidad: Number(e.target.value) })} />
          <button type="button" className="mat-del" onClick={() => delMaterial(i)}>✕</button>
        </div>
      ))}
      <button type="button" className="btn add" onClick={addMaterial}>+ Agregar material</button>

      <div className="sec">Recursos y operación</div>
      <div className="row2">
        <div>
          <label className="lab">Dotación (personas)</label>
          <input type="number" min={1} value={f.dotacion} onChange={(e) => set('dotacion', Number(e.target.value))} />
        </div>
        <div>
          <label className="lab">Horas requeridas</label>
          <input type="number" min={1} value={f.horas} onChange={(e) => set('horas', Number(e.target.value))} />
        </div>
      </div>

      <label className="lab">¿Requiere detención del equipo?</label>
      <div className="seg warn">
        <button type="button" className={f.detencion ? 'on' : ''} onClick={() => set('detencion', true)}>Sí</button>
        <button type="button" className={!f.detencion ? 'on' : ''} onClick={() => set('detencion', false)}>No</button>
      </div>

      <label className="lab">Fecha del trabajo</label>
      <input type="date" value={f.fechaTrabajo} onChange={(e) => set('fechaTrabajo', e.target.value)} />

      <div className="sec">Seguridad (HSE)</div>
      <textarea rows={2} value={f.hse} onChange={(e) => set('hse', e.target.value)} placeholder="Consideraciones de seguridad…" />

      <div className="sec">Evidencia</div>
      <label className="btn ev">
        📷 Agregar foto / video
        <input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => onFotos(e.target.files)} />
      </label>
      {fotos.length > 0 && (
        <div className="thumbs">
          {fotos.map((src, i) => (
            <div className="thumb" key={i}>
              <img src={src} alt={`foto ${i + 1}`} />
              <button type="button" onClick={() => setFotos((p) => p.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
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
