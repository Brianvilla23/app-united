-- App United — migración 19: toda actividad tiene ficha.
-- Correr en Supabase → SQL Editor → Run. Idempotente. YA APLICADA (27-09-2026).
--
-- No solo las tareas de la minuta: también lo que se anota en las secciones
-- que se crean desde la app. Información, archivos, fecha de cierre, quién
-- responde y subtareas.
alter table public.plan_seccion_items
  add column if not exists padre_id text references public.plan_seccion_items(id) on delete cascade,
  add column if not exists nota     text default '',
  add column if not exists cierre   date,
  add column if not exists correo   text default '';

create index if not exists seccion_items_padre_idx on public.plan_seccion_items (padre_id);

-- Los archivos dejan de ser solo de la minuta: una tabla para todos, con el
-- ámbito y el id de lo que cuelgan. El bucket sigue siendo el mismo, privado.
create table if not exists public.adjuntos (
  id         text primary key,
  ambito     text not null,          -- 'minuta' | 'seccion'
  objeto_id  text not null,
  nombre     text not null,
  ruta       text not null,
  tipo       text,
  tamano     bigint,
  subido_por text,
  subido_en  timestamptz default now()
);

create index if not exists adjuntos_objeto_idx on public.adjuntos (ambito, objeto_id);
alter table public.adjuntos enable row level security;

drop policy if exists adjuntos_todos_editores on public.adjuntos;
create policy adjuntos_todos_editores on public.adjuntos
  for all to authenticated using (public.es_editor_plan()) with check (public.es_editor_plan());

-- `minuta_adjuntos` queda reemplazada por la de arriba. Estaba vacía.
drop table if exists public.minuta_adjuntos;
