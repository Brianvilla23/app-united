-- App United — migración 3: avance genérico de las actividades del outage.
-- Correr en Supabase → SQL Editor → Run. Idempotente. Solo agrega, no toca nada.
--
-- Las actividades que NO usan el plano de tapas (venteos, manifold, pasos
-- simples como "retiro de membrana") guardan acá un registro por ítem.
-- `datos` queda libre para lo particular de cada actividad: por ejemplo los
-- milímetros del shim en la instalación de tapas.

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
