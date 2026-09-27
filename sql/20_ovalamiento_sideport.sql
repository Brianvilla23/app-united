-- App United — migración 20: control de ovalamiento de sideport.
-- Correr en Supabase → SQL Editor → Run. Idempotente. YA APLICADA (27-09-2026).
--
-- Por vasija y por lado: cada vasija tiene su sideport NORTE y su SUR. De cada
-- una se anota si está buena, si queda pendiente de retiro o si está crítica
-- para cambio, con su foto. Con eso queda la base de datos de qué hay que
-- cambiar y dónde.
--
-- Mismo criterio que el resto del outage: la cuadrilla trabaja SIN cuenta, así
-- que la tabla la escribe `anon`, igual que `avance_item`.
create table if not exists public.sideport_ovalamiento (
  id         text primary key,          -- <lado>-<rack>-<vasija>-<sideport>
  rack       int  not null,
  lado       text not null,
  vasija     text not null,
  sideport   text not null,
  estado     text not null default 'ok',
  nota       text default '',
  foto       text,
  actualizado_por text,
  actualizado_en  timestamptz default now()
);

alter table public.sideport_ovalamiento drop constraint if exists sideport_estado_check;
alter table public.sideport_ovalamiento
  add constraint sideport_estado_check check (estado in ('ok', 'pendiente', 'critica'));

create index if not exists sideport_rack_idx on public.sideport_ovalamiento (rack, lado);
alter table public.sideport_ovalamiento enable row level security;

drop policy if exists app_united_anon on public.sideport_ovalamiento;
create policy app_united_anon on public.sideport_ovalamiento
  for all to anon using (true) with check (true);

-- Las fotos van al bucket privado bajo el prefijo 'sideports/'. Se abren de a
-- una con enlace firmado; el resto del bucket sigue cerrado a los editores.
drop policy if exists sideports_leer   on storage.objects;
drop policy if exists sideports_subir  on storage.objects;
drop policy if exists sideports_borrar on storage.objects;

create policy sideports_leer on storage.objects
  for select to anon using (bucket_id = 'adjuntos' and name like 'sideports/%');
create policy sideports_subir on storage.objects
  for insert to anon with check (bucket_id = 'adjuntos' and name like 'sideports/%');
create policy sideports_borrar on storage.objects
  for delete to anon using (bucket_id = 'adjuntos' and name like 'sideports/%');
