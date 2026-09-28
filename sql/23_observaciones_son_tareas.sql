-- App United — migración 23: las observaciones son tareas de la minuta.
-- Correr en Supabase → SQL Editor → Run. Idempotente. YA APLICADA (28-09-2026).
--
-- Brayan: "todo lo que agreguemos en planificación debería poder cargar
-- archivos y subtareas". Las observaciones "para nuestra entrega de turno"
-- pasan a ser tareas de la minuta con tipo 'observacion', así tienen la misma
-- ficha que cualquier actividad. La tabla vieja se migra y se borra.
alter table public.minuta_tareas
  add column if not exists tipo text not null default 'tarea';
alter table public.minuta_tareas drop constraint if exists minuta_tipo_check;
alter table public.minuta_tareas
  add constraint minuta_tipo_check check (tipo in ('tarea', 'observacion'));

do $$
begin
  if to_regclass('public.turno_observaciones') is not null then
    insert into public.minuta_tareas (id, inicio, titulo, estado, orden, tipo, nota, correo, creado_por)
    select o.id, o.inicio, o.texto, 'pendiente',
           100 + row_number() over (partition by o.inicio order by o.creado_en),
           'observacion', '', '', o.creado_por
    from public.turno_observaciones o
    on conflict (id) do nothing;
    drop table public.turno_observaciones;
  end if;
end $$;
