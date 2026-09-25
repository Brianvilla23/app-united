-- App United — migración 9: Planificación (proyectos, tareas y entrega de turno).
-- Correr en: Supabase → proyecto egxgxejgcohzwuoqhald → SQL Editor → Run.
-- Es idempotente: se puede volver a correr sin romper nada.
--
-- A diferencia del resto de la app, acá los permisos son de verdad y no por
-- honor: esto lo ven y lo escriben SOLO los correos que estén en
-- `plan_editores`, con sesión iniciada. Lo hace la política RLS de más abajo,
-- no la pantalla — el JavaScript de la app va publicado y cualquiera lo lee.
--
-- La excepción es la entrega de turno: el supervisor la ESCRIBE sin cuenta
-- (entra a la app como siempre, con su nombre), pero no puede leer las de
-- nadie. Leerlas y descargarlas es de los editores.

-- ------------------------------------------------------ quién puede escribir
create table if not exists public.plan_editores (
  correo      text primary key,
  nombre      text not null,
  agregado_en timestamptz default now()
);

-- Se consulta desde las políticas. Va como security definer para que la política
-- pueda leer la tabla sin que el usuario tenga permiso de leerla directo, y con
-- search_path fijo para que nadie pueda colgarle un esquema propio delante.
create or replace function public.es_editor_plan()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.plan_editores
    where lower(correo) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

grant execute on function public.es_editor_plan() to anon, authenticated;

alter table public.plan_editores enable row level security;
drop policy if exists editores_leer on public.plan_editores;
create policy editores_leer on public.plan_editores
  for select to authenticated using (public.es_editor_plan());

-- ---------------------------------------------------------------- proyectos
create table if not exists public.proyectos (
  id         text primary key,
  nombre     text not null,
  orden      int  not null default 0,
  activo     boolean not null default true,
  creado_por text,
  creado_en  timestamptz default now()
);

alter table public.proyectos enable row level security;
drop policy if exists proyectos_editores on public.proyectos;
create policy proyectos_editores on public.proyectos
  for all to authenticated using (public.es_editor_plan()) with check (public.es_editor_plan());

-- ------------------------------------------------- actividades y subtareas
-- `padre_id` nulo = actividad; con padre = subtarea de esa actividad. Es el
-- mismo árbol de "cargar actividades y subtareas" del cuaderno.
create table if not exists public.plan_tareas (
  id             text primary key,
  proyecto_id    text not null references public.proyectos(id) on delete cascade,
  padre_id       text references public.plan_tareas(id) on delete cascade,
  titulo         text not null,
  estado         text not null default 'pendiente',   -- 'pendiente' | 'completada'
  desde          date,
  hasta          date,
  seguimiento    text,
  orden          int not null default 0,
  creado_por     text,
  creado_en      timestamptz default now(),
  actualizado_en timestamptz default now()
);

create index if not exists plan_tareas_proyecto_idx on public.plan_tareas (proyecto_id, orden);

alter table public.plan_tareas enable row level security;
drop policy if exists tareas_editores on public.plan_tareas;
create policy tareas_editores on public.plan_tareas
  for all to authenticated using (public.es_editor_plan()) with check (public.es_editor_plan());

-- ------------------------------------------------------------ entrega de turno
-- La escribe el supervisor desde la app, sin cuenta. `hecho`, `pendiente` y
-- `novedades` son texto libre; `actividades` guarda lo que marcó contra el plan
-- cuando lo haya.
create table if not exists public.entregas_turno (
  id           text primary key,
  fecha        date not null,
  turno        text not null,                 -- 'dia' | 'noche'
  supervisor   text not null,
  area         text,
  dotacion     int,
  hecho        text,
  pendiente    text,
  novedades    text,
  actividades  jsonb not null default '[]'::jsonb,
  creado_en    timestamptz default now()
);

create index if not exists entregas_fecha_idx on public.entregas_turno (fecha desc, turno);

alter table public.entregas_turno enable row level security;
-- el supervisor deja la suya sin cuenta…
drop policy if exists entregas_enviar on public.entregas_turno;
create policy entregas_enviar on public.entregas_turno
  for insert to anon, authenticated with check (true);
-- …pero leerlas, corregirlas o borrarlas es de los editores
drop policy if exists entregas_leer on public.entregas_turno;
create policy entregas_leer on public.entregas_turno
  for select to authenticated using (public.es_editor_plan());
drop policy if exists entregas_editar on public.entregas_turno;
create policy entregas_editar on public.entregas_turno
  for update to authenticated using (public.es_editor_plan()) with check (public.es_editor_plan());
drop policy if exists entregas_borrar on public.entregas_turno;
create policy entregas_borrar on public.entregas_turno
  for delete to authenticated using (public.es_editor_plan());

-- --------------------------------------------------- los proyectos del cuaderno
insert into public.proyectos (id, nombre, orden) values
  ('acueducto',      'Acueducto',           1),
  ('soporte_rack',   'Soporte de rack',     2),
  ('tapas_protec',   'Tapas Protec USA',    3),
  ('manifold_desar', 'Manifold desarmable', 4),
  ('tubing',         'Tubing',              5),
  ('brazo',          'Brazo',               6),
  ('sala_electrica', 'Sala eléctrica',      7)
on conflict (id) do nothing;
