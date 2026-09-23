# Genera los iconos de la app: la pestaña del navegador (favicon), el icono de
# iOS y los de la PWA (public/pwa-192.png, public/pwa-512.png).
#
# El icono NO puede ser el logo completo: "united" en 16 px es una mancha. Se
# arma con las tres piezas de la marca — el rojo corporativo rgb(192,0,0), la
# "U" en blanco y la barra gris que va bajo el logotipo — que a ese tamaño sí
# se leen.
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "public")
os.makedirs(OUT, exist_ok=True)

ROJO = (192, 0, 0)        # rgb(192,0,0), el acento de la app
GRIS = (71, 71, 71)       # #474747, la barra bajo el logotipo de United
WHITE = (255, 255, 255)


def make_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # fondo rojo redondeado
    d.rounded_rectangle((0, 0, size, size), radius=int(size * 0.22), fill=ROJO)
    # barra gris inferior, como la del logo
    alto = max(2, int(size * 0.12))
    d.rounded_rectangle(
        (int(size * 0.14), size - alto - int(size * 0.13),
         size - int(size * 0.14), size - int(size * 0.13)),
        radius=alto // 2, fill=GRIS,
    )
    # letra U
    font = None
    for name in ["arialbd.ttf", "seguisb.ttf", "segoeuib.ttf", "arial.ttf"]:
        try:
            font = ImageFont.truetype(name, int(size * 0.56))
            break
        except OSError:
            continue
    if font is None:
        font = ImageFont.load_default()
    txt = "U"
    bbox = d.textbbox((0, 0), txt, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((size - tw) / 2 - bbox[0], (size - th) / 2 - bbox[1] - size * 0.08),
           txt, font=font, fill=WHITE)
    return img


for s, name in [(192, "pwa-192.png"), (512, "pwa-512.png"), (64, "favicon.png")]:
    make_icon(s).save(os.path.join(OUT, name))
    print("OK", name)

# apple-touch-icon (180, sin transparencia: iOS no la respeta)
apple = Image.new("RGB", (180, 180), ROJO)
icon = make_icon(180).convert("RGBA")
apple.paste(icon, (0, 0), icon)
apple.save(os.path.join(OUT, "apple-touch-icon.png"))
print("OK apple-touch-icon.png")
