# -*- coding: utf-8 -*-
"""
Toma lo que dejo importar_plan.py y escribe el SQL que sube la planilla a Supabase.

  python scripts/importar_plan.py     -> scripts/plan_semilla.json
  python scripts/plan_a_sql.py        -> sql/08_plan_semilla.sql

El SQL es idempotente: cada linea lleva un id que sale de su fecha y de su fila en
la planilla, asi que volver a correrlo no duplica nada.
"""
import json, os, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
ENTRADA = os.path.join(AQUI, 'plan_semilla.json')
SALIDA = os.path.join(RAIZ, 'sql', '08_plan_semilla.sql')


def txt(v):
    if v is None:
        return 'null'
    return "'" + str(v).replace("'", "''") + "'"


def num(v):
    return 'null' if v is None else repr(float(v))


datos = json.load(open(ENTRADA, encoding='utf-8'))
filas = datos['actividades']

# El id sale de la fecha y de la fila que ocupaba en la planilla: la misma linea
# siempre da el mismo id, aunque el SQL se corra dos veces.
ids = {}
for f in filas:
    f['id'] = 'plan-%s-%03d' % (f['fecha'], f['origen_fila'])
    if f['id'] in ids:
        otro = ids[f['id']]
        sys.exit('id repetido %s:\n  %s\n  %s' % (f['id'], otro, f))
    ids[f['id']] = f

lineas = []
lineas.append('-- App United — migración 8: la planilla madre, ya cargada.')
lineas.append('-- Generado por scripts/plan_a_sql.py desde %s' % datos['origen'])
lineas.append('-- %d líneas de actividad, %d semanas. Correr DESPUÉS de 07_plan_maestro.sql.' % (len(filas), datos['semanas']))
lineas.append('-- Idempotente: el id sale de la fecha + la fila de la planilla.')
lineas.append('')

# ---- catalogo
lineas.append('insert into public.plan_catalogo (actividad, veces) values')
cat = datos['catalogo']
for i, c in enumerate(cat):
    coma = ',' if i < len(cat) - 1 else ''
    lineas.append('  (%s, %d)%s' % (txt(c['actividad']), c['veces'], coma))
lineas.append('on conflict (actividad) do update set veces = excluded.veces;')
lineas.append('')

# ---- actividades, de a 200 para que el editor de Supabase no se atore
CAMPOS = '(id, fecha, anio, semana, turno, actividad, hh, orden, creado_por)'
for i in range(0, len(filas), 200):
    trozo = filas[i:i + 200]
    lineas.append('insert into public.plan_actividades %s values' % CAMPOS)
    for j, f in enumerate(trozo):
        coma = ',' if j < len(trozo) - 1 else ''
        lineas.append('  (%s, %s, %d, %d, %s, %s, %s, %d, %s)%s' % (
            txt(f['id']), txt(f['fecha']), f['anio'], f['semana'], txt(f['turno']),
            txt(f['actividad']), num(f['hh']), f['orden'], txt('planilla madre'), coma))
    lineas.append('on conflict (id) do nothing;')
    lineas.append('')

with open(SALIDA, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lineas))

print('escrito %s' % SALIDA)
print('%d actividades, %d del catalogo, %d KB' % (len(filas), len(cat), os.path.getsize(SALIDA) // 1024))
