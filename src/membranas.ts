// Las 7 membranas de una vasija: qué va en cada posición y cómo se guardan.
//
// Viene del escáner de membranas de United (escaner-membranas.pages.dev), que
// registraba el recambio en una app aparte. Acá entra dentro del outage: el
// carguío de membrana deja de ser "hecho / no hecho" y pasa a guardar la serie
// de cada membrana, escaneada con la cámara.
//
// Las membranas se retiran por el lado Cerro (rechazo) y se instalan desde el
// lado Mar (alimentación): primero las cuatro C6 y después las tres C5. Por eso
// el escaneo avanza de la posición 7 a la 1.

export type TipoMembrana = 'C5' | 'C6'
/** 19-10-2026, Brayan: "son todas Hydranautics, así que elimina la LG". El
    escáner de Axel traía LG y Hydranautics; en la base no había ninguna LG
    (Rack 3: 289 vasijas Hydranautics). Si algún día vuelve otra marca, se
    agrega acá, en MODELOS y en MARCAS, y la pantalla vuelve a mostrar el
    selector solo (aparece cuando hay más de una). */
export type MarcaMembrana = 'HYDRANAUTICS'

/** En el orden en que se instalan y se escanean. */
export const POSICIONES = [7, 6, 5, 4, 3, 2, 1]
export const MEMBRANAS_POR_VASIJA = POSICIONES.length

export function tipoDePosicion(pos: number): TipoMembrana {
  return pos >= 4 ? 'C6' : 'C5'
}

export interface ModeloMembrana {
  codigo: string
  marca: MarcaMembrana
  tipo: TipoMembrana
}

/** Los modelos Hydranautics del catálogo del escáner (`schema.sql`). */
export const MODELOS: ModeloMembrana[] = [
  { codigo: 'SWC6-LD', marca: 'HYDRANAUTICS', tipo: 'C6' },
  { codigo: 'SWC5-LD', marca: 'HYDRANAUTICS', tipo: 'C5' },
]

export const MARCAS: { codigo: MarcaMembrana; nombre: string }[] = [
  { codigo: 'HYDRANAUTICS', nombre: 'Hydranautics' },
]

export function modelosDe(marca: MarcaMembrana, tipo: TipoMembrana): ModeloMembrana[] {
  return MODELOS.filter((m) => m.marca === marca && m.tipo === tipo)
}

export function modeloPorDefecto(marca: MarcaMembrana, pos: number): string {
  return modelosDe(marca, tipoDePosicion(pos))[0]?.codigo ?? ''
}

/** Una membrana ya registrada en una posición. */
export type MembranaReg = {
  serie: string
  modelo?: string
  /** Cómo entró la serie: leída con la cámara o escrita a mano. */
  metodo?: 'camara' | 'manual'
  formato?: string
  quien?: string
  ts?: number
}

/** `datos` de la vasija dentro de `avance_item`. Va como `type` y no como
    `interface` para que entre en el `datos: Record<string, unknown>`. */
export type DatosMembranas = {
  marca?: MarcaMembrana
  supervisor?: string
  observacion?: string
  /** Clave: la posición, '1' a '7'. */
  membranas?: Record<string, MembranaReg>
}

export const MARCA_POR_DEFECTO: MarcaMembrana = 'HYDRANAUTICS'

export function membranaEn(d: DatosMembranas, pos: number): MembranaReg | undefined {
  return d.membranas?.[String(pos)]
}

export function puestas(d: DatosMembranas): number {
  return POSICIONES.filter((p) => membranaEn(d, p)?.serie).length
}

export function completa(d: DatosMembranas): boolean {
  return puestas(d) === MEMBRANAS_POR_VASIJA
}

/** La siguiente posición sin membrana, en orden de instalación (7 → 1). */
export function siguientePosicion(d: DatosMembranas): number | null {
  return POSICIONES.find((p) => !membranaEn(d, p)?.serie) ?? null
}

/** Escribe una serie en una posición. Devuelve los datos nuevos, sin tocar los
    de entrada: el llamador los guarda dentro de su transacción. */
export function conMembrana(
  d: DatosMembranas, pos: number, reg: MembranaReg | null,
): DatosMembranas {
  const membranas = { ...(d.membranas ?? {}) }
  if (reg) membranas[String(pos)] = reg
  else delete membranas[String(pos)]
  return { ...d, membranas }
}

/** Serie ya usada en otra vasija: dos membranas no pueden tener el mismo
    número. Devuelve la vasija donde está, o null. */
export function vasijaConLaSerie(
  serie: string, porVasija: Map<string, DatosMembranas>, exceptoVasija: string,
): string | null {
  const limpia = serie.trim().toUpperCase()
  for (const [vasija, d] of porVasija) {
    if (vasija === exceptoVasija) continue
    for (const p of POSICIONES) {
      if (membranaEn(d, p)?.serie.trim().toUpperCase() === limpia) return vasija
    }
  }
  return null
}
