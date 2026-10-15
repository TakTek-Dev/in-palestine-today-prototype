"""Draws the In Palestine Today marks from Piazzolla outlines.

python -I tools/brand.py   (from the project root)

The wordmark is the domain, inpalestine.today, set in Piazzolla at two weights: "in" and "today"
at 370, "palestine" at 720, so the name reads without spaces. Its full stop is the sun: the baseline is
the horizon, the ascender line the zenith. The static files below show the canonical state, sunrise:
the sun resting on the horizon. The site moves the stop with the real sun.

Writes assets/brand/*.svg and tools/out/marks.json (path data the identity book draws live).
"""
import json, os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'research', 'font-src', 'Piazzolla[opsz,wght].ttf')
OUTB = os.path.join(ROOT, 'assets', 'brand')
OUTT = os.path.join(ROOT, 'tools', 'out')
os.makedirs(OUTB, exist_ok=True); os.makedirs(OUTT, exist_ok=True)

SHADOW, STONE, NIGHT, MOON, SUN = '#15182A', '#F5F3EE', '#0E1120', '#E9E8F0', '#E4401F'

def instance(wght):
    f = TTFont(SRC)
    return instancer.instantiateVariableFont(f, {'wght': wght, 'opsz': 30})

LIGHT, BOLD = instance(370), instance(720)
UPM = LIGHT['head'].unitsPerEm
TRACK = -0.016 * UPM

def kern_table(font):
    """First-glyph -> second-glyph -> x-advance adjustment from GPOS 'kern' pair lookups."""
    gpos = font['GPOS'].table
    idx = set()
    for fr in gpos.FeatureList.FeatureRecord:
        if fr.FeatureTag == 'kern':
            idx.update(fr.Feature.LookupListIndex)
    pairs = {}
    def sub_tables(lk):
        for st in lk.SubTable:
            yield st.ExtSubTable if lk.LookupType == 9 else st
    for i in sorted(idx):
        lk = gpos.LookupList.Lookup[i]
        for st in sub_tables(lk):
            if getattr(st, 'LookupType', 2) != 2 and lk.LookupType not in (2, 9):
                continue
            cov = st.Coverage.glyphs
            if st.Format == 1:
                for g1, ps in zip(cov, st.PairSet):
                    for pv in ps.PairValueRecord:
                        v = pv.Value1.XAdvance if pv.Value1 is not None and hasattr(pv.Value1, 'XAdvance') else 0
                        pairs.setdefault(g1, {}).setdefault(pv.SecondGlyph, v)
            elif st.Format == 2:
                c1 = st.ClassDef1.classDefs if st.ClassDef1 else {}
                c2 = st.ClassDef2.classDefs if st.ClassDef2 else {}
                for g1 in cov:
                    cl1 = c1.get(g1, 0)
                    rec = st.Class1Record[cl1]
                    for g2, cl2 in list(c2.items()) + []:
                        v1 = rec.Class2Record[cl2].Value1
                        v = getattr(v1, 'XAdvance', 0) if v1 is not None else 0
                        if v:
                            pairs.setdefault(g1, {}).setdefault(g2, v)
    return pairs

KERN = {id(LIGHT): kern_table(LIGHT), id(BOLD): kern_table(BOLD)}

def glyph(font, ch):
    return font.getBestCmap()[ord(ch)]

def run(text, font, x0):
    gs, hm, cmap = font.getGlyphSet(), font['hmtx'], font.getBestCmap()
    k = KERN[id(font)]
    x, out, prev = x0, [], None
    for ch in text:
        g = cmap[ord(ch)]
        if prev is not None:
            x += k.get(prev, {}).get(g, 0) + TRACK
        pen = SVGPathPen(gs)
        gs[g].draw(TransformPen(pen, (1, 0, 0, -1, x, 0)))
        out.append(pen.getCommands())
        x += hm[g][0]
        prev = g
    return ''.join(out), x, prev

def bounds(font, ch):
    bp = BoundsPen(font.getGlyphSet()); font.getGlyphSet()[glyph(font, ch)].draw(bp); return bp.bounds

ASC = bounds(BOLD, 'l')[3]          # ascender line of 'l' = the zenith
XH = bounds(BOLD, 'x')[3]
DOT = 0.205 * UPM                   # sun diameter (same as the CSS: .205em)
BOX = 0.27 * UPM                    # the stop's box width

