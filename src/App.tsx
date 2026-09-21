import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { iniciarSync } from './sync'
import { quienSoy, guardarQuienSoy } from './identidad'
import {
  ModoContexto, NOMBRE_MODO, guardarModo, modoGuardado, type ModoUso,
} from './permisos'
import { cerrarCapaDeArriba, empujarCapa, volver } from './navegacion'
import AvisoForm from './AvisoForm'
import AndamioForm from './AndamioForm'
import Guardados from './Guardados'
import Fugas from './Fugas'
import Outage from './Outage'
import Venteos from './Venteos'
import PlanoActividad from './PlanoActividad'
import Pruebas from './Pruebas'
import Pasos from './Pasos'
import type { Actividad } from './actividades'
import { OUTAGE_ACTIVO, outageDe, type Outage as OutageDef } from './racks'
import { fechaLarga } from './fecha'

type Vista = 'menu' | 'aviso' | 'andamio' | 'fugas' | 'tapas' | 'outage' | 'venteos' | 'actividad' | 'prueba' | 'pasos' | 'guardados'

/** Pantallas a las que solo se entra desde una actividad del outage: el rótulo
    del atrás lleva el nombre de la actividad y no el genérico de la pantalla. */
const VISTAS_DE_ACTIVIDAD: Vista[] = ['tapas', 'actividad', 'prueba', 'venteos', 'pasos']

const TITULOS: Record<Vista, string> = {
  menu: 'App United',
  aviso: 'Nuevo aviso',
  andamio: 'Levantamiento de andamio',
  fugas: 'Diagrama de fugas',
  tapas: 'Estado de tapas',
  outage: 'Outage',
  venteos: 'Cambio de venteos',
  actividad: 'Actividad del outage',
  prueba: 'Prueba de presión',
  pasos: 'Pasos de la actividad',
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

function QuienEres({
  inicial, modoInicial, onListo,
}: {
  inicial: string
  modoInicial: ModoUso
  onListo: (n: string, m: ModoUso) => void
}) {
  const [nombre, setNombre] = useState(inicial)
  const [modo, setModo] = useState<ModoUso>(modoInicial)
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
        onKeyDown={(e) => { if (e.key === 'Enter' && valido) onListo(nombre, modo) }}
      />

      <div className="modo-elige">
        <b>¿Qué vas a hacer?</b>
        <button className={modo === 'ver' ? 'on' : ''} onClick={() => setModo('ver')}>
          <span>Solo mirar</span>
          <small>Ves el avance y descargas los PDF, pero no puedes cambiar nada</small>
        </button>
        <button className={modo === 'editar' ? 'on' : ''} onClick={() => setModo('editar')}>
          <span>Registrar avance</span>
          <small>Marcas tapas, manifolds, fugas y venteos</small>
        </button>
      </div>

      <button className="btn primary" disabled={!valido} onClick={() => onListo(nombre, modo)}>
        Continuar
      </button>
    </div>
  )
}

