# -*- coding: utf-8 -*-
"""
Lee la planilla madre de planificacion y la deja normalizada para la App United.

Origen: OneDrive\\Escritorio\\Planificacion\\Semana de planificacion.xlsx, hoja "Plan Semana".

Como esta armada la hoja (deducido del archivo real, no supuesto):
  fila r      titulo del bloque .. "Plan 0 gotas Week 34 Turno Q"
  fila r+1    las 7 fechas de lunes a domingo, una cada 3 columnas (B,E,H,K,N,Q,T)
  fila r+2    formula "=344-(SUM(...))" -> las HH del dia que quedan SIN asignar
  r+3..       actividades: descripcion en la columna del dia, HH dos columnas a la derecha
  una fila con "NOCHE" en la columna B parte el bloque: arriba turno dia, abajo turno noche
  (los bloques viejos de 2024-25 no traen esa fila: ahi el turno viene pegado al nombre)

Salidas (en scripts/):
  plan_semilla.json     los datos limpios, listos para subir
  plan_diagnostico.txt  lo que esta mal en la planilla, con nombre y apellido
"""
import openpyxl, json, re, unicodedata, datetime, os
from collections import Counter, defaultdict

ORIGEN = r'C:\Users\braya\OneDrive\Escritorio\Planificacion\Semana de planificacion.xlsx'
AQUI = os.path.dirname(os.path.abspath(__file__))

COL_DIA = [2, 5, 8, 11, 14, 17, 20]  # B E H K N Q T
NOMBRE_DIA = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo']
HH_POR_DIA_DEFECTO = 344  # el 344 que va escrito a mano dentro de cada formula

# Errores de tipeo que se repiten semana a semana. Izquierda lo que hay, derecha lo correcto.
TIPEOS = [
    (r'\bhouskeeping\b', 'Housekeeping'),
    (r'\bdimencionamiento\b', 'Dimensionamiento'),
    (r'\bmaxisacos\b', 'Maxisaco'),
    (r'\bmaxisaco\b', 'Maxisaco'),
    (r'\bpresurisadores\b', 'Presurizadores'),
]


def sin_tildes(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')


def limpiar(texto):
    """Devuelve el nombre de la actividad y, si venia pegado al nombre, el turno aparte."""
    t = re.sub(r'\s+', ' ', str(texto)).strip()
    turno = None
    m = re.search(r'\s+(dia|d\u00eda|noche)\s*$', t, flags=re.I)
    if m:
        turno = 'Noche' if m.group(1).lower() == 'noche' else 'Dia'
        t = t[:m.start()].strip()
    base = sin_tildes(t)
    for patron, bueno in TIPEOS:
        base = re.sub(patron, bueno, base, flags=re.I)
    base = re.sub(r'\s+', ' ', base).strip(' -')
    if base:
        base = base[0].upper() + base[1:]
    return base, turno


def numero(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).replace(',', '.'))
    except ValueError:
        return None


wb = openpyxl.load_workbook(ORIGEN, data_only=True)
ws = wb['Plan Semana']

# --- 1. ubicar los bloques -------------------------------------------------
cabeceras = [(r, str(ws.cell(r, 2).value).strip())
             for r in range(1, ws.max_row + 1)
             if isinstance(ws.cell(r, 2).value, str) and 'week' in ws.cell(r, 2).value.lower()]

problemas = []
bloques = []
for i, (fila, titulo) in enumerate(cabeceras):
    fin = cabeceras[i + 1][0] - 1 if i + 1 < len(cabeceras) else ws.max_row
    fechas = [ws.cell(fila + 1, c).value for c in COL_DIA]
    lunes = fechas[0].date() if isinstance(fechas[0], datetime.datetime) else None
    m = re.search(r'week\s*0*(\d+)', titulo, flags=re.I)
    bloques.append({'fila': fila, 'fin': fin, 'titulo': titulo, 'lunes_excel': lunes,
                    'semana_titulo': int(m.group(1)) if m else None})

