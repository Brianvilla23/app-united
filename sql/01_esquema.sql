-- App United — esquema completo.
-- Correr UNA vez en: Supabase → proyecto egxgxejgcohzwuoqhald → SQL Editor → Run.
-- Es idempotente: se puede volver a correr sin romper nada.

-- ---------------------------------------------------------------- avisos
create table if not exists public.avisos (
  id             text primary key,
  folio          text,
  titulo         text,
  tipo           text,
  prioridad      text,
  zona           text,
  equipo         text,
  descripcion    text,
  modo_falla     text,
  materiales     jsonb default '[]'::jsonb,
  dotacion       int,
  horas          numeric,
  detencion      boolean default false,
  fecha_trabajo  text,
  hse            text,
  correo_respaldo text,
  fotos_count    int default 0,
  creado_por     text,
  created_at     timestamptz default now()
);

-- ------------------------------------------------------------- andamios
create table if not exists public.andamios (
  id                  text primary key,
  folio               text,
  lugar               text,
  equipo              text,
  descripcion_uso     text,
  temporalidad        text,
  dias                int,
  cantidad_cuerpos    int,
  fecha_construccion  text,
  estado_tarjeta      text,
  inspeccionado_por   text,
  proxima_inspeccion  text,
  subsecuente_generado boolean default false,
  correo_respaldo     text,
  fotos_count         int default 0,
  creado_por          text,
  created_at          timestamptz default now()
);

-- --------------------------------------------------------- marcas_fuga
-- PK compuesta: el upsert de la app resuelve el conflicto por (rack, vasija, componente).
create table if not exists public.marcas_fuga (
  rack       int  not null,
  vasija     text not null,
  componente text not null,
  creado_por text,
  created_at timestamptz default now(),
  primary key (rack, vasija, componente)
);

-- -------------------------------------------------------- estado_tapas
create table if not exists public.estado_tapas (
  rack              int  not null,
  vasija            text not null,
  tapa_agripada     boolean default false,
  seguros_agripados jsonb   default '[]'::jsonb,
  pernos_rodados    jsonb   default '[]'::jsonb,
  ot                text,
  creado_por        text,
  created_at        timestamptz default now(),
  primary key (rack, vasija)
);

-- ------------------------------------------------------------ historial
-- Un registro por acción: quién tocó qué tapa/fuga y cuándo.
create table if not exists public.historial (
  id         text primary key,
  tipo       text not null,          -- 'tapa' | 'fuga'
  rack       int  not null,
  vasija     text not null,
  accion     text not null,          -- 'marcó fuga', 'actualizó tapa', ...
  detalle    text,
  quien      text,
  created_at timestamptz default now()
);

create index if not exists historial_rack_fecha_idx
  on public.historial (rack, created_at desc);

-- ------------------------------------------------------------------ RLS
-- La app no tiene login todavía: entra con la clave anon (publicable), que va
-- embebida en el JS publicado. Estas políticas dan acceso total al rol anon.
-- Es un tool interno de planta; cuando exista el módulo de login hay que
-- reemplazar estas políticas por unas basadas en auth.uid().
do $$
declare t text;
begin
  foreach t in array array['avisos','andamios','marcas_fuga','estado_tapas','historial']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists app_united_anon on public.%I', t);
    execute format(
      'create policy app_united_anon on public.%I for all to anon using (true) with check (true)', t);
  end loop;
end $$;
