// Check list y documentos del contrato CC6001, dentro de la carpeta
// Supervisores. Es el sitio de Axel (registros-cc6001.pages.dev) traído a la
// app: buscador por código o nombre, pestañas por categoría, visor que muestra
// TODAS las páginas (en el celular el visor del navegador solo mostraba la
// primera) e impresión del documento completo, una hoja por página.
//
// Axel sigue administrando el catálogo en su sitio; la base lo copia sola cada
// madrugada y planificación puede traerlo al tiro (`sincronizarAhora`).
import { useEffect, useRef, useState } from 'react'
import { soyEditor } from './planDatos'
import { useModal } from './useModal'
import {
  abrirPdf, buscar, categoriasDe, dibujarPagina, guardadosEnCelular, guardarTodos, imprimir,
  pdfDe, sincronizarAhora, traerCatalogo, catalogoGuardado, type Documento, type PdfDoc,
} from './documentos'

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

  const alSincronizar = async () => {
    setAviso('')
    setGuardando('Trayendo lo nuevo del sitio de Axel…')
    try {
      const r = await sincronizarAhora()
      await recargar()
      setAviso(r)
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'No se pudo actualizar.')
    } finally {
      setGuardando('')
    }
  }

  return (
    <div>
      <div className="plano-titulo">
        <b>CHECK LIST Y DOCUMENTOS</b>
        <span>CONTRATO CC6001 · CATÁLOGO DE AXEL</span>
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
          <li key={d.id}>
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
          </li>
        ))}
      </ul>

      {editor && (
        <div className="doc-pie">
          <button className="btn sm ghost" disabled={!!guardando} onClick={() => void alSincronizar()}>
            Traer lo nuevo del sitio de Axel
          </button>
          <p className="hint">Se actualiza solo cada madrugada. Esto es para no esperar.</p>
        </div>
      )}

      {abierto && <Visor doc={abierto} onCerrar={cerrar} />}
    </div>
  )
}
