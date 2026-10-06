-- 25 · Respaldo automático dentro de la base (06-10-2026)
--
-- Por qué: el plan FREE de Supabase no trae respaldos restaurables, y las
-- tablas del rack las puede borrar cualquiera con el link (la cuadrilla entra
-- sin cuenta). Ya se perdieron datos 3 veces por guardar la fila entera y una
-- vez por el refresco del celular de Neimar (§26).
--
-- Qué hace: dos veces al día (03:00 y 15:00 de Chile en horario de verano)
-- copia TODAS las tablas de `public` a `respaldo.copias`, una fila por tabla
-- con su contenido entero en jsonb, más la lista de archivos del bucket. Guarda
-- 14 días. Las tablas nuevas entran solas.
--
-- El esquema `respaldo` no está expuesto en la API: ni anon ni authenticated lo
-- ven ni lo pueden borrar. Solo se usa desde el editor SQL de Supabase.
--
-- ⚠️ Esto NO es copia fuera de Supabase: si se pierde el proyecto se pierde
-- también esto. Las fotos tampoco se copian (solo su lista). Para eso va el
-- respaldo externo (repo privado), aparte.
--
-- ── Cómo recuperar ─────────────────────────────────────────────────────────
-- 1) Ver qué copias hay de una tabla:
--      select id, tomado_en, filas from respaldo.copias
--      where tabla = 'avance_item' order by tomado_en desc;
-- 2) Ver una copia como filas:
--      select * from jsonb_populate_recordset(null::public.avance_item,
--        (select datos from respaldo.copias where id = <id>));
-- 3) Devolver SOLO lo que se borró (no pisa nada que exista):
--      select respaldo.restaurar_faltantes(<id>);
--    Si hay borrados en cascada, restaurar primero la tabla madre y después la
--    hija, de la MISMA toma (mismo `tomado_en`): proyectos → plan_tareas,
--    plan_secciones → plan_seccion_items, entregas_turno → amenazas_seguimiento.
--    Las subtareas de minuta_tareas y plan_tareas están en la misma tabla y
--    vuelven juntas.
--
-- Probado 06-10-2026 en una transacción deshecha: se borraron 5 filas de
-- avance_item, estado_tapas, historial, sideport_ovalamiento y minuta_tareas
-- (esta arrastró 3 subtareas) y volvieron todas, idénticas.

create extension if not exists pg_cron;

create schema if not exists respaldo;
revoke all on schema respaldo from public, anon, authenticated;

create table if not exists respaldo.copias (
  id         bigserial primary key,
  tomado_en  timestamptz not null default now(),
  tabla      text not null,
  filas      integer not null,
  datos      jsonb not null
);
create index if not exists copias_tabla_fecha on respaldo.copias (tabla, tomado_en desc);
revoke all on all tables in schema respaldo from public, anon, authenticated;
revoke all on all sequences in schema respaldo from public, anon, authenticated;

-- Toma una copia de todo. Devuelve cuántas tablas copió.
create or replace function respaldo.tomar() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  t record;
  n integer := 0;
  momento timestamptz := now();
begin
  for t in
    select c.relname from pg_class c
    join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'public' and c.relkind in ('r', 'p')
    order by c.relname
  loop
    execute format(
      'insert into respaldo.copias (tomado_en, tabla, filas, datos)
       select $1, %L, count(*), coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb)
       from public.%I x', t.relname, t.relname)
    using momento;
    n := n + 1;
  end loop;

  -- La lista de archivos (no los archivos): para saber qué foto faltaría.
  insert into respaldo.copias (tomado_en, tabla, filas, datos)
  select momento, 'storage.objects', count(*),
         coalesce(jsonb_agg(jsonb_build_object(
           'bucket', o.bucket_id, 'nombre', o.name,
           'bytes', o.metadata->>'size', 'creado', o.created_at)), '[]'::jsonb)
  from storage.objects o;

  delete from respaldo.copias where tomado_en < momento - interval '14 days';
  return n;
end $$;

-- Reinserta las filas de una copia que ya no están en la tabla. No toca las que
-- existen (on conflict do nothing). Devuelve cuántas volvieron.
create or replace function respaldo.restaurar_faltantes(p_id bigint) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_tabla text;
  n integer;
begin
  select tabla into v_tabla from respaldo.copias where id = p_id;
  if v_tabla is null then raise exception 'No existe la copia %', p_id; end if;
  if v_tabla = 'storage.objects' then
    raise exception 'La lista de archivos no se restaura: es solo referencia';
  end if;
  execute format(
    'insert into public.%I
     select * from jsonb_populate_recordset(null::public.%I,
       (select datos from respaldo.copias where id = $1))
     on conflict do nothing', v_tabla, v_tabla)
  using p_id;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function respaldo.tomar() from public, anon, authenticated;
revoke all on function respaldo.restaurar_faltantes(bigint) from public, anon, authenticated;

-- 06:00 y 18:00 UTC = 03:00 y 15:00 en Chile (verano). Con el mismo nombre,
-- volver a correr este archivo actualiza el horario en vez de duplicarlo.
select cron.schedule('respaldo-madrugada', '0 6 * * *', 'select respaldo.tomar()');
select cron.schedule('respaldo-tarde', '0 18 * * *', 'select respaldo.tomar()');
