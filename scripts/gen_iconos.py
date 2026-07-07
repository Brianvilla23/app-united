# Genera los iconos PWA de la app (public/pwa-192.png, public/pwa-512.png, favicon)
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "public")
os.makedirs(OUT, exist_ok=True)

SLATE = (15, 23, 42)      # #0f172a
TEAL = (13, 148, 136)     # #0d9488
WHITE = (255, 255, 255)

def rounded(draw, xy, r, fill):
    draw.rounded_rectangle(xy, radius=r, fill=fill)

def make_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # fondo slate redondeado
    rounded(d, (0, 0, size, size), int(size * 0.22), SLATE)
    # gota / U estilizada: banda teal inferior
    band_h = int(size * 0.16)
    d.rounded_rectangle((int(size*0.14), size - band_h - int(size*0.12), size - int(size*0.14), size - int(size*0.12)), radius=band_h // 2, fill=TEAL)
    # letra U
    font = None
    for name in ["arialbd.ttf", "seguisb.ttf", "segoeuib.ttf", "arial.ttf"]:
        try:
            font = ImageFont.truetype(name, int(size * 0.52))
            break
        except OSError:
            continue
    if font is None:
        font = ImageFont.load_default()
    txt = "U"
    bbox = d.textbbox((0, 0), txt, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((size - tw) / 2 - bbox[0], (size - th) / 2 - bbox[1] - size * 0.07), txt, font=font, fill=WHITE)
    return img

for s, name in [(192, "pwa-192.png"), (512, "pwa-512.png"), (64, "favicon.png")]:
    make_icon(s).save(os.path.join(OUT, name))
    print("OK", name)

# apple-touch-icon (180, sin transparencia)
apple = Image.new("RGB", (180, 180), SLATE)
icon = make_icon(180).convert("RGBA")
apple.paste(icon, (0, 0), icon)
apple.save(os.path.join(OUT, "apple-touch-icon.png"))
print("OK apple-touch-icon.png")
