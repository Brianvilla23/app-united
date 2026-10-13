-- App United — migración 29: el PGP es solo de supervisión y planificación.
-- Correr en Supabase → SQL Editor → Run. Idempotente.
--
-- 13-10-2026: la carpeta Supervisores pasa a pedir cuenta sí o sí (Brayan:
-- "que ya no sea opcional sino que sea fijo"). La pantalla lo pide, pero lo
-- que manda es la base (poka-yoke): sin cuenta de supervisión o planificación
-- el PGP no se lee, no se carga y no se borra. Al aplicarla no había ninguna
-- foto cargada, así que no queda nada huérfano.
--
-- La regla de las 24 h para borrar se mantiene para supervisión; planificación
-- borra siempre.
drop policy if exists pgp_leer   on public.pgp_imagenes;
drop policy if exists pgp_cargar on public.pgp_imagenes;
drop policy if exists pgp_borrar on public.pgp_imagenes;

create policy pgp_leer on public.pgp_imagenes
  for select to authenticated using (public.es_supervisor() or public.es_editor_plan());
create policy pgp_cargar on public.pgp_imagenes
  for insert to authenticated with check (public.es_supervisor() or public.es_editor_plan());
create policy pgp_borrar on public.pgp_imagenes
  for delete to authenticated
  using ((public.es_supervisor() and creado_en > now() - interval '24 hours') or public.es_editor_plan());

drop policy if exists pgp_fotos_leer   on storage.objects;
drop policy if exists pgp_fotos_subir  on storage.objects;
drop policy if exists pgp_fotos_borrar on storage.objects;

create policy pgp_fotos_leer on storage.objects
  for select to authenticated
  using (bucket_id = 'adjuntos' and name like 'pgp/%' and (public.es_supervisor() or public.es_editor_plan()));
create policy pgp_fotos_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'adjuntos' and name like 'pgp/%' and (public.es_supervisor() or public.es_editor_plan()));
create policy pgp_fotos_borrar on storage.objects
  for delete to authenticated
  using (bucket_id = 'adjuntos' and name like 'pgp/%'
         and ((public.es_supervisor() and created_at > now() - interval '24 hours') or public.es_editor_plan()));
