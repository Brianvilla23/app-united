import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { iniciarSync } from './sync'
import { seedTapasRack12 } from './seedTapas'
import { quienSoy, guardarQuienSoy } from './identidad'
import AvisoForm from './AvisoForm'
import AndamioForm from './AndamioForm'
import Guardados from './Guardados'
import Fugas from './Fugas'
import Outage from './Outage'
import Venteos from './Venteos'
import PlanoActividad from './PlanoActividad'
import Pruebas from './Pruebas'
import { ACTIVIDADES, type Actividad } from './actividades'
import { fechaLarga } from './fecha'

type Vista = 'menu' | 'aviso' | 'andamio' | 'fugas' | 'tapas' | 'outage' | 'venteos' | 'actividad' | 'prueba' | 'guardados'

const TITULOS: Record<Vista, string> = {
  menu: 'App United',
  aviso: 'Nuevo aviso',
  andamio: 'Levantamiento de andamio',
  fugas: 'Diagrama de fugas',
  tapas: 'Estado de tapas',
  outage: 'Outage Rack 12',
  venteos: 'Cambio de venteos',
  actividad: 'Actividad del outage',
  prueba: 'Prueba de presión',
  guardados: 'Guardados',
}

function OfflineDot() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  const pendientes = useLiveQuery(() => db.outbox.count(), []) ?? 0
  return (
    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {pendientes > 0 && <span className="net off">↑ {pendientes} por subir</span>}
      <span className={'net ' + (online ? 'on' : 'off')}>{online ? '● en línea' : '● offline'}</span>
    </span>
  )
}

// El logo real de United, extraído de la plantilla del programa semanal
// (`Plantilla_Maestra_MN55-M04.xls`). Va sobre una placa blanca porque el
// isotipo es rojo sobre blanco: sobre el azul de la barra el rojo queda apagado
// y la barra gris del logo desaparece.
function Marca() {
  return (
    <div className="brand">
      <img className="brand-logo" src="./united.png" alt="United" />
      <div><b>App United</b><small>Planta Desaladora · Coloso</small></div>
    </div>
  )
}

function QuienEres({ inicial, onListo }: { inicial: string; onListo: (n: string) => void }) {
  const [nombre, setNombre] = useState(inicial)
  const valido = nombre.trim().length >= 3

  return (
    <div className="quien-eres">
      <h2>¿Quién eres?</h2>
      <p>
        Tu nombre firma los avisos y actas que generes, y queda en el historial de cada
        tapa o fuga que marques. Se pregunta una sola vez en este celular.
      </p>
      <input
        autoFocus
        value={nombre}
        placeholder="Nombre y apellido"
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && valido) onListo(nombre) }}
      />
      <button className="btn primary" disabled={!valido} onClick={() => onListo(nombre)}>
        Continuar
      </button>
    </div>
  )
}

function Menu({ go }: { go: (v: Vista) => void }) {
  const nAvisos = useLiveQuery(() => db.avisos.count(), []) ?? 0
  const nAndamios = useLiveQuery(() => db.andamios.count(), []) ?? 0
  const fecha = fechaLarga()

  return (
    <div className="menu">
      <div className="hero">
        <div className="hero-date">{fecha}</div>
        <h1>¿Qué necesitas<br />registrar hoy?</h1>
      </div>

      <div className="menu-grid">
        <button className="menu-card destacada" onClick={() => go('aviso')}>
          <span className="mc-ico teal">📋</span>
          <span className="mc-txt"><b>Nuevo aviso</b><small>Informe técnico para la OT</small></span>
          <span className="mc-arrow">›</span>
        </button>
        <button className="menu-card" onClick={() => go('andamio')}>
          <span className="mc-ico amber">🏗️</span>
          <span className="mc-txt"><b>Levantamiento de andamio</b><small>Acta + tarjeta de andamio</small></span>
          <span className="mc-arrow">›</span>
        </button>
        <button className="menu-card" onClick={() => go('fugas')}>
          <span className="mc-ico blue">💧</span>
          <span className="mc-txt"><b>Diagrama de fugas</b><small>Marca fugas por vasija · lado alimentación</small></span>
          <span className="mc-arrow">›</span>
        </button>
        <button className="menu-card" onClick={() => go('tapas')}>
          <span className="mc-ico" style={{ background: 'rgba(225,29,29,.1)' }}>🔩</span>
          <span className="mc-txt"><b>Estado de tapas</b><small>Rack 12 · agripadas, pernos rodados, normalizadas</small></span>
          <span className="mc-arrow">›</span>
        </button>
        <button className="menu-card" onClick={() => go('outage')}>
          <span className="mc-ico" style={{ background: 'rgba(37,99,235,.1)' }}>🗓️</span>
          <span className="mc-txt"><b>Outage Rack 12</b><small>Secuencia completa · {ACTIVIDADES.length} actividades</small></span>
          <span className="mc-arrow">›</span>
        </button>
        <button className="menu-card" onClick={() => go('guardados')}>
          <span className="mc-ico slate">🗂️</span>
          <span className="mc-txt"><b>Guardados</b><small>{nAvisos + nAndamios} registros · PDF y respaldo</small></span>
          <span className="mc-arrow">›</span>
        </button>
      </div>

      <div className="stats">
        <div className="stat"><b>{nAvisos}</b><span>avisos</span></div>
        <div className="stat"><b>{nAndamios}</b><span>andamios</span></div>
      </div>

      <p className="menu-foot">Próximamente: entrega de turno · materiales por modo de falla</p>
    </div>
  )
}