# --- 2. arreglar las fechas y las semanas que quedaron copiadas -------------
# Los bloques van hacia adelante en el tiempo. Solo se corrige la fecha cuando NO
# avanza respecto del bloque de arriba: eso es copiar-pegar sin actualizar (pasa en
# los bloques futuros, que arrastran todos el mismo lunes). Si la fecha avanza pero
# salta mas de una semana, se respeta: en la planilla hay un corte real de un ano
# entre abril-2025 y mayo-2026, y forzar la cadena ahi arruinaba las fechas buenas.
for i, b in enumerate(bloques):
    anterior = bloques[i - 1] if i else None
    esperado = (anterior['lunes'] + datetime.timedelta(days=7)) if anterior and anterior.get('lunes') else None
    lunes = b['lunes_excel']
    if lunes is None or (esperado and lunes <= anterior['lunes']):
        if esperado:
            problemas.append('fila %4d  la fecha no avanza (%s, la misma o anterior al bloque de arriba)'
                             '  ->  corregida a %s   [%s]'
                             % (b['fila'], lunes, esperado, b['titulo']))
            lunes = esperado
    elif esperado and lunes != esperado:
        problemas.append('fila %4d  salto en la planilla: del %s al %s (%d dias sin planificar)   [%s]'
                         % (b['fila'], anterior['lunes'], lunes, (lunes - anterior['lunes']).days, b['titulo']))
    b['lunes'] = lunes
    iso = lunes.isocalendar()
    b['semana'], b['anio'] = iso[1], iso[0]
    if b['semana_titulo'] and b['semana_titulo'] != b['semana']:
        problemas.append('fila %4d  el titulo dice "Week %02d" pero por fecha es la semana %02d de %d'
                         % (b['fila'], b['semana_titulo'], b['semana'], b['anio']))

# --- 3. sacar las actividades ---------------------------------------------
filas = []
sin_turno = 0
for b in bloques:
    corte_noche = None
    for r in range(b['fila'] + 3, b['fin'] + 1):
        v = ws.cell(r, 2).value
        if isinstance(v, str) and v.strip().lower() == 'noche':
            corte_noche = r
            break
    for r in range(b['fila'] + 3, b['fin'] + 1):
        if r == corte_noche:
            continue
        seccion = 'Noche' if (corte_noche and r > corte_noche) else ('Dia' if corte_noche else None)
        for di, c in enumerate(COL_DIA):
            crudo = ws.cell(r, c).value
            if not isinstance(crudo, str) or not crudo.strip():
                continue
            if sin_tildes(crudo.strip().lower()) in ('noche', 'dia'):
                continue
            actividad, turno_en_nombre = limpiar(crudo)
            if not actividad:
                continue
            turno = seccion or turno_en_nombre
            if turno is None:
                turno = 'Dia'
                sin_turno += 1
            if seccion and turno_en_nombre and seccion != turno_en_nombre:
                problemas.append('fila %4d col %d  "%s" esta en la seccion %s pero el nombre dice %s'
                                 % (r, c, crudo.strip(), seccion, turno_en_nombre))
            filas.append({
                'anio': b['anio'], 'semana': b['semana'],
                'fecha': (b['lunes'] + datetime.timedelta(days=di)).isoformat(),
                'dia': NOMBRE_DIA[di], 'turno': turno,
                'actividad': actividad, 'hh': numero(ws.cell(r, c + 2).value),
                'orden': r - b['fila'], 'origen_fila': r,
            })

