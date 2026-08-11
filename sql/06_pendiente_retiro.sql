-- App United — migración 6: tapa pendiente de retiro.
-- Correr en Supabase → SQL Editor → Run. Idempotente. Solo agrega una columna,
-- no reescribe ninguna fila.
--
-- Estado nuevo del retiro de tapas: salieron los seguros triples y los pernos
-- parker, pero la tapa sigue adentro. No es una falla (nada está agripado ni
-- rodado) y tampoco está retirada, así que necesitaba su propio campo.
--
-- ⚠️ La app manda `pendiente_retiro` en cada upsert de tapa apenas se publica
-- la versión nueva. Si esta migración no está corrida, el upsert falla y la
-- cola de subida se detiene ahí — y como se sube en orden, deja trancados
-- también los avisos y los andamios. Correr esto ANTES de publicar.

alter table public.estado_tapas
  add column if not exists pendiente_retiro boolean not null default false;
