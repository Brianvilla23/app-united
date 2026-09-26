-- App United — migración 15: la entrega de turno es POR ÁREA.
-- Correr en Supabase → SQL Editor → Run. Idempotente. YA APLICADA (26-09-2026).
--
-- Son DOS entregas de turno distintas, de dos áreas distintas:
--   'supervision'   → la que llena el supervisor en terreno, sin cuenta.
--   'planificacion' → la del área de planificación, la que hacen Brayan y Juan.
-- Antes estaban todas revueltas: lo que había hasta hoy es de supervisión.
alter table public.entregas_turno
  add column if not exists area text not null default 'supervision';

alter table public.entregas_turno drop constraint if exists entregas_turno_area_check;
alter table public.entregas_turno
  add constraint entregas_turno_area_check check (area in ('supervision', 'planificacion'));

create index if not exists entregas_area_idx on public.entregas_turno (area, fecha desc);

-- Las observaciones de la minuta van a la entrega de PLANIFICACIÓN, que la
-- llenan ellos mismos con su cuenta. Ya no hace falta que las lea cualquiera:
-- se cierra la lectura a los editores (queda solo la política turno_obs_editores).
drop policy if exists turno_obs_leer on public.turno_observaciones;