export default function App() {
  const [vista, setVista] = useState<Vista>('menu')
  const [actAbierta, setActAbierta] = useState<Actividad | null>(null)
  // desde dónde se entró, para que el botón de atrás vuelva ahí y no al menú
  const [volverA, setVolverA] = useState<Vista>('menu')

  // El botón físico de atrás del teléfono cerraba la app en vez de volver a la
  // pantalla anterior. Cada navegación empuja una entrada al historial y el
  // popstate nos devuelve, así el gesto de atrás de Android funciona igual que
  // el botón de la barra.
  const irA = (v: Vista, desde: Vista = 'menu') => {
    setVolverA(desde)
    setVista(v)
    if (v !== 'menu') window.history.pushState({ vista: v }, '')
  }

  useEffect(() => {
    const alVolver = () => setVista((actual) => (actual === 'menu' ? 'menu' : volverA))
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [volverA])
  const [yo, setYo] = useState(quienSoy())
  const [editandoNombre, setEditandoNombre] = useState(false)
  useEffect(() => { iniciarSync(); void seedTapasRack12() }, [])

  const confirmarNombre = (n: string) => { guardarQuienSoy(n); setYo(quienSoy()); setEditandoNombre(false) }

  if (!yo || editandoNombre) {
    return (
      <div className="app">
        <header className="topbar">
          <Marca />
        </header>
        <main className="main"><QuienEres inicial={yo} onListo={confirmarNombre} /></main>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        {vista === 'menu' ? (
          <Marca />
        ) : (
          <button className="back" onClick={() => window.history.back()}>‹ {TITULOS[vista]}</button>
        )}
        <OfflineDot />
      </header>
      <div className="quien-bar">
        <span>Registrando como <b>{yo}</b></span>
        <button onClick={() => setEditandoNombre(true)}>cambiar</button>
      </div>
      <main className="main">
        {vista === 'menu' && <Menu go={(v) => irA(v, 'menu')} />}
        {vista === 'aviso' && <AvisoForm onSaved={() => setVista('guardados')} />}
        {vista === 'andamio' && <AndamioForm onSaved={() => setVista('guardados')} onCrearSubsecuente={() => setVista('aviso')} />}
        {vista === 'fugas' && <Fugas />}
        {vista === 'tapas' && <Fugas modoInicial="tapas" actividad={actAbierta?.tipo === 'tapa' ? actAbierta.id : 'retiro_tapas_alim'} titulo={actAbierta?.tipo === 'tapa' ? actAbierta.nombre.toUpperCase() : undefined}
          ladoFijo={actAbierta?.tipo === 'tapa' ? actAbierta.lados[0] : undefined} />}
        {vista === 'outage' && <Outage onAbrir={(a: Actividad) => {
          setActAbierta(a)
          irA(a.tipo === 'tapa' ? 'tapas'
            : a.tipo === 'venteo' ? 'venteos'
            : a.tipo === 'fugas' ? 'prueba'
            : 'actividad', 'outage')
        }} />}
        {vista === 'venteos' && <Venteos actividad="cambio_venteo" />}
        {vista === 'actividad' && actAbierta && <PlanoActividad actividad={actAbierta} />}
        {vista === 'prueba' && actAbierta && <Pruebas actividad={actAbierta} />}
        {vista === 'guardados' && <Guardados />}
      </main>
      <footer className="app-foot">App United v0.2 · uso interno</footer>
    </div>
  )
}
