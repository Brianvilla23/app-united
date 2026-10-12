-- App United — migración 26: comentarios en cada tarea.
-- Correr en Supabase → SQL Editor → Run. Idempotente.
--
-- Brayan, 12-10-2026: en Proyectos escribía "Entregué la información a
-- Rodrigo" en el campo de actividad nueva, porque no había dónde comentar una
-- tarea ya hecha. "Seguimiento" es UN texto que se pisa; esto es una bitácora:
-- cada comentario queda con quién y cuándo.
--
-- Igual que `adjuntos`: el `ambito` dice de qué lista viene ('proyecto' por
-- ahora) y `objeto_id` de qué tarea. Solo editores de planificación.
-- Al borrar la tarea, sus comentarios quedan huérfanos (no hay FK porque el
-- ámbito puede ser cualquier lista); no molestan y el respaldo los guarda.
create table if not exists public.comentarios (
  id         text primary key,
  ambito     text not null,
  objeto_id  text not null,
  texto      text not null,
  autor      text,
  creado_en  timestamptz default now()
);

create index if not exists comentarios_objeto_idx on public.comentarios (ambito, objeto_id, creado_en);
alter table public.comentarios enable row level security;

drop policy if exists comentarios_editores on public.comentarios;
create policy comentarios_editores on public.comentarios
  for all to authenticated using (public.es_editor_plan()) with check (public.es_editor_plan());
