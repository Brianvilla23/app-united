// Check list y documentos del contrato CC6001, dentro de la carpeta
// Supervisores. Nació como el sitio de Axel (registros-cc6001.pages.dev):
// buscador por código o nombre, pestañas por categoría, visor que muestra
// TODAS las páginas (en el celular el visor del navegador solo mostraba la
// primera) e impresión del documento completo, una hoja por página.
//
// Desde el 18-10-2026 el catálogo es de la app (Axel borra su sitio):
// planificación agrega, edita, reemplaza y borra desde acá, como hacía él en su
// panel.
import { useEffect, useRef, useState } from 'react'
import { soyEditor } from './planDatos'
import { useModal } from './useModal'
import {
  abrirPdf, agregarDocumento, borrarDocumento, buscar, categoriasDe, dibujarPagina, editarDocumento,
  guardadosEnCelular, guardarTodos, imprimir, pdfDe, traerCatalogo, catalogoGuardado,
  type Categoria, type DatosDocumento, type Documento, type PdfDoc,
} from './documentos'

const CATEGORIAS_BASE: { id: string; nombre: string; orden: number }[] = [
  { id: 'checklist', nombre: 'Check List', orden: 0 },
  { id: 'protocolo', nombre: 'Protocolos', orden: 1 },
  { id: 'bos', nombre: 'BOS', orden: 2 },
  { id: 'declaracion', nombre: 'Declaración', orden: 3 },
  { id: 'otros', nombre: 'Otros', orden: 999 },
]

