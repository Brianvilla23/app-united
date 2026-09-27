-- App United — migración 21: el rack también se lee y escribe CON CUENTA.
-- Correr en Supabase → SQL Editor → Run. Idempotente. YA APLICADA (27-09-2026).
--
-- 🔴 Las tablas del rack solo dejaban entrar al rol `anon`. Cuando alguien
-- inicia sesión en Planificación en ese navegador, el cliente pasa a ser
-- `authenticated` y la base le negaba todo el rack:
--   · al bajar le devolvía cero filas → la app mostraba 0% en actividades que
--     la cuadrilla tenía al 100%;
--   · al subir lo rechazaba → quedaba todo "por subir" para siempre.
-- A la cuadrilla no le pasaba porque no inicia sesión. Los editores son de más
-- confianza que anon: se agregan a las mismas políticas.
do $$
declare t text;
begin
  foreach t in array array[
    'avance_item', 'estado_tapas', 'marcas_fuga', 'historial',
    'sideport_ovalamiento', 'avisos', 'andamios'
  ] loop
    execute format('drop policy if exists app_united_anon on public.%I', t);
    execute format(
      'create policy app_united_anon on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

drop policy if exists sideports_leer   on storage.objects;
drop policy if exists sideports_subir  on storage.objects;
drop policy if exists sideports_borrar on storage.objects;

create policy sideports_leer on storage.objects
  for select to anon, authenticated using (bucket_id = 'adjuntos' and name like 'sideports/%');
create policy sideports_subir on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'adjuntos' and name like 'sideports/%');
create policy sideports_borrar on storage.objects
  for delete to anon, authenticated using (bucket_id = 'adjuntos' and name like 'sideports/%');
