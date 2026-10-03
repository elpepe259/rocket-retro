"""Recorta autos o pelotas de una imagen de referencia, les saca el fondo y los achica (pixel art).

Uso:
  python tools/recortar_sprites.py <imagen> <carpeta_salida> cars  '<json>'
  python tools/recortar_sprites.py <imagen> <carpeta_salida> balls '<json>'

JSON de autos:   {"nombre": {"box": [x0, y0, x1, y1], "wheels": [[cx, cy, r], ...], "width": 100,
                             "holes": false, "erase": [x0, y0, x1, y1]}}
  - box: recorte en la imagen original; wheels: centro y radio de cada rueda DENTRO del recorte
  - width: ancho final en el juego; holes: borrar también el fondo encerrado (autos con huecos, como el buggy)
  - erase: zona de la imagen original a borrar (por ejemplo un título que cae dentro del recorte)
  Genera <nombre>.png y <nombre>_b.png (segundo cuadro con las ruedas giradas 45°).
JSON de pelotas: {"nombre": {"box": [x0, y0, x1, y1], "size": 32}}

El color del fondo se toma del píxel (5, 5) de la imagen.
"""
import json
import sys
from PIL import Image, ImageDraw


def dist(c, bg):
    return abs(c[0] - bg[0]) + abs(c[1] - bg[1]) + abs(c[2] - bg[2])


def is_bg_edge(c, bg):
    """Fondo o borde suavizado del fondo: cerca del azul Y con el azul dominante.
    Así no se borran las cubiertas negras ni los vidrios oscuros, que tienen un color parecido pero no son azules."""
    r, g, b = c[:3]
    return dist(c, bg) <= 60 and b - max(r, g) > 25


def cut(im, box, bg, erase=None, holes=False):
    x0, y0, _, _ = box
    img = im.crop(box).convert('RGBA')
    px = img.load()
    w, h = img.size
    clear = set()
    # 1) Fondo conectado con el borde del recorte (relleno tipo "balde de pintura")
    stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while stack:
        x, y = stack.pop()
        if (x, y) in clear or not (0 <= x < w and 0 <= y < h) or not is_bg_edge(px[x, y], bg):
            continue
        clear.add((x, y))
        stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    # 2) Fondo encerrado (solo si se pide) y zonas a borrar
    for y in range(h):
        for x in range(w):
            if holes and dist(px[x, y], bg) <= 18:
                clear.add((x, y))
            if erase and erase[0] <= x + x0 < erase[2] and erase[1] <= y + y0 < erase[3]:
                clear.add((x, y))
    for x, y in clear:
        px[x, y] = (0, 0, 0, 0)
    return img


def spin_wheels(car, wheels):
    """Gira 45° cada rueda (círculo) para el segundo cuadro."""
    out = car.copy()
    for cx, cy, r in wheels:
        box = (cx - r, cy - r, cx + r, cy + r)
        disc = car.crop(box).rotate(45, resample=Image.Resampling.NEAREST)
        mask = Image.new('L', disc.size, 0)
        ImageDraw.Draw(mask).ellipse((0, 0, 2 * r - 1, 2 * r - 1), fill=255)
        out.paste(disc, box[:2], mask)
    return out


def shrink(img, width, height=None):
    h = height or round(img.height * width / img.width)
    small = img.convert('RGBa').resize((width, h), Image.Resampling.BOX).convert('RGBA')
    px = small.load()
    for y in range(h):  # bordes nítidos: cada píxel es todo o nada
        for x in range(width):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a >= 140 else (0, 0, 0, 0)
    return small


if __name__ == '__main__':
    src, out, mode, spec = sys.argv[1], sys.argv[2], sys.argv[3], json.loads(sys.argv[4])
    im = Image.open(src).convert('RGB')
    bg = im.getpixel((5, 5))
    for name, s in spec.items():
        img = cut(im, tuple(s['box']), bg, s.get('erase'), s.get('holes', False))
        if mode == 'cars':
            width = s.get('width', 100)
            shrink(img, width).save(f'{out}/{name}.png')
            shrink(spin_wheels(img, s['wheels']), width).save(f'{out}/{name}_b.png')
        else:
            img = img.crop(img.getbbox())  # pegado al borde de la pelota
            size = s.get('size', 32)
            shrink(img, size, size).save(f'{out}/{name}.png')
    print('ok')
