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

export function modoGuardado(): ModoUso {
  return localStorage.getItem(CLAVE) === 'editar' ? 'editar' : 'ver'
}

export function guardarModo(m: ModoUso): void {
  localStorage.setItem(CLAVE, m)
}

/** Por defecto se entra a mirar: para registrar hay que elegirlo. */
export const ModoContexto = createContext<ModoUso>('ver')

export function usePuedeEditar(): boolean {
  return useContext(ModoContexto) === 'editar'
}

export const NOMBRE_MODO: Record<ModoUso, string> = {
  ver: 'Solo lectura',
  editar: 'Registrando',
}
