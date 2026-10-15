"""Builds home.html (The Day) from the research and the edition plan.

python -I tools/build.py   (from the project root)

research/news.json    sourced items for the day (ids d01…)
research/photos.json  archive photos (ids ph01…), files in assets/img/photo/
tools/edition.json    the editors' running order: lead, parts of the day, slots, briefs, margins
tools/tpl/home.html   the page; <!--@name--> markers are filled here (never hand-edit home.html)

Also writes assets/js/edition.js (data the identity book borrows) and the book's dial sample.
"""
import html, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = '5'

def load(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return json.load(f)

news = load('research/news.json')
photos = load('research/photos.json')
plan = load('tools/edition.json')
ITEMS = {i['id']: i for i in news['items']}
PH = {p['id']: p for p in (photos['photos'] if isinstance(photos, dict) else photos)}
ED = news['edition']['date']                          # 2026-10-14
Y, M, D = (int(x) for x in ED.split('-'))
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
SHORTM = [m[:3] for m in MONTHS]

def e(s):
    return html.escape(str(s or ''), quote=True)

def esc_text(s):
    """Escape, then typographic quotes/apostrophes for prose."""
    s = html.escape(str(s or ''), quote=False)
    s = s.replace('"', '&quot;')
    s = re.sub(r'(^|[\s(\[—–-])&quot;', r'\1“', s)
    s = s.replace('&quot;', '”')
    s = re.sub(r"(\w)'(\w)", r'\1’\2', s)
    s = re.sub(r"(^|[\s(\[—–-])'", r'\1‘', s)
    s = s.replace("'", '’').replace('&#x27;', '’')
    s = s.replace(' -- ', ' — ')
    return s

def item(i):
    if i not in ITEMS:
        raise SystemExit('edition.json names an item that is not in news.json: ' + i)
    return ITEMS[i]

def t_of(slot_or_item, it=None):
    t = slot_or_item.get('time') if isinstance(slot_or_item, dict) else None
    if not t and it:
        t = it.get('time')
    return t

def sid(t, used):
    base = 's' + t.replace(':', '')
    k, n = base, 2
    while k in used:
        k = base + chr(96 + n); n += 1
    used.add(k)
    return k

def src_link(it, label=None):
    name = e(it.get('source_name') or 'Source')
    url = it.get('source_url')
    return f'<a href="{e(url)}" rel="noopener">{label or name}</a>' if url else name

def photo_fig(pid, cls='', sizes='(max-width: 760px) 100vw, 760px', ratio=None, eager=False):
    p = PH[pid]
    f = p['file']
    w, h = p.get('w', 1280), p.get('h', 853)
    cap = esc_text(p.get('caption', ''))
    credit = ' '.join(x for x in [
        ('Photo: ' + e(p['author'])) if p.get('author') else '',
        ('via Wikimedia Commons') if p.get('commons_page') else '',
    ] if x)
    lic = e(p.get('license', ''))
    lic_html = f'<a href="{e(p.get("license_url"))}" rel="noopener license">{lic}</a>' if p.get('license_url') else lic
    src_html = f'<a href="{e(p.get("commons_page"))}" rel="noopener">{credit}</a>' if p.get('commons_page') else credit
    st = f' style="aspect-ratio:{ratio}"' if ratio else ''
    load = 'eager" fetchpriority="high' if eager else 'lazy'
    return (f'<figure{(" class=" + chr(34) + cls + chr(34)) if cls else ""}><img src="{e(f)}-1280.webp" srcset="{e(f)}-640.webp 640w, {e(f)}-1280.webp 1280w" sizes="{sizes}" '
            f'width="{w}" height="{h}" alt="{e(p.get("alt", ""))}" loading="{load}" decoding="async"{st}>'
            f'<figcaption>{cap} {src_html}, {lic_html}.</figcaption></figure>')

def dateline(it, override=None):
    place = override or it.get('dateline') or it.get('place') or ''
    place = re.sub(r'\s*\([^)]*\)', '', place).strip()
    if not place:
        return ''
    return f'<span class="dateline">{e(place)} —</span> '

KIND = {'update': 'Update', 'story': 'Story', 'report': 'Report', 'statement': 'Statement', 'figure': 'Figures', 'feature': 'Story', 'visual': 'Visual', 'analysis': 'Analysis'}

def ledger(nums, title='The figures'):
    rows = []
    for n in nums:
        cite = e(n.get('source_name', ''))
        if n.get('source_url'):
            cite = f'<a href="{e(n["source_url"])}" rel="noopener">{cite}</a>'
        asof = n.get('as_of')
        if asof and re.match(r'\d{4}-\d{2}-\d{2}', asof):
            yy, mm, dd = asof.split('-')
            cite += f', {int(dd)} {SHORTM[int(mm) - 1]} {yy}'
        rows.append(f'<div><dt>{e(n["value"])}</dt><dd>{esc_text(n["label"])}<cite>{cite}</cite></dd></div>')
    return f'<h4>{e(title)}</h4><dl class="ledger">' + ''.join(rows) + '</dl>'

def time_attr(t):
    return f'{ED}T{t}+03:00'

import datetime
WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

def render_brief(bid):
    it = item(bid)
    t = it.get('time') or ''
    when = e(t) if t else '—'
    if it.get('date') and it['date'] != ED:
        yy, mm, dd = (int(x) for x in it['date'].split('-'))
        when = WD[datetime.date(yy, mm, dd).weekday()] + '<br>' + when
    head = esc_text(it['headline'])
    url = it.get('source_url')
    h = f'<a href="{e(url)}" rel="noopener">{head}</a>' if url else head
    dt = (it.get('date') or ED) + ('T' + t + '+03:00' if t else '')
    return (f'<li><time datetime="{dt}">{when}</time><div><h4>{h}</h4>'
            f'<p>{esc_text(it.get("dek", ""))} <span class="by">{e(it.get("source_name", ""))}</span></p></div></li>')

def render_slot(s, used):
    it = item(s['item'])
    t = s.get('time') or it.get('time')
    s['_time'] = t
    s['_id'] = sid(t, used)
    kind = s.get('kind') or KIND.get(it.get('kind'), 'Update')
    layout = s.get('layout', 'standard')
    cls = 'slot' + (' big' if layout in ('big',) else '')
    head = esc_text(s.get('headline') or it['headline'])
    url = it.get('source_url')
    h3 = f'<h3 id="{s["_id"]}-h"><a href="{e(url)}" rel="noopener">{head}</a></h3>' if url else f'<h3 id="{s["_id"]}-h">{head}</h3>'
    parts = []
    if layout == 'quote' and it.get('quote'):
        q = it['quote']
        parts.append(f'<p class="quote">{esc_text(q["text"])}</p><p class="quote-by">{e(q.get("who", ""))}{", " + e(q["role"]) if q.get("role") else ""}{" (translated from " + e(q["translated_from"]) + ")" if q.get("translated_from") else ""}</p>')
    parts.append(h3)
    parts.append(f'<p class="dek">{dateline(it, s.get("dateline"))}{esc_text(s.get("dek") or it.get("dek", ""))}</p>')
    body = it.get('body', [])
    nb = s.get('paras', 2 if layout in ('big', 'story', 'two') else 1)
    paras = ''.join(f'<p>{esc_text(p)}</p>' for p in body[:nb])
    photo = s.get('photo')
    if layout == 'two' and photo:
        parts.append(f'<div class="two"><div>{paras}</div>{photo_fig(photo, sizes="(max-width: 860px) 100vw, 380px")}</div>')
    else:
        if photo:
            parts.append(photo_fig(photo, sizes='(max-width: 760px) 100vw, 800px'))
        if paras:
            parts.append(f'<div class="cols">{paras}</div>' if layout == 'big' and nb > 1 else paras)
    if s.get('briefs'):
        bt = s.get('briefs_title')
        parts.append((f'<h4 class="briefs-h">{e(bt)}</h4>' if bt else '<h4 class="sr">Also in this hour</h4>') + '<ul class="briefs">' + ''.join(render_brief(b) for b in s['briefs']) + '</ul>')
    if s.get('ahead'):
        lis = []
        for a in news.get('ahead', []):
            yy, mm, dd = a['date'].split('-')
            wd = WD[datetime.date(int(yy), int(mm), int(dd)).weekday()]
            lab = f'<a href="{e(a["source_url"])}" rel="noopener">{esc_text(a["label"])}</a>' if a.get('source_url') else f'<b>{esc_text(a["label"])}</b>'
            yr = f' {yy}' if int(yy) != Y else ''
            lis.append(f'<li><time datetime="{e(a["date"])}"><small>{wd}</small>{int(dd)} {SHORTM[int(mm) - 1]}{yr}</time><p>{lab}{esc_text(a.get("detail", ""))}</p></li>')
        parts.append('<h4 class="briefs-h">Ahead</h4><ol class="ahead">' + ''.join(lis) + '</ol>')
    rel = ''
    if it.get('related_urls'):
        rel = ' · also ' + ', '.join(f'<a href="{e(u)}" rel="noopener">{i + 1}</a>' for i, u in enumerate(it['related_urls'][:3]))
    parts.append(f'<p class="src"><span class="kind">{e(kind)}</span> · Source: {src_link(it)}, {D} {SHORTM[M - 1]}{(", " + e(it.get("time"))) if it.get("time") else ""}{rel}</p>')
    # margin
    mg = s.get('margin')
    margin = ''
    if mg == 'ledger' or (mg is None and it.get('numbers')):
        nums = list(it.get('numbers', [])) if s.get('margin_own', True) else []
        for x in s.get('margin_from', []):
            nums += item(x).get('numbers', [])
        nums = nums[: s.get('margin_max', 3)]
        if nums:
            margin = f'<aside class="margin" aria-label="Figures">{ledger(nums, s.get("margin_title", "The figures"))}</aside>'
    elif isinstance(mg, dict) and mg.get('note'):
        margin = f'<aside class="margin" aria-label="Note"><h4>{e(mg.get("title", "Context"))}</h4><p class="note">{esc_text(mg["note"])}</p></aside>'
    elif isinstance(mg, dict) and mg.get('photo'):
        margin = f'<aside class="margin" aria-label="Photograph">{photo_fig(mg["photo"], sizes="300px")}</aside>'
    if not margin:
        margin = '<aside class="margin" aria-hidden="true" style="border:0"></aside>'
    state = s.get('state', '')
    when = (f'<div class="when"><time datetime="{time_attr(t)}">{t}</time>'
            f'<span class="sunat"><span data-stamp="{t}"{(" data-state=" + chr(34) + state + chr(34)) if state else ""}></span><span data-alt>Sun</span></span>'
            f'</div>')
    return f'<article class="{cls}" id="{s["_id"]}" data-time="{t}" aria-labelledby="{s["_id"]}-h">{when}<div class="story">{"".join(parts)}</div>{margin}</article>'

# ---------- render ----------
used = set()
parts_html, index_items = [], []
regions_first = {}
for p in plan['parts']:
    slots_html = []
    for s in p['slots']:
        slots_html.append(render_slot(s, used))
        it = item(s['item'])
        index_items.append((s['_time'], s['_id'], s.get('label') or it['headline'][:40]))
        for r in [it.get('region')] + [item(b).get('region') for b in s.get('briefs', [])]:
            if r and r not in regions_first:
                regions_first[r] = s['_id']
        if (it.get('kind') in ('story', 'feature') or s.get('kind') == 'Story') and 'story' not in regions_first:
            regions_first['story'] = s['_id']
    pid = 'p-' + p['key']
    parts_html.append(
        f'<section class="part" id="{pid}" data-at="{p["at"]}" data-span="{p["from"]}-{p["to"]}" aria-labelledby="{pid}-h"><div class="wrap">'
        f'<header class="part-head"><p class="span"><b>{p["from"]}–{p["to"]}</b><span class="light">{e(p["light"])}</span></p>'
        f'<h2 id="{pid}-h">{esc_text(p["title"])}</h2>'
        f'<p class="sundata" data-sundata="{p["from"]}-{p["to"]}"></p></header>'
        + ''.join(slots_html) + '</div></section>')

# lead
L = plan['lead']
lit = item(L['item'])
lead_slot = next((s for p in plan['parts'] for s in p['slots'] if s['item'] == L['item']), None)
lead_href = '#' + lead_slot['_id'] if lead_slot else e(lit.get('source_url'))
lead_t = lead_slot['_time'] if lead_slot else lit.get('time')
more = []
for m in L.get('more', []):
    mi = item(m)
    ms = next((s for p in plan['parts'] for s in p['slots'] if s['item'] == m or m in s.get('briefs', [])), None)
    href = '#' + ms['_id'] if ms else e(mi.get('source_url'))
    place = re.sub(r'\s*\([^)]*\)', '', mi.get('place', '')).split(',')[0]
    more.append(f'<a href="{href}"><h3>{esc_text(mi["headline"])}</h3><span class="filed"><span data-stamp="{e(mi.get("time"))}"></span>{e(mi.get("time"))} · {e(place)}</span></a>')
lead_html = (
    f'<article class="lead" aria-labelledby="lead-h"><div class="lead-text">'
    f'<h2 class="hl" id="lead-h"><a href="{e(lit.get("source_url"))}" rel="noopener">{esc_text(L.get("headline") or lit["headline"])}</a></h2>'
    f'<p class="dek">{dateline(lit, L.get("dateline"))}{esc_text(L.get("dek") or lit.get("dek", ""))}</p>'
    f'<p class="filed"><span data-stamp="{lead_t}"></span><span>Filed {lead_t} · <span data-alt-at="{lead_t}"></span> · {e(lit.get("source_name", ""))}</span><a href="{lead_href}">Read it in its hour</a></p>'
    f'</div>{photo_fig(L["photo"], sizes="(max-width: 860px) 100vw, 540px", ratio="3 / 2", eager=True)}'
    + '</article>')
more_html = (f'      <div class="more-lead">{"".join(more)}</div>' if more else '')

# index
index_items.sort(key=lambda x: x[0])
idx = f'<ol class="dial-index" style="--n:{len(index_items)}">' + ''.join(
    f'<li><a href="#{i}" data-t="{t}"><time>{t}</time><span>{e(lab)}</span></a></li>' for t, i, lab in index_items) + '</ol>'

# nav
NAV = [('The Day', '#day', True), ('Gaza', regions_first.get('gaza')), ('West Bank', regions_first.get('west-bank')), ('Jerusalem', regions_first.get('jerusalem')),
       ('Prisoners', regions_first.get('prisoners')), ('World', regions_first.get('world')), ('Stories', regions_first.get('story'))]
nav = []
for n in NAV:
    if len(n) == 3:
        nav.append(f'        <li><a href="{n[1]}" aria-current="page">{n[0]}</a></li>')
    elif n[1]:
        nav.append(f'        <li><a href="#{n[1]}">{n[0]}</a></li>')
nav = '\n'.join(nav)

times = [t for t, _, _ in index_items]
edmeta = (f'        <p>{len(index_items)} slots · first filed {times[0]} · last {times[-1]} · Palestine time (UTC+3)'
          f' <a data-continue hidden href="#day">Continue from <b>—</b></a></p>')
legend = '      <p class="dial-legend" data-dial-legend></p>'

# credits
used_ph = sorted({x for x in re.findall(r'assets/img/photo/(ph\d+)-1280', ''.join(parts_html) + lead_html)})
cred = []
for pid_ in used_ph:
    p = PH[pid_]
    cred.append(f'{e(p.get("author", ""))} ({e(p.get("license", ""))})')
credits = ('      <p>Every report on this page links to the source it was read from, and each figure names who counted it. Times are when the source published, in Palestine time. Archive photographs from Wikimedia Commons, each dated in its caption: '
           + '; '.join(cred) + '.</p>\n'
           f'      <p>Edition of Wednesday 14 October 2026, closed at {e(news["edition"].get("closed", "23:59"))}. A TakTek prototype for In Palestine Today: social accounts, newsletter and masthead details are placeholders. <a href="index.html">Identity book</a>.</p>')

tpl = open(os.path.join(ROOT, 'tools', 'tpl', 'home.html'), encoding='utf-8').read()
signup_at = plan.get('signup_at', '23:40')
out = (tpl.replace('<!--@nav-->', nav).replace('<!--@edmeta-->', edmeta).replace('<!--@lead-->', lead_html)
          .replace('<!--@index-->', idx).replace('<!--@legend-->', legend).replace('<!--@parts-->', '\n'.join(parts_html))
          .replace('<!--@credits-->', credits).replace('<!--@more-->', more_html).replace('@SIGNUPAT', signup_at).replace('@V', V))
assert '<!--@' not in out, 'unfilled marker'
with open(os.path.join(ROOT, 'home.html'), 'w', encoding='utf-8') as f:
    f.write(out)

# data the identity book borrows
top = [[item(x).get('time'), item(x)['headline']] for x in plan.get('book_top', [])]
bp = plan.get('book_photo')
book = {'top': top}
if bp:
    p = PH[bp['photo']]
    book['photo'] = {'src': p['file'] + '-640.webp', 'alt': p.get('alt', ''), 'caption': p.get('caption', '') + ' Photo: ' + p.get('author', '') + ', via Wikimedia Commons, ' + p.get('license', '') + '.', 'headline': item(bp['item'])['headline'], 'time': item(bp['item']).get('time')}
bsp = plan.get('book_section_photo')
if bsp:
    p = PH[bsp]
    book['section'] = {'src': p['file'] + '-1280.webp', 'alt': p.get('alt', ''), 'w': p.get('w'), 'h': p.get('h'),
                       'caption': p.get('caption', '') + ' Photo: ' + p.get('author', '') + ', via Wikimedia Commons, ' + p.get('license', '') + '.'}
with open(os.path.join(ROOT, 'assets', 'js', 'edition.js'), 'w', encoding='utf-8') as f:
    f.write('/* generated by tools/build.py */\nwindow.IPT_EDITION_TOP=' + json.dumps(book['top'], ensure_ascii=False) + ';\nwindow.IPT_BOOK_PHOTO=' + json.dumps(book.get('photo'), ensure_ascii=False)
            + ';\nwindow.IPT_BOOK_SECTION_PHOTO=' + json.dumps(book.get('section'), ensure_ascii=False) + ';\n')

# the book's dial sample: five slots of the real day
bd = plan.get('book_dial', [])
if bd:
    lis = []
    for sid_ in bd:
        for t, i, lab in index_items:
            if i == sid_:
                lis.append(f'          <li><a href="home.html#{i}" data-t="{t}"><time>{t}</time><span>{e(lab)}</span></a></li>')
    book_html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    new = f'<ol class="dial-index" style="--n:{len(lis)}">\n' + '\n'.join(lis) + '\n        </ol>'
    book_html = re.sub(r'<ol class="dial-index" style="--n:\d+">.*?</ol>', new, book_html, count=1, flags=re.S)
    with open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(book_html)

print('home.html', len(out) // 1024, 'KB ·', len(index_items), 'slots ·', len(used_ph), 'photos')
