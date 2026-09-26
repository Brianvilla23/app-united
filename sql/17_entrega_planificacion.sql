-- App United — migración 17: la entrega de turno del área de PLANIFICACIÓN.
-- Correr en Supabase → SQL Editor → Run. Idempotente. YA APLICADA (26-09-2026).
--
-- No es la de los supervisores: sale de la minuta de la semana y se ordena por
-- estado — realizadas / seguimiento / pendientes — más las observaciones.
-- Se guarda una foto de la semana, porque la minuta sigue cambiando después.
create table if not exists public.entregas_planificacion (
  id             text primary key,
  inicio         date not null,          -- el martes de la semana de la minuta
  fecha          date not null,          -- el día en que se hizo la entrega
  entrega_nombre text default '',
  entrega_cargo  text default '',
  recibe_nombre  text default '',
  recibe_cargo   text default '',
  realizadas     jsonb not null default '[]'::jsonb,
  seguimiento    jsonb not null default '[]'::jsonb,
  pendientes     jsonb not null default '[]'::jsonb,
  observaciones  jsonb not null default '[]'::jsonb,
  creado_por     text,
  creado_en      timestamptz default now()
);

create index if not exists entregas_plan_semana_idx on public.entregas_planificacion (inicio desc);
alter table public.entregas_planificacion enable row level security;

drop policy if exists entregas_plan_editores on public.entregas_planificacion;
create policy entregas_plan_editores on public.entregas_planificacion
  for all to authenticated using (public.es_editor_plan()) with check (public.es_editor_plan());
