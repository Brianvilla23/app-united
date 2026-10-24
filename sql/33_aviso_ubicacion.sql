-- App United — migración 33: el aviso guarda dónde está el trabajo (24-10-2026).
--
-- Brayan: "se debe agregar zonas que no están predeterminadas, si es posible
-- generar localizaciones igual que los Uber o inDriver". La zona sigue siendo
-- texto (ahora se puede escribir una nueva, no solo elegir de la lista) y se
-- suma la ubicación GPS del punto: {lat, lng, precision (m), fuente: 'gps' |
-- 'mapa'}. Opcional: los avisos viejos y las versiones viejas de la app no la
-- mandan y siguen funcionando.
alter table public.avisos add column if not exists ubicacion jsonb;
