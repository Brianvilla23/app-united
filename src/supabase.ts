import { createClient } from '@supabase/supabase-js'

// Proyecto Supabase dedicado de App United (cuenta propia).
// Clave publicable (anon): diseñada para ir en el cliente; la seguridad la dan las políticas RLS.
// VITE_SIN_RED=1 (solo para probar en el computador): apunta a una dirección
// muerta para que nada de lo que se marque llegue a la base real de la cuadrilla.
const URL = import.meta.env.VITE_SIN_RED ? 'http://127.0.0.1:9' : 'https://egxgxejgcohzwuoqhald.supabase.co'
const PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVneGd4ZWpnY29oend1b3FoYWxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MTcwNDIsImV4cCI6MjEwMDQ5MzA0Mn0.joXXxtZKMNEzyb4i_czXVIPLBLKranurhcwSygxdSaw'

export const supabase = createClient(URL, PUBLISHABLE_KEY)
