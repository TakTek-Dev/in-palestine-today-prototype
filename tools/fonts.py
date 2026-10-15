"""Self-hosted, feature-complete WOFF2 subsets of the two brand faces.

python -I tools/fonts.py   (from the project root)

Piazzolla (Huerta Tipográfica, OFL) carries the people: wordmark, headlines, reading, small caps, slot times.
Archivo (Omnibus-Type, Buenos Aires, OFL) carries the sun's instruments: live clock, Day Dial, sun data, navigation,
captions. Its width axis (62–125) runs the dial's labels narrow and the clock wide.
Every OpenType layout feature is kept (small caps, oldstyle/lining/tabular figures, fractions, case).
"""
import os
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'research', 'font-src')
OUT = os.path.join(ROOT, 'assets', 'fonts')
os.makedirs(OUT, exist_ok=True)

# Basic Latin + Latin-1 + the Latin Extended-A letters Palestinian and Arabic transliteration uses
# (ā ī ū ḥ ṣ ḍ ṭ ẓ ʿ ʾ), typographic punctuation, arrows, degree, minus.
UNICODES = (
    list(range(0x20, 0x7F)) + list(range(0xA0, 0x180)) +
    [0x1E0C, 0x1E0D, 0x1E24, 0x1E25, 0x1E62, 0x1E63, 0x1E6C, 0x1E6D, 0x1E92, 0x1E93, 0x02BE, 0x02BF,
     0x2009, 0x200A, 0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026,
     0x2032, 0x2033, 0x2039, 0x203A, 0x2044, 0x20AC, 0x2116, 0x2190, 0x2191, 0x2192, 0x2193, 0x2212, 0x2248,
     0x2260, 0x2264, 0x2265, 0x00B0, 0x00B7, 0x2070, 0x00B9, 0x00B2, 0x00B3, 0x2074, 0x2075, 0x2076, 0x2077,
     0x2078, 0x2079, 0x2153, 0x2154, 0x00BC, 0x00BD, 0x00BE]
)

JOBS = [
    ('Piazzolla[opsz,wght].ttf', 'piazzolla-var.woff2'),
    ('Piazzolla-Italic[opsz,wght].ttf', 'piazzolla-italic-var.woff2'),
    ('Archivo[wdth,wght].ttf', 'archivo-var.woff2'),
]

for src, out in JOBS:
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.name_languages = ['*']
    opts.notdef_outline = True
    opts.glyph_names = False
    opts.hinting = False
    opts.desubroutinize = True
    font = subset.load_font(os.path.join(SRC, src), opts)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=UNICODES)
    sub.subset(font)
    path = os.path.join(OUT, out)
    subset.save_font(font, path, opts)
    print(out, os.path.getsize(path) // 1024, 'KB')