function Menu({ go, outage }: { go: (v: Vista) => void; outage: OutageDef }) {
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
        <button className="menu-card" onClick={() => go('outage')}>
          <span className="mc-ico" style={{ background: 'rgba(37,99,235,.1)' }}>🗓️</span>
          <span className="mc-txt">
            <b>Outage Rack {outage.rack}</b>
            <small>{outage.alcance} · {outage.actividades.length} actividades</small>
          </span>
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
  // Qué outage se está mirando. Arranca en el que está en curso (Rack 3); el
  // selector de la pantalla del outage permite volver al 12 para consultarlo.
  const [rackOutage, setRackOutage] = useState(OUTAGE_ACTIVO.rack)
  const outage = outageDe(rackOutage)

  // De dónde se vino, en el momento de entrar. Va en un ref porque el cierre de
  // la capa se guarda al navegar y tiene que ver la pantalla de ESE momento,
  // no la que quede después.
  const vistaRef = useRef<Vista>('menu')
  vistaRef.current = vista

  /** Cada pantalla empuja su propia capa: así el atrás desanda de a una y no
      se salta niveles ni se queda pegado. */
  const irA = (v: Vista) => {
    const anterior = vistaRef.current
    setVista(v)
    empujarCapa(() => setVista(anterior))
  }

  useEffect(() => {
    const alVolver = () => { cerrarCapaDeArriba() }
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [])
  const [yo, setYo] = useState(quienSoy())
  const [modo, setModo] = useState<ModoUso>(modoGuardado())
  const [editandoNombre, setEditandoNombre] = useState(false)
  useEffect(() => { iniciarSync() }, [])

  const confirmarNombre = (n: string, m: ModoUso) => {
    guardarQuienSoy(n)
    guardarModo(m)
    setYo(quienSoy())
    setModo(m)
    setEditandoNombre(false)
  }

  if (!yo || editandoNombre) {
    return (
      <div className="app">
        <header className="topbar">
          <Marca />
        </header>
        <main className="main">
          <QuienEres inicial={yo} modoInicial={modo} onListo={confirmarNombre} />
        </main>
      </div>
    )
  }

  return (
    <ModoContexto value={modo}>
    <div className="app">
      <header className="topbar">
        {vista === 'menu' ? (
          <Marca />
        ) : (
          <button className="back" onClick={volver}>
            ‹ {actAbierta && VISTAS_DE_ACTIVIDAD.includes(vista)
              ? actAbierta.nombre
              : vista === 'outage' ? `Outage Rack ${outage.rack}` : TITULOS[vista]}
          </button>
        )}
        <OfflineDot />
      </header>
      <div className={'quien-bar' + (modo === 'ver' ? ' mirando' : '')}>
        <span>
          <b>{NOMBRE_MODO[modo]}</b> · {yo}
        </span>
        <button onClick={() => setEditandoNombre(true)}>cambiar</button>
      </div>
      <main className="main">
        {vista === 'menu' && <Menu go={irA} outage={outage} />}
        {vista === 'aviso' && <AvisoForm onSaved={() => irA('guardados')} />}
        {vista === 'andamio' && <AndamioForm onSaved={() => irA('guardados')} onCrearSubsecuente={() => irA('aviso')} />}
        {vista === 'fugas' && <Fugas />}
        {vista === 'tapas' && <Fugas modoInicial="tapas" rackTapas={rackOutage}
          actividad={actAbierta?.tipo === 'tapa' ? actAbierta.id : 'retiro_tapas_alim'}
          titulo={actAbierta?.tipo === 'tapa' ? actAbierta.nombre.toUpperCase() : undefined}
          ladoFijo={actAbierta?.tipo === 'tapa' ? actAbierta.lados[0] : undefined} />}
        {vista === 'outage' && <Outage
          outage={outage}
          onCambiarRack={setRackOutage}
          onAbrir={(a: Actividad) => {
            setActAbierta(a)
            irA(a.tipo === 'tapa' ? 'tapas'
              : a.tipo === 'venteo' ? 'venteos'
              : a.tipo === 'fugas' ? 'prueba'
              : a.tipo === 'pasos' ? 'pasos'
              : 'actividad')
          }} />}
        {vista === 'venteos' && actAbierta && <Venteos actividad={actAbierta.id} rack={rackOutage} />}
        {vista === 'actividad' && actAbierta && <PlanoActividad actividad={actAbierta} rack={rackOutage} />}
        {vista === 'prueba' && actAbierta && <Pruebas actividad={actAbierta} rack={rackOutage} />}
        {vista === 'pasos' && actAbierta && <Pasos actividad={actAbierta} rack={rackOutage} />}
        {vista === 'guardados' && <Guardados />}
      </main>
      <footer className="app-foot">App United v0.2 · uso interno</footer>
    </div>
    </ModoContexto>
  )
}
