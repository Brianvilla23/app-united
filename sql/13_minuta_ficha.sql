-- App United — migración 13: la ficha de la tarea de la minuta.
-- Correr en Supabase → SQL Editor → Run. Idempotente. YA APLICADA (26-09-2026).
--
-- Cada tarea pasa a tener fecha de cierre, correo de contacto, subtareas
-- (padre_id) y archivos adjuntos. Los archivos van a un bucket PRIVADO y se
-- abren con enlaces firmados de 5 minutos: nadie llega con la URL suelta.
alter table public.minuta_tareas
  add column if not exists cierre   date,
  add column if not exists correo   text,
  add column if not exists padre_id text references public.minuta_tareas(id) on delete cascade;

create index if not exists minuta_padre_idx on public.minuta_tareas (padre_id);

create table if not exists public.minuta_adjuntos (
  id         text primary key,
  tarea_id   text not null references public.minuta_tareas(id) on delete cascade,
  nombre     text not null,
  ruta       text not null,
  tipo       text,
  tamano     bigint,
  subido_por text,
  subido_en  timestamptz default now()
);

create index if not exists minuta_adjuntos_tarea_idx on public.minuta_adjuntos (tarea_id);

alter table public.minuta_adjuntos enable row level security;
drop policy if exists adjuntos_editores on public.minuta_adjuntos;
create policy adjuntos_editores on public.minuta_adjuntos
  for all to authenticated using (public.es_editor_plan()) with check (public.es_editor_plan());

insert into storage.buckets (id, name, public, file_size_limit)
values ('adjuntos', 'adjuntos', false, 26214400)
on conflict (id) do nothing;

drop policy if exists adjuntos_leer   on storage.objects;
drop policy if exists adjuntos_subir  on storage.objects;
drop policy if exists adjuntos_borrar on storage.objects;

create policy adjuntos_leer on storage.objects
  for select to authenticated using (bucket_id = 'adjuntos' and public.es_editor_plan());
create policy adjuntos_subir on storage.objects
  for insert to authenticated with check (bucket_id = 'adjuntos' and public.es_editor_plan());
create policy adjuntos_borrar on storage.objects
  for delete to authenticated using (bucket_id = 'adjuntos' and public.es_editor_plan());
