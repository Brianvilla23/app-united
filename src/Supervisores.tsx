// La carpeta de supervisión: todo lo del turno en un solo lugar.
//
// ⚠️ Todavía entra sin cuenta, como el resto de terreno: cuando existan las
// cuentas de supervisores, esta carpeta las pide.
export type DestinoSupervisores = 'entrega' | 'fugas' | 'andamio' | 'pgp'

const TARJETAS: { destino: DestinoSupervisores; icono: string; nombre: string; bajada: string; color: string }[] = [
  { destino: 'entrega', icono: '📝', nombre: 'Entrega de turno', bajada: 'Formato PYC-EG-MEL-6001-01 · Excel y PDF', color: 'amber' },
  { destino: 'pgp', icono: '🦺', nombre: 'PGP', bajada: 'Charla, fatiga, equipos y cartilla CIS · 7 días', color: 'rojo' },
  { destino: 'fugas', icono: '💧', nombre: 'Diagrama de fugas', bajada: 'Marcar y editar fugas por rack', color: 'blue' },
  { destino: 'andamio', icono: '🏗️', nombre: 'Levantamiento de andamio', bajada: 'Acta + tarjeta de andamio', color: 'amber' },
]

export default function Supervisores({ go }: { go: (d: DestinoSupervisores) => void }) {
  return (
    <div>
      <div className="plano-titulo">
        <b>SUPERVISORES</b>
        <span>ENTREGA DE TURNO · PGP · FUGAS · ANDAMIOS</span>
      </div>
      <div className="menu-grid">
        {TARJETAS.map((t) => (
          <button key={t.destino} className="menu-card" onClick={() => go(t.destino)}>
            <span className={`mc-ico ${t.color}`}>{t.icono}</span>
            <span className="mc-txt"><b>{t.nombre}</b><small>{t.bajada}</small></span>
            <span className="mc-arrow">›</span>
          </button>
        ))}
      </div>
    </div>
  )
}