# --- 4. juntar los nombres que son la misma actividad ----------------------
# Dos cosas separan nombres que en terreno son el mismo trabajo:
#  a) mayusculas distintas segun quien lo escribio ese dia ("Filtro CIP 1-2" / "Filtro CiP 1-2")
#  b) la misma idea dicha de dos formas ("Apoyo de outage" / "Apoyo outage")
# Para (a) se agrupa ignorando mayusculas y gana la forma que mas se repite. Para (b)
# van estas equivalencias, escritas a mano y a proposito cortas: solo las que son
# claramente el mismo trabajo. Si dos cosas pueden ser distintas, se dejan distintas.
IGUALES = {
    'apoyo de outage': 'apoyo outage',
    'inspeccion acueducto': 'inspeccion de acueducto',
    'mejoramiento de instalacion': 'mejoramiento de instalaciones',
    'inspeccion de fugas': 'inspeccion de fuga',
    'entrenamiento de sideport': 'entrenamiento instalacion de sideport',
    'mantenimiento bomba sumidero': 'mantenimiento bomba sumidero 201',
    'bomba sumidero 201': 'mantenimiento bomba sumidero 201',
    'reparacion de porton': 'reparacion de porton central',
}

def clave(nombre):
    k = sin_tildes(nombre).lower().strip()
    return IGUALES.get(k, k)

por_clave = defaultdict(Counter)
for f in filas:
    por_clave[clave(f['actividad'])][f['actividad']] += 1
canonico = {k: c.most_common(1)[0][0] for k, c in por_clave.items()}
unificados = sum(sum(c.values()) - c.most_common(1)[0][1] for c in por_clave.values())
for f in filas:
    f['actividad'] = canonico[clave(f['actividad'])]

conteo = Counter(f['actividad'] for f in filas)
catalogo = sorted(conteo.items(), key=lambda x: (-x[1], x[0]))

# --- 5. escribir salidas ---------------------------------------------------
semanas = sorted({(f['anio'], f['semana']) for f in filas})
salida = {
    'origen': ORIGEN,
    'generado': datetime.datetime.now().isoformat(timespec='seconds'),
    'hh_por_dia': HH_POR_DIA_DEFECTO,
    'semanas': len(semanas),
    'actividades': filas,
    'catalogo': [{'actividad': a, 'veces': n} for a, n in catalogo],
}
with open(os.path.join(AQUI, 'plan_semilla.json'), 'w', encoding='utf-8') as f:
    json.dump(salida, f, ensure_ascii=False, indent=1)

sin_hh = [f for f in filas if f['hh'] is None]
carga = defaultdict(float)
for f in filas:
    if f['hh']:
        carga[f['fecha']] += f['hh']
pasados = sorted([(d, h) for d, h in carga.items() if h > HH_POR_DIA_DEFECTO], key=lambda x: -x[1])

with open(os.path.join(AQUI, 'plan_diagnostico.txt'), 'w', encoding='utf-8') as f:
    f.write('DIAGNOSTICO DE LA PLANILLA MADRE\n%s\n\n' % ORIGEN)
    f.write('bloques semanales  : %d\n' % len(bloques))
    f.write('semanas distintas  : %d  (%s .. %s)\n' % (len(semanas), semanas[0], semanas[-1]))
    f.write('lineas de actividad: %d\n' % len(filas))
    f.write('actividades distintas tras limpiar: %d\n' % len(conteo))
    f.write('lineas sin HH      : %d\n' % len(sin_hh))
    f.write('turno deducido del nombre (bloques viejos sin fila NOCHE): %d\n\n' % sin_turno)
    f.write('--- dias que pasan las %d HH disponibles (%d) ---\n' % (HH_POR_DIA_DEFECTO, len(pasados)))
    for d, h in pasados[:30]:
        f.write('  %s  %.0f HH  (+%.0f)\n' % (d, h, h - HH_POR_DIA_DEFECTO))
    f.write('\n--- fechas y semanas corregidas / inconsistentes (%d) ---\n' % len(problemas))
    for p in problemas:
        f.write('  ' + p + '\n')
    f.write('\n--- catalogo de actividades (%d) ---\n' % len(catalogo))
    for a, n in catalogo:
        f.write('  %4d  %s\n' % (n, a))

print('bloques %d | semanas %d | lineas %d | actividades distintas %d | problemas %d'
      % (len(bloques), len(semanas), len(filas), len(conteo), len(problemas)))
print('escrito: scripts/plan_semilla.json  y  scripts/plan_diagnostico.txt')
