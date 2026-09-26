-- App United — migración 16: las secciones de Planificación viven en la base.
-- Correr en Supabase → SQL Editor → Run. Idempotente. YA APLICADA (26-09-2026).
--
-- Se les puede cambiar el nombre y se pueden crear nuevas desde la app. Las
-- cinco de siempre quedan como 'fija' (cada una tiene su pantalla hecha): se
-- renombran pero no se borran.
create table if not exists public.plan_secciones (
  id       text primary key,
  nombre   text not null,
  bajada   text default '',
  icono    text default '📋',
  tipo     text not null default 'lista',   -- 'fija' | 'lista' | 'tabla'
  campos   jsonb not null default '[]'::jsonb,
  orden    int not null default 100,
  activa   boolean not null default true,
  creado_por text,
  creado_en  timestamptz default now()
);

alter table public.plan_secciones drop constraint if exists plan_secciones_tipo_check;
alter table public.plan_secciones
  add constraint plan_secciones_tipo_check check (tipo in ('fija', 'lista', 'tabla'));

create table if not exists public.plan_seccion_items (
  id         text primary key,
  seccion_id text not null references public.plan_secciones(id) on delete cascade,
  datos      jsonb not null default '{}'::jsonb,
  estado     text not null default 'pendiente',
  orden      int not null default 0,
  creado_por text,
  creado_en  timestamptz default now()
);
create index if not exists seccion_items_idx on public.plan_seccion_items (seccion_id, orden);

alter table public.plan_secciones enable row level security;
alter table public.plan_seccion_items enable row level security;

drop policy if exists secciones_editores on public.plan_secciones;
create policy secciones_editores on public.plan_secciones
  for all to authenticated using (public.es_editor_plan()) with check (public.es_editor_plan());

drop policy if exists seccion_items_editores on public.plan_seccion_items;
create policy seccion_items_editores on public.plan_seccion_items
  for all to authenticated using (public.es_editor_plan()) with check (public.es_editor_plan());

insert into public.plan_secciones (id, nombre, bajada, icono, tipo, orden) values
  ('minuta',         'Minuta de la semana',      'Lo pendiente, lo que se está haciendo y lo cerrado', '📌', 'fija', 10),
  ('plan',           'Plan maestro',             'La planilla semanal con sus HH, día y noche',        '🗓️', 'fija', 20),
  ('proyectos',      'Proyectos',                'Actividades y subtareas de cada frente',             '🏗️', 'fija', 30),
  ('entrega-propia', 'Nuestra entrega de turno', 'La del área de planificación: se llena, se baja y se manda', '📝', 'fija', 40),
  ('entregas',       'Entregas de supervisión',  'Las que mandan los supervisores, para leer y bajar',  '📥', 'fija', 50)
on conflict (id) do nothing;
