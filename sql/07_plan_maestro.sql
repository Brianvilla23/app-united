-- App United — migración 7: la planilla madre de planificación.
-- Correr en: Supabase → proyecto egxgxejgcohzwuoqhald → SQL Editor → Run.
-- Es idempotente: se puede volver a correr sin romper nada.
--
-- A diferencia del resto de la app, acá los permisos son de verdad y no por
-- honor: el plan lo escriben SOLO los correos que estén en `plan_editores`, con
-- sesión iniciada. El resto de la cuadrilla lo ve y manda sugerencias, pero no
-- puede tocarlo aunque abra la consola del navegador. Eso lo hace la política
-- RLS de más abajo, no la pantalla.

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

-- ------------------------------------------------------------- la planilla
create table if not exists public.plan_actividades (
  id              text primary key,
  fecha           date not null,
  anio            int  not null,
  semana          int  not null,
  turno           text not null default 'Dia',
  actividad       text not null,
  hh              numeric,
  estado          text not null default 'planificada',
  zona            text,
  ot              text,
  nota            text,
  orden           int  not null default 0,
  creado_por      text,
  created_at      timestamptz default now(),
  actualizado_por text,
  actualizado_en  timestamptz default now()
);

create index if not exists plan_actividades_fecha_idx  on public.plan_actividades (fecha);
create index if not exists plan_actividades_semana_idx on public.plan_actividades (anio, semana);

-- ------------------------------------- el menú de actividades que se repiten
create table if not exists public.plan_catalogo (
  actividad  text primary key,
  hh_tipica  numeric,
  activo     boolean not null default true,
  veces      int default 0,
  created_at timestamptz default now()
);

-- ------------------------------- parámetros del plan (HH del día, etc.)
create table if not exists public.plan_config (
  clave           text primary key,
  valor           text not null,
  actualizado_por text,
  actualizado_en  timestamptz default now()
);

-- Las HH que rinde la dotación en un día. En la planilla iba escrito a mano
-- dentro de cada fórmula (=344-SUM(...)), repetido 7 veces por semana: cambiar
-- la dotación obligaba a editar cientos de celdas. Acá se cambia en un lugar.
insert into public.plan_config (clave, valor)
values ('hh_por_dia', '344')
on conflict (clave) do nothing;

-- ------------------------------------------------ sugerencias de la cuadrilla
-- Las manda cualquiera, sin cuenta: quien está en planta no tiene por qué
-- registrarse para avisar que una actividad no da. Los editores las resuelven.
create table if not exists public.plan_sugerencias (
  id           text primary key,
  fecha        date,
  anio         int,
  semana       int,
  actividad_id text,
  tipo         text not null default 'comentario',
  texto        text not null,
  autor        text not null,
  estado       text not null default 'pendiente',
  respuesta    text,
  resuelto_por text,
  resuelto_en  timestamptz,
  created_at   timestamptz default now()
);

create index if not exists plan_sugerencias_estado_idx on public.plan_sugerencias (estado, created_at desc);

-- ------------------------------------------------------- quién cambió qué
create table if not exists public.plan_historial (
  id           text primary key,
  actividad_id text,
  fecha        date,
  accion       text not null,
  detalle      text,
  quien        text not null,
  created_at   timestamptz default now()
);

create index if not exists plan_historial_fecha_idx on public.plan_historial (created_at desc);

-- ============================================================ permisos (RLS)
alter table public.plan_editores    enable row level security;
alter table public.plan_actividades enable row level security;
alter table public.plan_catalogo    enable row level security;
alter table public.plan_config      enable row level security;
alter table public.plan_sugerencias enable row level security;
alter table public.plan_historial   enable row level security;

-- El plan: lo lee cualquiera, lo escribe solo un editor con sesión.
drop policy if exists plan_leer     on public.plan_actividades;
drop policy if exists plan_escribir on public.plan_actividades;
create policy plan_leer     on public.plan_actividades for select to anon, authenticated using (true);
create policy plan_escribir on public.plan_actividades for all    to authenticated
  using (public.es_editor_plan()) with check (public.es_editor_plan());

drop policy if exists catalogo_leer     on public.plan_catalogo;
drop policy if exists catalogo_escribir on public.plan_catalogo;
create policy catalogo_leer     on public.plan_catalogo for select to anon, authenticated using (true);
create policy catalogo_escribir on public.plan_catalogo for all    to authenticated
  using (public.es_editor_plan()) with check (public.es_editor_plan());

drop policy if exists config_leer     on public.plan_config;
drop policy if exists config_escribir on public.plan_config;
create policy config_leer     on public.plan_config for select to anon, authenticated using (true);
create policy config_escribir on public.plan_config for all    to authenticated
  using (public.es_editor_plan()) with check (public.es_editor_plan());

-- La lista de editores: la ve y la cambia un editor. Nadie más la lee.
drop policy if exists editores_leer     on public.plan_editores;
drop policy if exists editores_escribir on public.plan_editores;
create policy editores_leer     on public.plan_editores for select to authenticated using (public.es_editor_plan());
create policy editores_escribir on public.plan_editores for all    to authenticated
  using (public.es_editor_plan()) with check (public.es_editor_plan());

-- Sugerencias: las manda y las lee cualquiera; resolverlas es de editor.
-- El delete queda fuera a propósito: una sugerencia no se borra, se responde.
drop policy if exists sug_leer     on public.plan_sugerencias;
drop policy if exists sug_crear    on public.plan_sugerencias;
drop policy if exists sug_resolver on public.plan_sugerencias;
create policy sug_leer     on public.plan_sugerencias for select to anon, authenticated using (true);
create policy sug_crear    on public.plan_sugerencias for insert to anon, authenticated with check (true);
create policy sug_resolver on public.plan_sugerencias for update to authenticated
  using (public.es_editor_plan()) with check (public.es_editor_plan());

-- Historial: lo lee cualquiera (para eso está), lo escribe quien edita.
drop policy if exists planhist_leer  on public.plan_historial;
drop policy if exists planhist_crear on public.plan_historial;
create policy planhist_leer  on public.plan_historial for select to anon, authenticated using (true);
create policy planhist_crear on public.plan_historial for insert to authenticated
  with check (public.es_editor_plan());

-- ============================ que iniciar sesión no rompa el resto de la app
-- Las tablas que ya existían tienen su política escrita `for all to anon`. En
-- Postgres, un usuario con sesión NO es `anon`: es `authenticated`. Así que en
-- cuanto uno de los dos editores inicie sesión para tocar el plan, dejaría de
-- calzar con esas políticas y marcar una tapa o guardar un aviso empezaría a
-- fallar en silencio — desde la misma pantalla de siempre, sin ningún aviso.
-- Por eso las mismas políticas se vuelven a crear para los dos roles.
do $$
declare t text;
begin
  foreach t in array array['avisos','andamios','marcas_fuga','estado_tapas','historial','avance_item']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists app_united_anon on public.%I', t);
      execute format('create policy app_united_anon on public.%I for all to anon, authenticated '
                     'using (true) with check (true)', t);
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------ los 2 editores
-- Estar acá NO crea la cuenta: la cuenta se crea en Authentication → Users, con
-- su clave. Esta tabla dice cuáles de esas cuentas pueden escribir el plan.
insert into public.plan_editores (correo, nombre) values
  ('brayan.villalobos.c@gmail.com', 'Brayan Villalobos')
on conflict (correo) do nothing;
