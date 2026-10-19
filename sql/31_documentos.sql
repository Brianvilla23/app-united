-- App United — migración 31: check list y documentos del contrato CC6001.
--
-- 18-10-2026, Brayan: "en la carpeta de supervisores se debe agregar los check
-- list, esto que realizó mi colega". El colega (Axel) tiene publicado
-- registros-cc6001.pages.dev: check list, protocolos, BOS y declaraciones en
-- PDF, que administra desde su propio panel.
--
-- La app NO copia el catálogo a mano: la función `sincronizar-documentos`
-- (supabase/functions) lee el catálogo de Axel (documents.json + lo que subió,
-- editó o borró en su panel) y lo deja acá: la fila en `documentos` y el PDF en
-- el bucket privado `adjuntos`, bajo `documentos/`. Corre sola una vez al día y
-- planificación la puede correr con un botón. Así Axel sigue siendo el dueño y
-- la app tiene su copia, que funciona aunque su sitio se caiga.
--
-- Solo supervisión y planificación leen (la carpeta pide cuenta): el repo y la
-- app son públicos y estos son procedimientos internos del contrato.
-- Nadie escribe desde la app: solo la función, con la clave de servicio.

create table if not exists public.documentos (
  id               text primary key,          -- el id del catálogo de Axel
  categoria        text not null,             -- checklist | protocolo | bos | declaracion | otros | …
  categoria_nombre text not null,
  categoria_orden  integer not null default 500,
  codigo           text not null default '',
  nombre           text not null,
  ruta             text not null,             -- dentro del bucket adjuntos
  kb               integer not null default 0,
  version          text not null,             -- cambia si el PDF cambió: se vuelve a bajar
  fuente           text not null,             -- de dónde se bajó
  actualizado      timestamptz not null default now()
);

alter table public.documentos enable row level security;

drop policy if exists documentos_leer on public.documentos;
create policy documentos_leer on public.documentos
  for select to authenticated using (public.es_supervisor() or public.es_editor_plan());

drop policy if exists documentos_pdf_leer on storage.objects;
create policy documentos_pdf_leer on storage.objects
  for select to authenticated
  using (bucket_id = 'adjuntos' and name like 'documentos/%' and (public.es_supervisor() or public.es_editor_plan()));

-- La sincronización diaria: pg_cron llama a la función con un token que vive
-- solo en el Vault (`sync_documentos`, generado acá: nadie lo copia a ningún
-- lado). La función lo valida preguntándole a la base con
-- `token_sync_documentos_valido`, que solo puede llamar la clave de servicio.
-- 07:30 UTC = 04:30 de Chile en verano.
create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'sync_documentos') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'sync_documentos',
      'Token de pg_cron para la función sincronizar-documentos (sql/31)');
  end if;
end $$;

create or replace function public.token_sync_documentos_valido(t text) returns boolean
language sql security definer set search_path = '' stable as $$
  select coalesce(t <> '' and t = (select decrypted_secret from vault.decrypted_secrets
                                   where name = 'sync_documentos'), false)
$$;
revoke all on function public.token_sync_documentos_valido(text) from public, anon, authenticated;
grant execute on function public.token_sync_documentos_valido(text) to service_role;

select cron.schedule('sincronizar-documentos', '30 7 * * *', $$
  select net.http_post(
    url := 'https://egxgxejgcohzwuoqhald.supabase.co/functions/v1/sincronizar-documentos',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-sync-token', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_documentos')),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000)
$$);
