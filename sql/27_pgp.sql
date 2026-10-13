-- App United — migración 27: PGP de supervisión.
-- Correr en Supabase → SQL Editor → Run. Idempotente.
--
-- Los cuatro registros diarios del turno (charla de inicio, check list de
-- fatiga y somnolencia, check list de equipo y vehículo, cartilla CIS), cada
-- uno con una o varias fotos por día. Las fotos van al bucket privado
-- 'adjuntos' bajo 'pgp/' y se abren con enlace firmado.
--
-- Quién puede qué:
--  · Los supervisores todavía entran SIN cuenta: anon carga y ve.
--  · Toda política va `to anon, authenticated` (ver §25: con solo anon, quien
--    inició sesión en Planificación queda ciego).
--  · BORRAR (poka-yoke): sin cuenta, solo durante 24 h desde que se cargó —
--    alcanza para corregir una foto equivocada del día, pero nadie puede vaciar
--    el historial. Pasado eso, solo los editores de planificación.
create table if not exists public.pgp_imagenes (
  id          text primary key,
  registro    text not null check (registro in ('charla', 'fatiga', 'equipos', 'cis')),
  dia         date not null,
  ruta        text not null check (ruta like 'pgp/%'),
  ancho       int,
  alto        int,
  subido_por  text,
  creado_en   timestamptz not null default now()
);

create index if not exists pgp_imagenes_dia_idx on public.pgp_imagenes (dia, registro);
alter table public.pgp_imagenes enable row level security;

drop policy if exists pgp_leer   on public.pgp_imagenes;
drop policy if exists pgp_cargar on public.pgp_imagenes;
drop policy if exists pgp_borrar on public.pgp_imagenes;

create policy pgp_leer on public.pgp_imagenes
  for select to anon, authenticated using (true);
create policy pgp_cargar on public.pgp_imagenes
  for insert to anon, authenticated with check (true);
create policy pgp_borrar on public.pgp_imagenes
  for delete to anon, authenticated
  using (creado_en > now() - interval '24 hours' or public.es_editor_plan());
-- sin política de update: una foto cargada no se cambia, se borra y se carga otra

-- Las fotos, en el bucket privado
drop policy if exists pgp_fotos_leer   on storage.objects;
drop policy if exists pgp_fotos_subir  on storage.objects;
drop policy if exists pgp_fotos_borrar on storage.objects;

create policy pgp_fotos_leer on storage.objects
  for select to anon, authenticated using (bucket_id = 'adjuntos' and name like 'pgp/%');
create policy pgp_fotos_subir on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'adjuntos' and name like 'pgp/%');
create policy pgp_fotos_borrar on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'adjuntos' and name like 'pgp/%'
         and (created_at > now() - interval '24 hours' or public.es_editor_plan()));
