-- App United — migración 7: el avance del outage pasa a tener RACK.
-- Correr en Supabase → SQL Editor → Run. Idempotente. No borra ni reescribe filas.
--
-- Hasta ahora `avance_item` no tenía columna de rack: todo lo que guardaba se
-- daba por Rack 12, que era el único en intervención. Con el outage del Rack 3
-- (EWS P1) eso deja de ser cierto y los dos racks se pisarían en la misma llave.
--
-- Los registros que ya existen quedan como rack 12 por el `default`, que es lo
-- que efectivamente son: no se reescribe ninguna fila.
--
-- Dos actividades ya venían metiendo el rack DENTRO de `item` para esquivar la
-- falta de columna (`fuga_manifold` → '7-DE1', `comentario_rack` → '7'). A esas
-- se les rellena el rack real leyéndolo del item. `item` NO se toca, así que
-- siguen siendo las mismas filas y el upsert de la app las encuentra igual.
--
-- ⚠️ ORDEN: esto va ANTES de publicar la versión nueva de la app. La app nueva
-- manda `rack` en cada upsert de avance; si la columna no existe, el upsert
-- falla y la cola de subida se detiene ahí — y como se sube en orden, deja
-- trancados también los avisos, los andamios y las tapas.

alter table public.avance_item
  add column if not exists rack int not null default 12;

-- ---------------------------------------------------------------- backfill
-- Rack real de lo que lo traía embebido en el `item`. El `and rack = 12` deja
-- la migración repetible: lo ya corregido no se vuelve a tocar.
update public.avance_item
   set rack = split_part(item, '-', 1)::int
 where actividad = 'fuga_manifold'
   and item ~ '^[0-9]+-'
   and rack = 12
   and split_part(item, '-', 1)::int <> 12;

update public.avance_item
   set rack = item::int
 where actividad = 'comentario_rack'
   and item ~ '^[0-9]+$'
   and rack = 12
   and item::int <> 12;

-- --------------------------------------------------------------------- PK
-- La llave pasa de (actividad, lado, item) a (actividad, rack, lado, item).
-- Se hace solo si todavía tiene 3 columnas, así que correr de nuevo no rompe.
do $$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'avance_item_pkey'
       and conrelid = 'public.avance_item'::regclass
       and array_length(conkey, 1) = 3
  ) then
    alter table public.avance_item drop constraint avance_item_pkey;
    alter table public.avance_item
      add constraint avance_item_pkey primary key (actividad, rack, lado, item);
  end if;
end $$;

create index if not exists avance_item_rack_idx
  on public.avance_item (rack, actividad, lado);
