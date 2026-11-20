// Dos modos de uso: quien solo mira y quien registra.
//
// ⚠️ Esto NO es seguridad. La app no tiene login, y la clave de Supabase va
// dentro del JS publicado, así que cualquiera que sepa lo que hace puede
// escribir igual. Lo que evita es lo que pasa de verdad en planta: que alguien
// que entró a mirar el avance toque una vasija sin querer y descuadre el rack.
// Seguridad de verdad recién hay cuando exista el módulo de login (RLS por
// `auth.uid()` en vez de acceso libre al rol anon).
import { createContext, useContext } from 'react'

export type ModoUso = 'ver' | 'editar'

const CLAVE = 'united_modo'

/** 20-11-2026 (Brayan): se sacó «Solo mirar». Todos entran a registrar,
    también los celulares que lo habían elegido antes. El modo 'ver' queda en
    el tipo por si vuelve, pero hoy ya no se ofrece. */
export function modoGuardado(): ModoUso {
  return 'editar'
}

export function guardarModo(m: ModoUso): void {
  localStorage.setItem(CLAVE, m)
}

export const ModoContexto = createContext<ModoUso>('editar')

export function usePuedeEditar(): boolean {
  return useContext(ModoContexto) === 'editar'
}

export const NOMBRE_MODO: Record<ModoUso, string> = {
  ver: 'Solo lectura',
  editar: 'Registrando',
}
