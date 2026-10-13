-- App United — migración 28: el rol de supervisión.
-- Correr en Supabase → SQL Editor → Run. Idempotente.
--
-- Igual que `plan_editores`, pero para supervisión: quién es supervisor lo dice
-- esta tabla en la base, no la pantalla. La cuenta es la misma de Supabase Auth
-- (correo y clave): una persona puede estar en las dos listas con la misma
-- clave, como Brayan.
--
-- Etapa 2 del despliegue gradual (13-10-2026): por ahora solo se ve en la app
-- con qué cuenta y en qué rol entraste. Nada se cierra todavía para quien no
-- tiene cuenta; eso viene cuando las cuentas de los supervisores estén creadas.
create table if not exists public.supervisores (
  correo      text primary key,
  nombre      text,
  agregado_en timestamptz default now()
);

alter table public.supervisores enable row level security;

-- cada uno ve su propia fila; planificación ve y administra la lista
drop policy if exists supervisores_propia   on public.supervisores;
drop policy if exists supervisores_editores on public.supervisores;
create policy supervisores_propia on public.supervisores
  for select to authenticated using (lower(correo) = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy supervisores_editores on public.supervisores
  for all to authenticated using (public.es_editor_plan()) with check (public.es_editor_plan());

create or replace function public.es_supervisor()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.supervisores
    where lower(correo) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke execute on function public.es_supervisor() from public, anon;
grant execute on function public.es_supervisor() to authenticated;

-- Brayan, con la misma cuenta de planificación, para probar y mejorar
insert into public.supervisores (correo, nombre) values
  ('bvillalobos@unitedpipeline-sa.com', 'Brayan Villalobos')
on conflict (correo) do update set nombre = excluded.nombre;

-- Los supervisores (cuentas creadas por Brayan en Authentication el 13-10-2026)
insert into public.supervisores (correo, nombre) values
  ('ecarvajal@unitedpipeline-sa.com', 'Edgardo Carvajal'),
  ('mnavarrete@unitedpipeline-sa.com', 'Moisés Navarrete'),
  ('ruribe@unitedpipeline-sa.com', 'René Uribe'),
  ('rrojas@unitedpipeline-sa.com', 'Richard Rojas'),
  ('claudio.araya@unitedpipeline-sa.com', 'Claudio Araya')
on conflict (correo) do update set nombre = excluded.nombre;
