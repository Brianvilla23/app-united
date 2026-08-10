-- App United — migración 4: la tapa pertenece a una ACTIVIDAD.
-- Correr en Supabase → SQL Editor → Run. Idempotente. No borra filas.
--
-- Retiro e instalación de tapas son actividades distintas sobre la misma
-- vasija. Antes compartían registro, así que la instalación aparecía con el
-- avance del retiro en vez de partir en 0.
-- Lo ya cargado (207 filas) queda como 'retiro_tapas_alim', que es lo que
-- efectivamente se registró.

alter table public.estado_tapas
  add column if not exists actividad text not null default 'retiro_tapas_alim';

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'estado_tapas_pkey'
      and conrelid = 'public.estado_tapas'::regclass
      and array_length(conkey, 1) = 3
  ) then
    alter table public.estado_tapas drop constraint estado_tapas_pkey;
    alter table public.estado_tapas add primary key (actividad, lado, rack, vasija);
  end if;
end $$;

-- tabla de avance de las demás actividades (venteos, manifold, pasos simples)
create table if not exists public.avance_item (
  actividad  text not null,
  lado       text not null,
  item       text not null,
  hecho      boolean not null default false,
  datos      jsonb   not null default '{}'::jsonb,
  creado_por text,
  created_at timestamptz default now(),
  primary key (actividad, lado, item)
);

create index if not exists avance_item_actividad_idx
  on public.avance_item (actividad, lado);

alter table public.avance_item enable row level security;
drop policy if exists app_united_anon on public.avance_item;
create policy app_united_anon on public.avance_item
  for all to anon using (true) with check (true);
