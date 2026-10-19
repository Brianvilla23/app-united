// Función de Supabase "sincronizar-documentos" — RETIRADA el 18-10-2026.
//
// Copiaba a la app el catálogo de check list que Axel publicaba en
// registros-cc6001.pages.dev (ver sql/31). Ese mismo día Axel avisó que iba a
// borrar su sitio: si esto siguiera corriendo, lo que él borrara se borraría
// también acá. Se apagó la tarea de pg_cron y la copia de la app pasó a ser la
// oficial: planificación la administra desde la app (sql/32).
//
// Queda publicada solo para responder que ya no se usa (un celular con la
// versión vieja de la app todavía podría llamarla). La versión que copiaba
// está en el historial de git (commit 17b42ce).
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  return new Response(JSON.stringify({
    error: 'Los documentos ya no se traen del sitio de Axel: se administran desde la app.',
  }), { status: 410, headers: { ...CORS, 'Content-Type': 'application/json' } })
})
