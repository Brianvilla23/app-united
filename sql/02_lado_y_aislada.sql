-- App United — migración 2: lado (alimentación/descarga) + tapas aisladas.
-- Correr en Supabase → SQL Editor → Run. Idempotente.
-- Preserva los registros existentes: todo lo que ya había queda como 'alimentacion'.

-- ------------------------------------------------------- estado_tapas
alter table public.estado_tapas
  add column if not exists lado text not null default 'alimentacion';

alter table public.estado_tapas
  add column if not exists aislada boolean not null default false;

-- La PK pasa de (rack, vasija) a (lado, rack, vasija): la misma vasija tiene
-- una tapa por lado, y son piezas distintas.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'estado_tapas_pkey'
      and conrelid = 'public.estado_tapas'::regclass
      and array_length(conkey, 1) = 2
  ) then
    alter table public.estado_tapas drop constraint estado_tapas_pkey;
    alter table public.estado_tapas add primary key (lado, rack, vasija);
  end if;
end $$;

-- ---------------------------------------------------------- historial
alter table public.historial
  add column if not exists lado text not null default 'alimentacion';

-- -------------------------------------------------------- marcas_fuga
-- Mismo razonamiento para las fugas (el lado descarga tiene su propio plano).
alter table public.marcas_fuga
  add column if not exists lado text not null default 'alimentacion';

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'marcas_fuga_pkey'
      and conrelid = 'public.marcas_fuga'::regclass
      and array_length(conkey, 1) = 3
  ) then
    alter table public.marcas_fuga drop constraint marcas_fuga_pkey;
    alter table public.marcas_fuga add primary key (lado, rack, vasija, componente);
  end if;
end $$;
