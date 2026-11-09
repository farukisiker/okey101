"""Draw the Okey 101 app icons (run: python app/scripts/make-icons.py).

Writes into app/assets:
  icon.png                    1024 iOS/legacy icon (no alpha)
  adaptive-icon.png           Android adaptive foreground (transparent, safe-zone sized)
  adaptive-icon-bg.png        Android adaptive background (felt)
  adaptive-icon-mono.png      Android 13 themed (monochrome) icon
  store-icon-512.png          Play Console hi-res icon
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets')
SS = 4  # supersampling
FONT = r'C:\Windows\Fonts\seguibl.ttf'

FELT_IN = (26, 112, 82)
FELT_OUT = (6, 38, 28)
TILE = (251, 246, 233)
TILE_EDGE = (201, 191, 166)
RED = (208, 49, 45)
BLUE = (31, 95, 191)
BLACK = (29, 29, 29)
GOLD = (242, 182, 50)


def felt(size):
    """Radial felt gradient, lighter in the middle."""
    small = 256
    im = Image.new('RGB', (small, small))
    px = im.load()
    c = small / 2
    for y in range(small):
        for x in range(small):
            d = min(1.0, math.hypot(x - c, y - c * 0.9) / (small * 0.72))
            t = d ** 1.4
            px[x, y] = tuple(int(a + (b - a) * t) for a, b in zip(FELT_IN, FELT_OUT))
    return im.resize((size, size), Image.BICUBIC)


def tile(w, h, label, color, mark=True, font_scale=0.42):
    """One ivory okey tile with a coloured number and a dot, on a transparent canvas."""
    pad = int(w * 0.25)
    im = Image.new('RGBA', (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    r = int(w * 0.14)
    # soft shadow
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((pad + w * 0.04, pad + h * 0.05, pad + w * 1.04, pad + h * 1.05), r, fill=(0, 0, 0, 150))
    im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(w * 0.06)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((pad, pad, pad + w, pad + h), r, fill=TILE_EDGE)
    edge = max(2, int(w * 0.035))
    d.rounded_rectangle((pad + edge, pad + edge, pad + w - edge, pad + h - edge * 2.2), r - edge, fill=TILE)
    font = ImageFont.truetype(FONT, int(h * font_scale))
    cx = pad + w / 2
    ty = pad + h * (0.40 if mark else 0.47)
    while d.textlength(label, font=font) > w * 0.86:
        font = ImageFont.truetype(FONT, int(font.size * 0.94))
    d.text((cx, ty), label, font=font, fill=color, anchor='mm')
    if mark:
        rr = w * 0.085
        cy = pad + h * 0.76
        d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=color)
    return im


def paste_rotated(canvas, im, center, angle):
    rot = im.rotate(angle, resample=Image.BICUBIC, expand=True)
    x = int(center[0] - rot.width / 2)
    y = int(center[1] - rot.height / 2)
    canvas.alpha_composite(rot, (x, y))


def tiles_layer(size, scale=1.0):
    """Three fanned tiles: two behind, the 101 tile in front."""
    S = size
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    w, h = int(S * 0.36 * scale), int(S * 0.50 * scale)
    cx, cy = S / 2, S / 2 + S * 0.02 * scale
    off = S * 0.17 * scale
    paste_rotated(layer, tile(int(w * 0.92), int(h * 0.92), '13', BLUE), (cx - off, cy + S * 0.01 * scale), 17)
    paste_rotated(layer, tile(int(w * 0.92), int(h * 0.92), '1', BLACK), (cx + off, cy + S * 0.01 * scale), -17)
    paste_rotated(layer, tile(int(w * 1.12), int(h * 1.08), '101', RED, font_scale=0.40), (cx, cy - S * 0.01 * scale), 0)
    return layer


def save(im, name, size, mode='RGBA'):
    im = im.resize((size, size), Image.LANCZOS)
    if mode == 'RGB':
        im = im.convert('RGB')
    im.save(os.path.join(OUT, name), optimize=True)
    print('wrote', name, im.size, im.mode)


def main():
    S = 1024 * SS
    bg = felt(S).convert('RGBA')

    icon = bg.copy()
    icon.alpha_composite(tiles_layer(S, 1.0))
    save(icon, 'icon.png', 1024, 'RGB')
    save(icon, 'store-icon-512.png', 512, 'RGB')

    # Android adaptive: launchers mask to a circle/squircle of ~66% of the canvas.
    save(tiles_layer(S, 0.8), 'adaptive-icon.png', 1024)
    save(bg, 'adaptive-icon-bg.png', 1024, 'RGB')

    # Themed icon: shape only, the launcher tints it.
    fg = tiles_layer(S, 0.8)
    # Ivory tile faces stay, coloured numbers and shadows drop out.
    a = fg.getchannel('A').point(lambda v: 255 if v > 200 else 0)
    lum = fg.convert('L').point(lambda v: 255 if v > 170 else 0)
    alpha = Image.composite(lum, Image.new('L', fg.size, 0), a)
    mono = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    mono.paste((255, 255, 255, 255), mask=alpha)
    save(mono, 'adaptive-icon-mono.png', 1024)


if __name__ == '__main__':
    main()
