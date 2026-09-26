-- App United — migración 12: la minuta de la semana.
-- Correr en Supabase → SQL Editor → Run. Idempotente. YA APLICADA (26-09-2026).
--
-- ⚠️ La semana de planificación va de MARTES a LUNES, no es la semana corrida.
-- Por eso se guarda el martes de inicio y no un número de semana: el número se
-- calcula para mostrarlo, pero lo que manda es la fecha.
create table if not exists public.minuta_tareas (
  id             text primary key,
  inicio         date not null,                       -- el martes en que arranca
  titulo         text not null,
  estado         text not null default 'pendiente',   -- pendiente | en_curso | lista
  proyecto_id    text references public.proyectos(id) on delete set null,
  nota           text,
  orden          int not null default 0,
  viene_de       date,                                -- si se arrastró de la anterior
  creado_por     text,
  creado_en      timestamptz default now(),
  actualizado_en timestamptz default now()
);

create index if not exists minuta_inicio_idx on public.minuta_tareas (inicio, orden);

alter table public.minuta_tareas enable row level security;
drop policy if exists minuta_editores on public.minuta_tareas;
create policy minuta_editores on public.minuta_tareas
  for all to authenticated using (public.es_editor_plan()) with check (public.es_editor_plan());
