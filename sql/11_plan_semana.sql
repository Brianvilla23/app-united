-- App United — migración 11: el plan maestro (la planilla "Planificacion").
-- Correr en Supabase → SQL Editor → Run. Idempotente. YA APLICADA (26-09-2026).
--
-- En el Excel son bloques semanales con 7 días de a 3 columnas; acá cada
-- actividad es una fila con su fecha y su turno, así el mismo dato sirve para
-- una semana, un mes o el año.
create table if not exists public.plan_semana (
  id             text primary key,
  fecha          date not null,
  turno          text not null,            -- 'dia' | 'noche'
  orden          int  not null default 0,
  actividad      text not null,
  hh             numeric,
  ot             text,
  titulo         text,                     -- "Plan 0 gotas Week 15 PA-PB"
  observaciones  text,
  creado_por     text,
  actualizado_en timestamptz default now()
);

create index if not exists plan_semana_fecha_idx on public.plan_semana (fecha, turno, orden);

alter table public.plan_semana enable row level security;
drop policy if exists plan_semana_editores on public.plan_semana;
create policy plan_semana_editores on public.plan_semana
  for all to authenticated using (public.es_editor_plan()) with check (public.es_editor_plan());

-- Las HH que rinde la dotación en un día. En el Excel iban escritas a mano
-- dentro de cada fórmula, siete veces por semana.
create table if not exists public.plan_config (
  clave text primary key,
  valor text not null
);

alter table public.plan_config enable row level security;
drop policy if exists plan_config_leer on public.plan_config;
create policy plan_config_leer on public.plan_config
  for select to authenticated using (public.es_editor_plan());
drop policy if exists plan_config_escribir on public.plan_config;
create policy plan_config_escribir on public.plan_config
  for all to authenticated using (public.es_editor_plan()) with check (public.es_editor_plan());

insert into public.plan_config (clave, valor) values ('hh_dia', '344')
on conflict (clave) do nothing;
