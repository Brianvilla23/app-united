-- App United — migración 22: sideport con foto pero sin estado ("Falta estado").
-- Correr en Supabase → SQL Editor → Run. Idempotente. YA APLICADA (27-09-2026).
--
-- El 27-09 a Neimar se le borró de la app lo que registró entre las 15:58 y las
-- 16:47: su celular dejó de sincronizar y, al actualizarse la app a las 17:54,
-- el refresco desde el servidor pisó lo que nunca se había subido. Las FOTOS sí
-- habían llegado al bucket (van directo, sin cola), así que se sabe qué sideport
-- revisó y cómo se veía cada una; lo que se perdió es el estado que marcó.
--
-- Esas sideport se cargan con su foto y estado 'revisar': en la app se ven de
-- otro color y al abrirlas muestran la foto para ponerles el estado de verdad.
-- NO se cargan como 'ok': verde dice "se miró y está bien", y eso no se puede
-- suponer en un registro de inspección.
alter table public.sideport_ovalamiento drop constraint if exists sideport_estado_check;
alter table public.sideport_ovalamiento
  add constraint sideport_estado_check check (estado in ('ok', 'pendiente', 'critica', 'revisar'));

-- La recuperación: una fila por sideport que tiene foto en el bucket y no tiene
-- fila. La foto que queda es la última que se subió. `on conflict do nothing`:
-- nada de lo que ya estaba registrado se toca.
insert into public.sideport_ovalamiento
  (id, rack, lado, vasija, sideport, estado, nota, foto, actualizado_por, actualizado_en)
select distinct on (f.id)
  f.id,
  split_part(f.id, '-', 2)::int,
  split_part(f.id, '-', 1),
  split_part(f.id, '-', 3),
  split_part(f.id, '-', 4),
  'revisar', '', f.name, 'Neimar Hernandez', f.created_at
from (
  select split_part(name, '/', 2) as id, name, created_at
  from storage.objects
  where bucket_id = 'adjuntos' and name like 'sideports/%'
) f
where f.id ~ '^(alimentacion|descarga)-[0-9]+-[A-Z][0-9]+-(norte|sur)$'
  and not exists (select 1 from public.sideport_ovalamiento o where o.id = f.id)
order by f.id, f.created_at desc
on conflict (id) do nothing;
