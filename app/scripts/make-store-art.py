"""Play Store feature graphic (1024x500) for Demli Okey.

Run: python app/scripts/make-store-art.py [en]  ->  app/store/feature-graphic.png (Turkish)
                                                or app/store/feature-graphic-en.png (English)
Reuses the tile drawing from make-icons.py so the store art matches the app icon.
"""
import importlib.util
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(__file__)
spec = importlib.util.spec_from_file_location('icons', os.path.join(HERE, 'make-icons.py'))
ic = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ic)

OUT = os.path.join(HERE, '..', 'store')
SS = 3
W, H = 1024 * SS, 500 * SS
TEXT = (244, 241, 232)
BROWN = (74, 50, 30)


def text_shadowed(img, xy, s, font, fill, anchor='lm', stroke=0):
    sh = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).text((xy[0] + 6, xy[1] + 10), s, font=font, anchor=anchor, fill=(0, 0, 0, 150),
                            stroke_width=stroke, stroke_fill=(0, 0, 0, 150))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10)))
    ImageDraw.Draw(img).text(xy, s, font=font, anchor=anchor, fill=fill, stroke_width=stroke, stroke_fill=BROWN)


TEXTS = {
    'tr': ('DEMLİ', '101 ve Düz Okey', 'İnternetsiz oyna · Arkadaşlarınla masa kur', 'feature-graphic.png'),
    'en': ('DEMLI', '101 & Classic Okey', 'Play offline · Set up a table with friends', 'feature-graphic-en.png'),
}


def main():
    brand, sub_text, tagline, out_name = TEXTS[sys.argv[1] if len(sys.argv) > 1 else 'tr']
    os.makedirs(OUT, exist_ok=True)
    side = W
    bg = ic.felt(side).crop((0, (side - H) // 2, W, (side - H) // 2 + H)).convert('RGBA')

    # Tile fan on the left.
    S = int(H * 1.05)
    tw, th = int(S * 0.30), int(S * 0.42)
    cx, cy = W * 0.23, H * 0.52
    off = S * 0.19
    ic.paste_rotated(bg, ic.tile(tw, th, '11', ic.BLUE), (cx - off, cy + S * 0.03), 15)
    ic.paste_rotated(bg, ic.tile(tw, th, '13', ic.BLACK), (cx + off, cy + S * 0.03), -15)
    ic.paste_rotated(bg, ic.tile(int(tw * 1.08), int(th * 1.08), '12', ic.RED, font_scale=0.46), (cx, cy), 0)

    # Title and tagline on the right.
    x = W * 0.45
    avail = W * 0.52

    def fit(path, size, text):
        f = ImageFont.truetype(path, size)
        while ImageDraw.Draw(bg).textlength(text, font=f) > avail:
            f = ImageFont.truetype(path, int(f.size * 0.95))
        return f

    title = fit(ic.FONT, int(H * 0.25), f'{brand} OKEY')
    text_shadowed(bg, (x, H * 0.36), brand, title, ic.GOLD, stroke=int(H * 0.012))
    d = ImageDraw.Draw(bg)
    w_demli = d.textlength(brand + ' ', font=title)
    text_shadowed(bg, (x + w_demli, H * 0.36), 'OKEY', title, TEXT, stroke=int(H * 0.012))
    sub = ImageFont.truetype(ic.FONT, int(H * 0.085))
    text_shadowed(bg, (x + 6, H * 0.62), sub_text, sub, TEXT)
    small = fit(r'C:\Windows\Fonts\segoeuib.ttf', int(H * 0.06), tagline)
    text_shadowed(bg, (x + 8, H * 0.76), tagline, small, (169, 194, 182))

    bg.resize((1024, 500), Image.LANCZOS).convert('RGB').save(os.path.join(OUT, out_name), optimize=True)
    print('wrote store/' + out_name)


if __name__ == '__main__':
    main()
