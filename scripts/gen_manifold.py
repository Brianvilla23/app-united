# -*- coding: utf-8 -*-
"""Genera el detalle de un manifold a partir del plano de Planificación.

Salidas:
  public/manifold_detalle.png  — tira con los recortes del PDF, uno por arquetipo
  src/manifoldDetalle.ts       — zonas tocables de stub end y tubing, en puntos PDF

Por qué así: el diagrama de la app ES el plano, no una réplica dibujada a mano
(misma decisión que el diagrama general de manifolds). Las zonas no se estiman a
ojo: salen de la geometría vectorial del propio PDF, filtrando por color de
relleno. Ámbar #ffc000 = stub end, celeste #00b0f0 = tubing, azul #0070c0 = el
manifold PVC.

El plano trae formas duplicadas (copia-pega del CAD: hasta 4 copias encimadas de
la misma pieza), así que hay que deduplicar por posición antes de contar.
Deduplicado da exactamente 295 tubing y 295 stub end, uno por vasija del rack.

Correr:  python scripts/gen_manifold.py
"""
import collections
import json
import os

import fitz  # PyMuPDF
from PIL import Image

PDF = r"C:\Users\braya\OneDrive\Escritorio\Planificacion\Manifold pvc lado descarga enumerados.pdf"
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PNG = os.path.join(RAIZ, "public", "manifold_detalle.png")
TS = os.path.join(RAIZ, "src", "manifoldDetalle.ts")

# Colores de relleno del plano.
AZUL, CELESTE, AMBAR, MORADO = "#0070c0", "#00b0f0", "#ffc000", "#7030a0"

# Recorte de cada manifold, en puntos PDF y relativo al extremo izquierdo de su
# barra azul. Cubre la pieza más saliente de los 40 (medido, no estimado).
DX0, DX1, DY0, DY1 = 18.0, 127.0, 23.0, 30.0
TILE_W, TILE_H = DX0 + DX1, DY0 + DY1
ESCALA = 5  # px por punto PDF

FILAS_MF = ["A", "BC", "DE", "FG", "HI", "JK", "LM", "NO", "PQ", "RS"]


def cols_para(fila):
    """Las mismas columnas que src/rackLayout.ts. Filas A y B no son completas."""
    if fila in ("A", "B"):
        return [2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15]
    if fila == "C":
        return list(range(2, 17))
    return list(range(1, 17))


def hexc(c):
    return None if c is None else "#%02x%02x%02x" % tuple(int(round(x * 255)) for x in c)


def dedupe(rects, tol=1.2):
    """El plano encima copias de la misma pieza; nos quedamos con una."""
    out = []
    for r in sorted(rects, key=lambda r: (r.y0, r.x0)):
        if any(abs(r.x0 - o.x0) < tol and abs(r.y0 - o.y0) < tol for o in out):
            continue
        out.append(r)
    return out


