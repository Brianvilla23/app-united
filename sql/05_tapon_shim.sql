-- App United — migración 5: tapón central y graduación de shim.
-- Correr en Supabase → SQL Editor → Run. Idempotente. YA APLICADA (30-07-2026).
--
-- Solo aplican a la instalación de tapas: en alimentación va un tapón al centro
-- del orificio, y se anota cuántos milímetros de shim se graduaron.
alter table public.estado_tapas
  add column if not exists tapon boolean not null default false;

alter table public.estado_tapas
  add column if not exists shim_mm numeric;
