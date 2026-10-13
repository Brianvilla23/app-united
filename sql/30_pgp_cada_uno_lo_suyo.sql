-- App United — migración 30: cada supervisor ve SOLO su PGP.
-- Correr en Supabase → SQL Editor → Run. Idempotente.
--
-- Brayan, 13-10-2026: "no debe ver nadie más lo del PGP". Hasta la 29 todo
-- supervisor veía lo de todos. Ahora:
--  · cada fila lleva `autor` = la cuenta que la cargó. Lo pone la BASE
--    (default auth.uid() + with check), no el celular: no se puede cargar a
--    nombre de otro;
--  · un supervisor lee y borra (24 h) solo lo suyo;
--  · planificación (es_editor_plan) ve y borra todo, para controlar.
-- Las fotos del bucket usan `owner_id`, que Storage llena solo con la cuenta
-- que subió el archivo.
-- Al aplicarla no había ninguna fila cargada.
alter table public.pgp_imagenes
  add column if not exists autor uuid not null default auth.uid();

create index if not exists pgp_imagenes_autor_idx on public.pgp_imagenes (autor, dia);

drop policy if exists pgp_leer   on public.pgp_imagenes;
drop policy if exists pgp_cargar on public.pgp_imagenes;
drop policy if exists pgp_borrar on public.pgp_imagenes;

create policy pgp_leer on public.pgp_imagenes
  for select to authenticated
  using ((autor = auth.uid() and public.es_supervisor()) or public.es_editor_plan());
create policy pgp_cargar on public.pgp_imagenes
  for insert to authenticated
  with check (autor = auth.uid() and (public.es_supervisor() or public.es_editor_plan()));
create policy pgp_borrar on public.pgp_imagenes
  for delete to authenticated
  using ((autor = auth.uid() and public.es_supervisor() and creado_en > now() - interval '24 hours')
         or public.es_editor_plan());

drop policy if exists pgp_fotos_leer   on storage.objects;
drop policy if exists pgp_fotos_subir  on storage.objects;
drop policy if exists pgp_fotos_borrar on storage.objects;

create policy pgp_fotos_leer on storage.objects
  for select to authenticated
  using (bucket_id = 'adjuntos' and name like 'pgp/%'
         and ((owner_id = auth.uid()::text and public.es_supervisor()) or public.es_editor_plan()));
create policy pgp_fotos_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'adjuntos' and name like 'pgp/%' and (public.es_supervisor() or public.es_editor_plan()));
create policy pgp_fotos_borrar on storage.objects
  for delete to authenticated
  using (bucket_id = 'adjuntos' and name like 'pgp/%'
         and ((owner_id = auth.uid()::text and public.es_supervisor() and created_at > now() - interval '24 hours')
              or public.es_editor_plan()));