/** Agregar (sin `doc`) o editar un documento. Solo planificación. */
function FichaDocumento({
  doc, categorias, onListo, onCerrar,
}: {
  doc: Documento | null
  categorias: Categoria[]
  onListo: (mensaje: string) => void
  onCerrar: () => void
}) {
  const opciones = [...CATEGORIAS_BASE]
  for (const c of categorias) if (!opciones.some((o) => o.id === c.id)) opciones.push({ id: c.id, nombre: c.nombre, orden: 500 })
  const [categoria, setCategoria] = useState(doc?.categoria ?? 'checklist')
  const [codigo, setCodigo] = useState(doc?.codigo ?? '')
  const [nombre, setNombre] = useState(doc?.nombre ?? '')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')

  const guardar = async () => {
    setError('')
    if (!nombre.trim()) { setError('Falta el nombre.'); return }
    if (!doc && !archivo) { setError('Falta elegir el PDF.'); return }
    const cat = opciones.find((o) => o.id === categoria)!
    const d: DatosDocumento = {
      categoria: cat.id, categoria_nombre: cat.nombre, categoria_orden: cat.orden,
      codigo: codigo.trim().toUpperCase(), nombre: nombre.trim(),
    }
    setTrabajando(true)
    try {
      if (doc) await editarDocumento(doc, d, archivo)
      else await agregarDocumento(archivo!, d)
      onListo(doc ? `Guardado: ${d.nombre}.` : `Agregado: ${d.nombre}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setTrabajando(false)
    }
  }

  const borrar = async () => {
    if (!doc || !confirm(`¿Borrar «${doc.nombre}»? Deja de verse en todos los celulares.`)) return
    setTrabajando(true)
    try {
      await borrarDocumento(doc)
      onListo(`Borrado: ${doc.nombre}.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar.')
      setTrabajando(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <b>{doc ? 'Editar documento' : 'Agregar documento'}</b>
          <button className="modal-x" onClick={onCerrar}>✕</button>
        </div>
        <label className="lab">Categoría</label>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          {opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
        <label className="lab">Código</label>
        <input value={codigo} placeholder="Ej: UPS-CH-MEL-6001-15 (opcional)" onChange={(e) => setCodigo(e.target.value)} />
        <label className="lab">Nombre</label>
        <input value={nombre} placeholder="Ej: Check List Rotomartillo" onChange={(e) => setNombre(e.target.value)} />
        <label className="lab">{doc ? 'Reemplazar el PDF (opcional)' : 'PDF'}</label>
        <input type="file" accept="application/pdf,.pdf" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
        {doc && <p className="hint">Si no eliges otro, queda el PDF actual ({doc.kb} KB).</p>}
        {error && <p className="memb-aviso">{error}</p>}
        <div className="row" style={{ gap: 8, marginTop: 14 }}>
          {doc && (
            <button className="btn sm ghost" disabled={trabajando} onClick={() => void borrar()}>Borrar</button>
          )}
          <button className="btn primary" disabled={trabajando} onClick={() => void guardar()}>
            {trabajando ? 'Guardando…' : doc ? 'Guardar' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Visor({ doc, onCerrar }: { doc: Documento; onCerrar: () => void }) {
  const hojas = useRef<HTMLDivElement>(null)
  const [estado, setEstado] = useState('Cargando documento…')
  const [paginas, setPaginas] = useState(0)
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null)
  const [imprimiendo, setImprimiendo] = useState(false)

  useEffect(() => {
    let vivo = true
    let pdf: PdfDoc | null = null
    void (async () => {
      try {
        const b = await pdfDe(doc)
        if (!vivo) return
        setBytes(b)
        pdf = await abrirPdf(b)
        if (!vivo) return
        setPaginas(pdf.numPages)
        setEstado('')
        const cont = hojas.current!
        const ancho = Math.max(300, Math.min(cont.clientWidth || 360, 1000))
        const densidad = Math.min(window.devicePixelRatio || 1, 2)
        for (let i = 1; i <= pdf.numPages && vivo; i++) {
          cont.appendChild(await dibujarPagina(pdf, i, ancho, densidad))
        }
      } catch (e) {
        if (vivo) setEstado(e instanceof Error ? e.message : 'No se pudo mostrar el documento.')
      }
    })()
    return () => { vivo = false; void pdf?.destroy() }
  }, [doc])

  const alImprimir = async () => {
    if (!bytes) return
    setImprimiendo(true)
    try { await imprimir(bytes) } catch { alert('No se pudo preparar la impresión.') } finally { setImprimiendo(false) }
  }

  return (
    <div className="doc-visor">
      <div className="doc-visor-head">
        <span className="doc-visor-tit">
          {doc.codigo && <small>{doc.codigo}</small>}
          <b>{doc.nombre}</b>
          {paginas > 0 && <small>{paginas} {paginas === 1 ? 'página' : 'páginas'}</small>}
        </span>
        <button className="btn sm" disabled={!bytes || imprimiendo} onClick={() => void alImprimir()}>
          {imprimiendo ? 'Preparando…' : 'Imprimir'}
        </button>
        <button className="modal-x" onClick={onCerrar} aria-label="Cerrar">✕</button>
      </div>
      <div className="doc-visor-hojas" ref={hojas}>
        {estado && <p className="doc-msg">{estado}</p>}
      </div>
    </div>
  )
}

export default function PanelDocumentos() {
  const [docs, setDocs] = useState<Documento[]>(catalogoGuardado)
  const [enLinea, setEnLinea] = useState(true)
  const [cargando, setCargando] = useState(true)
  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState<string | null>(null)
  // con useModal el botón atrás del celular cierra el visor y no la pantalla
  const [abierto, abrir, cerrar] = useModal<Documento>()
  const [guardados, setGuardados] = useState<Set<string>>(new Set())
  const [guardando, setGuardando] = useState<string>('')
  const [editor, setEditor] = useState(false)
  const [aviso, setAviso] = useState('')
  // null = agregar uno nuevo; un documento = editar ese
  const [ficha, abrirFicha, cerrarFicha] = useModal<{ doc: Documento | null }>()

  const recargar = async () => {
    const r = await traerCatalogo()
    setDocs(r.docs)
    setEnLinea(r.enLinea)
    setGuardados(await guardadosEnCelular(r.docs))
    setCargando(false)
  }

  useEffect(() => {
    void recargar()
    void soyEditor().then(setEditor).catch(() => setEditor(false))
  }, [])

  // al cerrar el visor, lo recién abierto ya quedó guardado en el celular
  useEffect(() => {
    if (!abierto) void guardadosEnCelular(docs).then(setGuardados)
  }, [abierto, docs])

  const categorias = categoriasDe(docs)
  const lista = buscar(docs, texto, categoria)
  const totalMB = docs.reduce((n, d) => n + d.kb, 0) / 1024
  const faltan = docs.length - guardados.size

  const alGuardarTodos = async () => {
    setAviso('')
    const fallas = await guardarTodos(docs, (h, t) => setGuardando(`Guardando ${h} de ${t}…`))
    setGuardando('')
    setGuardados(await guardadosEnCelular(docs))
    setAviso(fallas ? `${fallas} no se pudieron guardar (¿sin señal?). Vuelve a intentarlo.` : 'Listo: todos quedaron en el celular.')
  }

  const alTerminarFicha = async (mensaje: string) => {
    cerrarFicha()
    await recargar()
    setAviso(mensaje)
  }

  return (
    <div>
      <div className="plano-titulo">
        <b>CHECK LIST Y DOCUMENTOS</b>
        <span>CONTRATO CC6001 · VER E IMPRIMIR</span>
      </div>

      <input
        className="doc-buscar"
        type="search"
        value={texto}
        placeholder="Buscar por código o nombre"
        onChange={(e) => setTexto(e.target.value)}
      />

      <div className="doc-chips">
        <button className={categoria === null ? 'on' : ''} onClick={() => setCategoria(null)}>
          Todos <small>{docs.length}</small>
        </button>
        {categorias.map((c) => (
          <button key={c.id} className={categoria === c.id ? 'on' : ''} onClick={() => setCategoria(c.id)}>
            {c.nombre} <small>{c.cuantos}</small>
          </button>
        ))}
      </div>

      <div className="doc-estado">
        <span>
          {!enLinea && <b className="off-mini">Sin señal · </b>}
          {guardados.size} de {docs.length} guardados en el celular
        </span>
        {faltan > 0 && enLinea && !guardando && (
          <button className="btn sm ghost" onClick={() => void alGuardarTodos()}>
            Guardar todos ({totalMB.toFixed(0)} MB)
          </button>
        )}
      </div>
      {guardando && <p className="hint">{guardando}</p>}
      {aviso && <p className="hint">{aviso}</p>}

      {cargando && docs.length === 0 && <p className="hint">Cargando el catálogo…</p>}
      {!cargando && docs.length === 0 && (
        <p className="hint">No hay documentos. Si estás sin señal, entra una vez con señal para traer el catálogo.</p>
      )}
      {docs.length > 0 && lista.length === 0 && <p className="hint">Nada calza con «{texto}».</p>}

      <ul className="doc-lista">
        {lista.map((d) => (
          <li key={d.id} className="doc-fila">
            <button className="doc-item" onClick={() => abrir(d)}>
              <span className="doc-txt">
                {d.codigo && <small>{d.codigo}</small>}
                <b>{d.nombre}</b>
                <small>
                  {categoria === null && `${d.categoria_nombre} · `}{d.kb} KB
                  {guardados.has(d.id) && <span className="doc-ok"> · ✓ en el celular</span>}
                </small>
              </span>
              <span className="mc-arrow">›</span>
            </button>
            {editor && enLinea && (
              <button className="doc-editar" onClick={() => abrirFicha({ doc: d })} aria-label={`Editar ${d.nombre}`}>✎</button>
            )}
          </li>
        ))}
      </ul>

      {editor && (
        <div className="doc-pie">
          <button className="btn sm" disabled={!enLinea} onClick={() => abrirFicha({ doc: null })}>
            + Agregar documento
          </button>
          <p className="hint">Planificación administra el catálogo: agrega, edita (✎), reemplaza el PDF o lo borra.</p>
        </div>
      )}

      {ficha && (
        <FichaDocumento
          doc={ficha.doc}
          categorias={categorias}
          onListo={(m) => void alTerminarFicha(m)}
          onCerrar={cerrarFicha}
        />
      )}

      {abierto && <Visor doc={abierto} onCerrar={cerrar} />}
    </div>
  )
}
