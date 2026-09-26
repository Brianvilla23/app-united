-- App United — migración 14: la minuta y la entrega de turno se hablan.
-- Correr en Supabase → SQL Editor → Run. Idempotente. YA APLICADA (26-09-2026).
--
-- 1) De planificación al turno: observaciones que se escriben en la minuta y
--    le aparecen al supervisor ya cargadas cuando llena su entrega. Cada una
--    dice en qué cuadro del formato oficial va: 3.2 (actividad adicional) o
--    3.3 (amenaza). No se inventa ninguna sección nueva en la planilla.
-- 2) Del turno a planificación: la observación que Brayan o Juan le dejan a
--    una entrega que ya llegó, para hacerle seguimiento desde la minuta.
create table if not exists public.turno_observaciones (
  id         text primary key,
  inicio     date not null,                 -- el martes de la semana de la minuta
  texto      text not null,
  cuadro     text not null default 'adicional',
  tarea_id   text references public.minuta_tareas(id) on delete set null,
  creado_por text,
  creado_en  timestamptz default now()
);

alter table public.turno_observaciones drop constraint if exists turno_observaciones_cuadro_check;
alter table public.turno_observaciones
  add constraint turno_observaciones_cuadro_check check (cuadro in ('adicional', 'amenaza'));

create index if not exists turno_obs_inicio_idx on public.turno_observaciones (inicio);
alter table public.turno_observaciones enable row level security;

drop policy if exists turno_obs_editores on public.turno_observaciones;
create policy turno_obs_editores on public.turno_observaciones
  for all to authenticated using (public.es_editor_plan()) with check (public.es_editor_plan());

-- ⚠️ la LEE cualquiera a propósito: el supervisor no tiene cuenta y tiene que
-- verlas al llenar su entrega. Acá solo va lo que planificación decide mandarle
-- al turno, nunca la minuta completa.
drop policy if exists turno_obs_leer on public.turno_observaciones;
create policy turno_obs_leer on public.turno_observaciones
  for select to anon, authenticated using (true);

alter table public.entregas_turno
  add column if not exists obs_plan     text,
  add column if not exists obs_plan_por text,
  add column if not exists obs_plan_en  timestamptz;

drop policy if exists entregas_update_editores on public.entregas_turno;
create policy entregas_update_editores on public.entregas_turno
  for update to authenticated using (public.es_editor_plan()) with check (public.es_editor_plan());
