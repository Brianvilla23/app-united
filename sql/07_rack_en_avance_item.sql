-- App United — migración 7: el avance de las actividades pasa a tener RACK.
-- Correr en Supabase → SQL Editor → Run. Idempotente.
--
-- Hasta el Rack 12 la app trabajaba un solo rack, así que `avance_item` no
-- tenía de qué rack era cada registro: se daba por hecho que todo era del 12.
-- Con el outage del Rack 3 eso ya no sirve. La columna entra con
-- `default 12`, así que los 969 registros del Rack 12 quedan donde están.
--
-- Además, dos actividades venían metiendo el rack DENTRO del item porque no
-- había dónde ponerlo (`fuga_manifold` = "7-DE1", `comentario_rack` = "12").
-- Acá se pasa a la columna y el item queda limpio.

alter table public.avance_item add column if not exists rack int not null default 12;

-- el rack que viajaba dentro del item se muda a su columna
update public.avance_item
   set rack = split_part(item, '-', 1)::int,
       item = substr(item, strpos(item, '-') + 1)
 where actividad = 'fuga_manifold' and item ~ '^[0-9]+-';

update public.avance_item
   set rack = item::int,
       item = 'comentario'
 where actividad = 'comentario_rack' and item ~ '^[0-9]+$';

-- la llave pasa de (actividad, lado, item) a (actividad, lado, rack, item):
-- la misma actividad sobre el mismo ítem existe en cada rack por separado
do $$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'public.avance_item'::regclass and contype = 'p'
       and conkey @> array[
         (select attnum from pg_attribute where attrelid = 'public.avance_item'::regclass and attname = 'item')
       ]
       and array_length(conkey, 1) = 3
  ) then
    alter table public.avance_item drop constraint avance_item_pkey;
    alter table public.avance_item add primary key (actividad, lado, rack, item);
  end if;
end $$;

create index if not exists avance_item_actividad_rack_idx
  on public.avance_item (actividad, rack, lado);
