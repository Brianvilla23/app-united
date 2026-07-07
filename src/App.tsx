import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { iniciarSync } from './sync'
import AvisoForm from './AvisoForm'
import AndamioForm from './AndamioForm'
import Guardados from './Guardados'
import Fugas from './Fugas'

type Vista = 'menu' | 'aviso' | 'andamio' | 'fugas' | 'guardados'

const TITULOS: Record<Vista, string> = {
  menu: 'App United',
  aviso: 'Nuevo aviso',
  andamio: 'Levantamiento de andamio',
  fugas: 'Diagrama de fugas',
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

function Menu({ go }: { go: (v: Vista) => void }) {
  const nAvisos = useLiveQuery(() => db.avisos.count(), []) ?? 0
  const nAndamios = useLiveQuery(() => db.andamios.count(), []) ?? 0
  const fecha = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="menu">
      <div className="hero">
        <div className="hero-date">{fecha}</div>
        <h1>¿Qué necesitás<br />registrar hoy?</h1>
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
          <span className="mc-txt"><b>Diagrama de fugas</b><small>Marcá fugas por vasija · lado alimentación</small></span>
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
  useEffect(() => { iniciarSync() }, [])
  return (
    <div className="app">
      <header className="topbar">
        {vista === 'menu' ? (
          <div className="brand">
            <img src="./favicon.png" alt="" width={30} height={30} style={{ borderRadius: 8 }} />
            <div><b>App United</b><small>Planta Desaladora · Coloso</small></div>
          </div>
        ) : (
          <button className="back" onClick={() => setVista('menu')}>‹ {TITULOS[vista]}</button>
        )}
        <OfflineDot />
      </header>
      <main className="main">
        {vista === 'menu' && <Menu go={setVista} />}
        {vista === 'aviso' && <AvisoForm onSaved={() => setVista('guardados')} />}
        {vista === 'andamio' && <AndamioForm onSaved={() => setVista('guardados')} onCrearSubsecuente={() => setVista('aviso')} />}
        {vista === 'fugas' && <Fugas />}
        {vista === 'guardados' && <Guardados />}
      </main>
      <footer className="app-foot">App United v0.2 · uso interno</footer>
    </div>
  )
}
