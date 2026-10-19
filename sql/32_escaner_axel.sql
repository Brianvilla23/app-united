-- App United — migración 32: lo del escáner de Axel pasa a nuestra base.
--
-- 18-10-2026, Brayan: Axel va a borrar todo lo que construyó
-- (escaner-membranas.pages.dev y registros-cc6001.pages.dev), así que tiene
-- que quedar con nuestras credenciales.
--
-- 1) `escaner_axel`: los 293 registros de su escáner (D1 de Cloudflare), tal
--    cual venían de su API (`/api/registros?detalle=1`), con sus membranas.
--    289 son el carguío del Rack 3 (28 al 30-09, 2.023 membranas) y 4 son del
--    Rack 1 (24-09, pruebas de Ignacio Castro). Solo lectura: es el archivo.
--    Copia también en OneDrive\Escritorio\Claude\App_United\Respaldo_Axel_2026-10-18.
-- 2) Las series del Rack 3 se copian al carguío de la app (`avance_item`,
--    `carguio_membrana`, rack 3): así se ven por vasija y salen en el Excel.
--    `hecho` no se toca (las 295 ya estaban marcadas cargadas).
--
-- Los check list ya estaban copiados (sql/31). La sincronización diaria con el
-- sitio de Axel se apagó el 18-10 (cron.unschedule('sincronizar-documentos')):
-- si él borra, la corrida borraría acá. Desde ahora la copia de la app es la
-- oficial y planificación la administra desde la app.

create table if not exists public.escaner_axel (
  id         integer primary key,       -- el id del registro en su base
  planta     text not null,
  rack       integer not null,
  vasija     text not null,
  registro   jsonb not null,            -- el registro entero, con `membranas`
  importado  timestamptz not null default now()
);

alter table public.escaner_axel enable row level security;
drop policy if exists escaner_axel_leer on public.escaner_axel;
create policy escaner_axel_leer on public.escaner_axel
  for select to authenticated using (public.es_supervisor() or public.es_editor_plan());

-- Los check list: planificación los administra desde la app (antes lo hacía
-- Axel en su panel). Subir/cambiar/borrar el PDF y la fila.
drop policy if exists documentos_editar on public.documentos;
create policy documentos_editar on public.documentos
  for all to authenticated using (public.es_editor_plan()) with check (public.es_editor_plan());

drop policy if exists documentos_pdf_subir on storage.objects;
create policy documentos_pdf_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'adjuntos' and name like 'documentos/%' and public.es_editor_plan());
drop policy if exists documentos_pdf_cambiar on storage.objects;
create policy documentos_pdf_cambiar on storage.objects
  for update to authenticated
  using (bucket_id = 'adjuntos' and name like 'documentos/%' and public.es_editor_plan());
drop policy if exists documentos_pdf_borrar on storage.objects;
create policy documentos_pdf_borrar on storage.objects
  for delete to authenticated
  using (bucket_id = 'adjuntos' and name like 'documentos/%' and public.es_editor_plan());
