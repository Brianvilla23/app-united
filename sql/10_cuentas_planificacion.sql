-- App United — las dos cuentas de Planificación.
--
-- Las CUENTAS se crean en el panel de Supabase, no acá:
--   Authentication → Users → Add user → correo corporativo + clave,
--   con "Auto Confirm User" marcado.
-- Así la clave la escribe su dueño y no queda en ningún archivo del repo.
--
-- Acá va solo la lista de quién entra a planificación. Correr después de crear
-- las cuentas, cambiando los correos por los de verdad:

insert into public.plan_editores (correo, nombre) values
  ('correo.de.brayan@dominio.cl', 'Brayan Villalobos'),
  ('correo.del.colega@dominio.cl', 'Colega')
on conflict (correo) do update set nombre = excluded.nombre;

-- Para sacar a alguien:
--   delete from public.plan_editores where correo = 'correo@dominio.cl';
--
-- ------------------------------------------------------------------------
-- Si alguna vez hace falta crear la cuenta por SQL en vez del panel, OJO:
-- GoTrue no soporta NULL en sus columnas de token y el login devuelve
-- "Database error querying schema". Hay que dejarlas en cadena vacía:
--
--   update auth.users set
--     confirmation_token = coalesce(confirmation_token, ''),
--     recovery_token = coalesce(recovery_token, ''),
--     email_change_token_new = coalesce(email_change_token_new, ''),
--     email_change_token_current = coalesce(email_change_token_current, ''),
--     email_change = coalesce(email_change, ''),
--     phone_change = coalesce(phone_change, ''),
--     phone_change_token = coalesce(phone_change_token, ''),
--     reauthentication_token = coalesce(reauthentication_token, '')
--   where email = 'correo@dominio.cl';
--
-- y además de `auth.users` hay que insertar la fila en `auth.identities`
-- (provider 'email'), porque sin identidad el login con clave no existe.