def main():
    pagina = fitz.open(PDF)[0]
    dibujos = pagina.get_drawings()

    # Fuera los rótulos: un mismo recorte sirve a varios manifolds (A1 y A3 se
    # dibujan igual), así que dejar el texto del plano pondría el código
    # equivocado sobre la mitad de ellos. El código lo escribe la app.
    for palabra in pagina.get_text("words"):
        pagina.add_redact_annot(fitz.Rect(palabra[:4]), fill=None)
    pagina.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE,
                            graphics=fitz.PDF_REDACT_LINE_ART_NONE,
                            text=fitz.PDF_REDACT_TEXT_REMOVE)

    # 1. las 40 barras horizontales del manifold ordenan todo el plano
    barras = [d["rect"] for d in dibujos
              if hexc(d.get("fill")) == AZUL and d["rect"].width > 90 and d["rect"].height < 12]
    assert len(barras) == 40, f"esperaba 40 barras, encontré {len(barras)}"
    barras.sort(key=lambda r: r.y0)
    filas, actual = [], [barras[0]]
    for b in barras[1:]:
        if abs(b.y0 - actual[-1].y0) < 12:
            actual.append(b)
        else:
            filas.append(actual)
            actual = [b]
    filas.append(actual)
    assert len(filas) == 10, f"esperaba 10 filas de manifold, encontré {len(filas)}"

    barra_de = {}
    for i, grupo in enumerate(filas):
        grupo.sort(key=lambda r: r.x0)
        for j, b in enumerate(grupo):
            barra_de[FILAS_MF[i] + str(j + 1)] = b

    # 2. cada forma va al manifold cuya barra tiene más cerca
    piezas = collections.defaultdict(lambda: collections.defaultdict(list))
    for d in dibujos:
        color = hexc(d.get("fill"))
        if color not in (CELESTE, AMBAR, MORADO):
            continue
        r = d["rect"]
        cx, cy = (r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2
        mejor, dist = None, 1e9
        for mid, b in barra_de.items():
            if not (b.x0 - 14 <= cx <= b.x1 + 14):
                continue
            d2 = abs(cy - (b.y0 + b.y1) / 2)
            if d2 < dist:
                dist, mejor = d2, mid
        if mejor is not None and dist <= 32:
            piezas[mejor][color].append(r)

    # 3. qué vasija le toca a cada brazo
    #    El plano es LADO DESCARGA: de izquierda a derecha van las posiciones 1-16
    #    y la vasija de la posición p es la columna 17-p (Semi Rack B a la izquierda).
    def vasijas_de(mid):
        letras, col = list(mid[:-1]), int(mid[-1])
        out = {}
        for brazo in range(4):
            real = 17 - ((col - 1) * 4 + brazo + 1)
            for k, letra in enumerate(letras):
                if real not in cols_para(letra):
                    continue
                # con dos filas, la de arriba es la primera letra
                fila = "abajo" if len(letras) == 1 or k == 1 else "arriba"
                out[(fila, brazo)] = f"{letra}{real}"
        return out

    # 4. emparejar cada pieza con su brazo y verificar que cierra 1:1
    arquetipos, arquetipo_de = {}, {}
    total_t = total_s = 0
    for mid in [f + str(c) for f in FILAS_MF for c in (1, 2, 3, 4)]:
        barra = barra_de[mid]
        esperadas = vasijas_de(mid)
        zonas = {"stubend": [], "tubing": []}
        for clave, color in (("stubend", AMBAR), ("tubing", CELESTE)):
            for r in dedupe(piezas[mid][color]):
                fila = "arriba" if r.y0 < barra.y0 else "abajo"
                # el brazo es el más cercano por la izquierda: las piezas nacen
                # en el stub end y llegan al brazo por la derecha
                brazo = min(range(4), key=lambda k: abs((r.x0 - barra.x0) - PASO_X[clave] - k * PASO))
                zonas[clave].append((fila, brazo, r))
        for clave in zonas:
            vistos = {(f, b) for f, b, _ in zonas[clave]}
            assert vistos == set(esperadas), f"{mid} {clave}: {sorted(vistos)} != {sorted(esperadas)}"
        total_t += len(zonas["tubing"])
        total_s += len(zonas["stubend"])

        # firma = qué brazos tienen pieza + de qué lado queda la columna verde
        firma = (tuple(sorted(esperadas)), "der" if int(mid[-1]) in (1, 3) else "izq")
        nombre = FIRMA_NOMBRE.setdefault(firma, f"tipo{len(FIRMA_NOMBRE) + 1}")
        arquetipo_de[mid] = nombre
        if nombre in arquetipos:
            continue
        ox, oy = barra.x0 - DX0, barra.y0 - DY0
        arquetipos[nombre] = {
            "i": len(arquetipos),
            "mid": mid,
            "clip": (ox, oy),
            "barra": [round(barra.x0 - ox, 2), round(barra.y0 - oy, 2),
                      round(barra.width, 2), round(barra.height, 2)],
            "stubend": [{"fila": f, "brazo": b, "vasija": esperadas[(f, b)],
                         "x": round(r.x0 - ox, 2), "y": round(r.y0 - oy, 2),
                         "w": round(r.width, 2), "h": round(r.height, 2)}
                        for f, b, r in sorted(zonas["stubend"], key=lambda z: (z[0], z[1]))],
            "tubing": [{"fila": f, "brazo": b, "vasija": esperadas[(f, b)],
                        "x": round(r.x0 - ox, 2), "y": round(r.y0 - oy, 2),
                        "w": round(r.width, 2), "h": round(r.height, 2)}
                       for f, b, r in sorted(zonas["tubing"], key=lambda z: (z[0], z[1]))],
        }

    assert total_t == total_s == 295, f"tubing={total_t} stubend={total_s}, deberían ser 295"
    print(f"{len(arquetipos)} dibujos distintos cubren los 40 manifolds "
          f"({total_t} tubing y {total_s} stub end = una por vasija)")

    # 5. la tira de recortes
    px_w, px_h = int(round(TILE_W * ESCALA)), int(round(TILE_H * ESCALA))
    tira = Image.new("RGB", (px_w, px_h * len(arquetipos)), "white")
    for nombre, a in sorted(arquetipos.items(), key=lambda kv: kv[1]["i"]):
        ox, oy = a["clip"]
        pm = pagina.get_pixmap(matrix=fitz.Matrix(ESCALA, ESCALA),
                               clip=fitz.Rect(ox, oy, ox + TILE_W, oy + TILE_H))
        img = Image.frombytes("RGB", (pm.width, pm.height), pm.samples)
        if img.size != (px_w, px_h):
            img = img.resize((px_w, px_h), Image.LANCZOS)
        tira.paste(img, (0, a["i"] * px_h))
    # Son colores planos, así que la paleta pesa un tercio que el RGB. Con 16
    # entradas se corrían los tonos (el ámbar del stub end salía amarillo); 32
    # los respeta y ocupa lo mismo.
    tira.quantize(colors=32, method=Image.MEDIANCUT, dither=Image.NONE).save(PNG, optimize=True)
    print(f"{os.path.relpath(PNG, RAIZ)}  {tira.size[0]}x{tira.size[1]}  "
          f"{os.path.getsize(PNG) / 1024:.0f} KB")

    # 6. el módulo TypeScript
    def zonas_ts(zs):
        return "".join(
            f"\n      {{ fila: '{z['fila']}', brazo: {z['brazo']}, x: {z['x']}, y: {z['y']}, w: {z['w']}, h: {z['h']} }},"
            for z in zs)

    cuerpo = "".join(
        f"""
  '{nombre}': {{
    i: {a['i']},
    barra: {json.dumps(a['barra'])},
    stubend: [{zonas_ts(a['stubend'])}
    ],
    tubing: [{zonas_ts(a['tubing'])}
    ],
  }},"""
        for nombre, a in sorted(arquetipos.items(), key=lambda kv: kv[1]["i"]))

    mapa = "".join(f"\n  {mid}: '{nombre}'," for mid, nombre in arquetipo_de.items())

    with open(TS, "w", encoding="utf-8") as f:
        f.write(f"""// GENERADO por scripts/gen_manifold.py — no editar a mano.
// Fuente: "Manifold pvc lado descarga enumerados.pdf" (Planificación).
//
// El dibujo del detalle es el recorte del plano; estas son las zonas tocables,
// sacadas de la geometría vectorial del PDF (ámbar = stub end, celeste =
// tubing). Los 40 manifolds se dibujan igual salvo qué vasijas existen en su
// fila y de qué lado queda la columna verde, así que {len(arquetipos)} recortes alcanzan.
// Todas las medidas van en puntos del PDF, con el origen arriba a la izquierda
// del recorte.

export const TILE = {{ w: {TILE_W}, h: {TILE_H}, n: {len(arquetipos)} }}
export const SPRITE = './manifold_detalle.png'

export type FilaTubing = 'arriba' | 'abajo'

/** Una pieza tocable. `brazo` 0-3 va de izquierda a derecha en el plano. */
export interface ZonaParte {{
  fila: FilaTubing
  brazo: number
  x: number; y: number; w: number; h: number
}}

export interface Arquetipo {{
  /** Fila que ocupa dentro de la tira. */
  i: number
  barra: [number, number, number, number]
  stubend: ZonaParte[]
  tubing: ZonaParte[]
}}

export const ARQUETIPOS: Record<string, Arquetipo> = {{{cuerpo}
}}

/** Qué recorte le toca a cada manifold. */
export const ARQUETIPO_DE: Record<string, string> = {{{mapa}
}}
""")
    print(f"{os.path.relpath(TS, RAIZ)}  {os.path.getsize(TS) / 1024:.0f} KB")


# separación entre brazos y desplazamiento de cada pieza respecto del brazo,
# medidos sobre el plano (son constantes en los 40 manifolds)
PASO = 26.5
PASO_X = {"stubend": 1.1, "tubing": 5.4}
FIRMA_NOMBRE = {}

if __name__ == "__main__":
    main()
