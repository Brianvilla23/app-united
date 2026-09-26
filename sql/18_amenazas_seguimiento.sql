-- App United — migración 18: las amenazas de supervisión se monitorean.
-- Correr en Supabase → SQL Editor → Run. Idempotente. YA APLICADA (26-09-2026).
--
-- Las amenazas que reportan los supervisores en el cuadro 3.3 de su entrega no
-- se pueden quedar ahí: tienen que llegar a la minuta de planificación como
-- algo que hay que MONITOREAR y con CÓMO se va a solucionar.
--
-- La amenaza en sí vive en la entrega del supervisor y no se toca: ese
-- documento ya se firmó. Acá va solo el seguimiento de planificación, con un
-- id estable: <id de la entrega>-<número de la fila>.
create table if not exists public.amenazas_seguimiento (
  id          text primary key,
  entrega_id  text not null references public.entregas_turno(id) on delete cascade,
  indice      int  not null,
  descripcion text not null,          -- copia, para leerla sin ir a buscarla
  inicio      date not null,          -- el martes de la semana de la minuta
  estado      text not null default 'monitorear',
  solucion    text default '',
  responsable text default '',
  actualizado_por text,
  actualizado_en  timestamptz default now()
);

alter table public.amenazas_seguimiento drop constraint if exists amenazas_estado_check;
alter table public.amenazas_seguimiento
  add constraint amenazas_estado_check check (estado in ('monitorear', 'en_curso', 'resuelta'));

create index if not exists amenazas_semana_idx on public.amenazas_seguimiento (inicio);
alter table public.amenazas_seguimiento enable row level security;

drop policy if exists amenazas_editores on public.amenazas_seguimiento;
create policy amenazas_editores on public.amenazas_seguimiento
  for all to authenticated using (public.es_editor_plan()) with check (public.es_editor_plan());