def wordmark(h=0.0):
    """h: 0 = sun resting on the baseline (sunrise), 1 = at the ascender line (zenith)."""
    p1, x, last = run('in', LIGHT, 0)
    p2, x, last = run('palestine', BOLD, x + TRACK)
    xs = x + 0.022 * UPM
    cx = xs + BOX / 2
    x = xs + BOX + 0.012 * UPM
    p3, x, _ = run('today', LIGHT, x)
    cy = -(DOT / 2 + h * (0.74 * UPM - DOT))
    return {'paths': p1 + p2 + p3, 'sun': (round(cx, 1), round(cy, 1), round(DOT / 2, 1)), 'width': round(x, 1)}

def monogram():
    p1, x, _ = run('in', BOLD, 0)
    xs = x + 0.03 * UPM
    cx = xs + DOT / 2
    return {'paths': p1, 'sun': (round(cx, 1), round(-DOT / 2, 1), round(DOT / 2, 1)), 'width': round(cx + DOT / 2, 1)}

WM, MONO = wordmark(0.0), monogram()
desc = abs(min(bounds(LIGHT, 'y')[1], bounds(BOLD, 'p')[1]))
top = max(ASC, bounds(BOLD, 'l')[3])

def svg_wordmark(ink, sun, bg=None, pad=0.18, title='In Palestine Today'):
    P = pad * UPM
    w, h = WM['width'] + 2 * P, top + desc + 2 * P
    cx, cy, r = WM['sun']
    body = (f'<rect width="{w:.0f}" height="{h:.0f}" fill="{bg}"/>' if bg else '')
    body += f'<g transform="translate({P:.1f} {P + top:.1f})"><path fill="{ink}" d="{WM["paths"]}"/><circle cx="{cx}" cy="{cy}" r="{r}" fill="{sun}"/></g>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" role="img" aria-label="{title}"><title>{title}</title>{body}</svg>'

def svg_monogram(ink, sun, bg, size=1000, title='In Palestine Today'):
    s = size * 0.62 / MONO['width']
    gw = MONO['width'] * s
    ox = (size - gw) / 2
    oy = size / 2 + (top * s) / 2 - (desc * 0.0)
    cx, cy, r = MONO['sun']
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" role="img" aria-label="{title}"><title>{title}</title>'
            f'<rect width="{size}" height="{size}" fill="{bg}"/>'
            f'<g transform="translate({ox:.1f} {oy:.1f}) scale({s:.4f})"><path fill="{ink}" d="{MONO["paths"]}"/><circle cx="{cx}" cy="{cy}" r="{r}" fill="{sun}"/></g></svg>')

files = {
    'wordmark-shadow.svg': svg_wordmark(SHADOW, SUN),
    'wordmark-shadow-on-stone.svg': svg_wordmark(SHADOW, SUN, STONE),
    'wordmark-moonlight-on-night.svg': svg_wordmark(MOON, SUN, NIGHT),
    'wordmark-moonlight.svg': svg_wordmark(MOON, SUN),
    'monogram-night.svg': svg_monogram(MOON, SUN, NIGHT),
    'monogram-shadow.svg': svg_monogram(MOON, SUN, SHADOW),
    'monogram-stone.svg': svg_monogram(SHADOW, SUN, STONE),
}
for name, svg in files.items():
    with open(os.path.join(OUTB, name), 'w', encoding='utf-8') as f:
        f.write(svg)
    print(name, len(svg) // 1024, 'KB')

# favicon (static fallback; the site redraws it live with the sun at its height)
fav = svg_monogram(MOON, SUN, SHADOW, size=64)
with open(os.path.join(ROOT, 'favicon.svg'), 'w', encoding='utf-8') as f:
    f.write(fav)

marks = {'upm': UPM, 'asc': round(ASC, 1), 'xh': round(XH, 1), 'top': round(top, 1), 'desc': round(desc, 1), 'dot': round(DOT, 1),
         'wordmark': WM, 'monogram': MONO}
with open(os.path.join(OUTT, 'marks.json'), 'w', encoding='utf-8') as f:
    json.dump(marks, f)
print('asc', ASC, 'xh', XH, 'top', top, 'desc', desc, 'width', WM['width'])

# the monogram as data for the live favicon (assets/js/marks.js)
mono_js = {'d': MONO['paths'], 'w': MONO['width'], 'sun': MONO['sun'], 'top': round(top, 1), 'asc': round(ASC, 1), 'upm': UPM}
with open(os.path.join(ROOT, 'assets', 'js', 'marks.js'), 'w', encoding='utf-8') as f:
    f.write('/* generated by tools/brand.py: the monogram "in." outlines for the live favicon */\nwindow.IPT_MARKS=' + json.dumps({'mono': mono_js}, separators=(',', ':')) + ';\n')
print('marks.js written')
