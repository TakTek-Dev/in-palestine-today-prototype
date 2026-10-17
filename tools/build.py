"""Builds the In Palestine Today site from the research and the editors' plans.

python -I tools/build.py   (from the project root)

research/news.json, research/news-YYYY-MM-DD.json   sourced items (ids d…, c…, b…)
research/photos.json                                 archive photos, files in assets/img/photo/
tools/editions/YYYY-MM-DD.json                       each day's running order: lead, parts, slots, briefs, margins
tools/tpl/parts/{head,top,foot}.html                 the shared page frame

Writes (never hand-edit these):
  home.html                    the latest edition
  day/YYYY-MM-DD.html          earlier editions
  news/YYYY-MM-DD-slug.html    one page per report or story, read in the light of the minute it was filed
  gaza.html west-bank.html jerusalem.html prisoners.html world.html   desks, day by day
  stories.html harvest.html    the human stories; the olive-harvest thread
  days.html visuals.html search.html about.html 404.html
  assets/js/search-index.js assets/js/edition.js, and the identity book's dial sample in index.html
"""
import datetime, glob, html, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = '9'
BASE_URL = 'https://taktek-dev.github.io/in-palestine-today-prototype/'
REPO_BASE = '/in-palestine-today-prototype/'

def load(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return json.load(f)

def write(path, text):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full) or ROOT, exist_ok=True)
    with open(full, 'w', encoding='utf-8') as f:
        f.write(text)

# ---------------------------------------------------------------- data
NEWS_FILES = ['research/news.json'] + sorted(os.path.relpath(p, ROOT).replace('\\', '/') for p in glob.glob(os.path.join(ROOT, 'research', 'news-*.json')))
ITEMS, HEADLINE_NUMBERS, AHEAD = {}, [], []
for nf in NEWS_FILES:
    d = load(nf)
    for it in d['items']:
        it.setdefault('date', d['edition']['date'])
        ITEMS[it['id']] = it
    HEADLINE_NUMBERS += d.get('headline_numbers', [])
    if d.get('ahead'):
        AHEAD = d['ahead']
photos = load('research/photos.json')
PH = {p['id']: p for p in (photos['photos'] if isinstance(photos, dict) else photos)}
PH = {k: v for k, v in PH.items() if os.path.exists(os.path.join(ROOT, v['file'] + '-1280.webp'))}

EDITIONS = {}
for p in sorted(glob.glob(os.path.join(ROOT, 'tools', 'editions', '*.json'))):
    EDITIONS[os.path.basename(p)[:-5]] = load(os.path.relpath(p, ROOT))
DATES = sorted(EDITIONS)                  # oldest → newest
LATEST = DATES[-1]

MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
SHORTM = [m[:3] for m in MONTHS]
WDL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
WD = [w[:3] for w in WDL]

def ymd(date):
    return tuple(int(x) for x in date.split('-'))

def long_date(date, year=True):
    y, m, d = ymd(date)
    return f'{WDL[datetime.date(y, m, d).weekday()]} {d} {MONTHS[m - 1]}' + (f' {y}' if year else '')

def short_date(date):
    y, m, d = ymd(date)
    return f'{d} {SHORTM[m - 1]}'

def weekday(date):
    y, m, d = ymd(date)
    return WDL[datetime.date(y, m, d).weekday()]

def edition_path(date):
    return 'home.html' if date == LATEST else f'day/{date}.html'

# ---------------------------------------------------------------- text
def e(s):
    return html.escape(str(s or ''), quote=True)

def esc_text(s):
    """Escape, then typographic quotes and apostrophes for prose."""
    s = html.escape(str(s or ''), quote=False)
    s = s.replace('"', '&quot;')
    s = re.sub(r'(^|[\s(\[—–-])&quot;', r'\1“', s)
    s = s.replace('&quot;', '”')
    s = re.sub(r"(\w)'(\w)", r'\1’\2', s)
    s = re.sub(r"(^|[\s(\[—–-])'", r'\1‘', s)
    s = s.replace("'", '’')
    s = s.replace(' -- ', ' — ')
    return s

def smart(s):
    s = str(s or '')
    s = re.sub(r'(^|[\s(\[—–-])"', r'\1“', s).replace('"', '”')
    s = re.sub(r"(\w)'(\w)", r'\1’\2', s)
    s = re.sub(r"(^|[\s(\[—–-])'", r'\1‘', s).replace("'", '’')
    return s

def slugify(text, n=8):
    words = re.sub(r"[^a-z0-9\s-]", '', text.lower().replace('’', '').replace("'", '')).split()
    return '-'.join(words[:n]).strip('-')

def clean_place(p):
    return re.sub(r'\s*\([^)]*\)', '', p or '').strip()

def item(i):
    if i not in ITEMS:
        raise SystemExit('an edition names an item that is not in the research: ' + i)
    return ITEMS[i]

KIND = {'update': 'Update', 'story': 'Story', 'report': 'Report', 'statement': 'Statement', 'figure': 'Figures', 'feature': 'Story', 'visual': 'Visual', 'analysis': 'Analysis'}
DESKS = [
    ('gaza', 'Gaza', 'Every report from the Gaza Strip, day by day, in Palestine time.'),
    ('west-bank', 'West Bank', 'Every report from the occupied West Bank, day by day, in Palestine time.'),
    ('jerusalem', 'Jerusalem', 'Occupied East Jerusalem and the villages of its governorate, day by day.'),
    ('prisoners', 'Prisoners', 'Palestinian prisoners and detainees, the courts and the jails, day by day.'),
    ('world', 'World', 'Governments, the UN and the region on Palestine, day by day.'),
]
DESK_NAME = {k: n for k, n, _ in DESKS}

def is_story(it):
    return it.get('kind') in ('story', 'feature') or it.get('feature')

# ---------------------------------------------------------------- where each item lives
SLOTS = {}          # date -> list of slot dicts (with _id, _time, _part)
ITEM_HOME = {}      # item id -> (edition date, slot, role)
ITEM_URL = {}       # item id -> news/... path

def sid(t, used):
    base = 's' + t.replace(':', '')
    k, n = base, 2
    while k in used:
        k = base + chr(96 + n); n += 1
    used.add(k)
    return k

for date in DATES:
    plan = EDITIONS[date]
    used, slots = set(), []
    for p in plan['parts']:
        for s in p['slots']:
            it = item(s['item'])
            s['_time'] = s.get('time') or it.get('time')
            s['_id'] = sid(s['_time'], used)
            s['_part'] = p
            slots.append(s)
    SLOTS[date] = slots
    for s in slots:
        for role, ids in (('main', [s['item']]), ('brief', s.get('briefs', []))):
            for i in ids:
                prev = ITEM_HOME.get(i)
                mine = item(i).get('date') == date
                if prev is None or (mine and ITEMS[i].get('date') != prev[0]) or (role == 'main' and prev[2] == 'brief' and prev[0] == date):
                    ITEM_HOME[i] = (date, s, role)

taken = set()
for i in sorted(ITEM_HOME, key=lambda x: (ITEMS[x]['date'], ITEMS[x].get('time') or '')):
    it = ITEMS[i]
    base = f"news/{it['date']}-{slugify(it['headline'])}"
    path, n = base + '.html', 2
    while path in taken:
        path = f'{base}-{n}.html'; n += 1
    taken.add(path)
    ITEM_URL[i] = path

def url(R, path):
    return R + path

# ---------------------------------------------------------------- shared pieces
TPL = {n: open(os.path.join(ROOT, 'tools', 'tpl', 'parts', n + '.html'), encoding='utf-8').read() for n in ('head', 'top', 'foot')}
NAV = [('day', 'The Day', 'home.html'), ('gaza', 'Gaza', 'gaza.html'), ('west-bank', 'West Bank', 'west-bank.html'), ('jerusalem', 'Jerusalem', 'jerusalem.html'),
       ('prisoners', 'Prisoners', 'prisoners.html'), ('world', 'World', 'world.html'), ('stories', 'Stories', 'stories.html')]
SEARCH_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12.6 12.6 17 17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'

def find_panel(R):
    return ('      <button class="iconbtn" type="button" data-find aria-expanded="false" aria-controls="find" aria-label="Find in this edition">' + SEARCH_ICON + '</button>\n'
            '      <div class="find" id="find" hidden>\n'
            '        <form role="search">\n'
            '          <label for="find-q">Find in this edition</label>\n'
            '          <input id="find-q" type="search" autocomplete="off" placeholder="Mukhmas, olive, Colombia…">\n'
            '        </form>\n'
            '        <ol></ol>\n'
            f'        <p class="none" hidden>Nothing in this edition matches.</p>\n'
            f'        <p class="find-all"><a href="{R}search.html">Search every day</a></p>\n'
            '      </div>\n')

def search_link(R):
    return f'      <a class="iconbtn" href="{R}search.html" aria-label="Search every day">{SEARCH_ICON}</a>\n'

SCRUB = ('          <span class="scrub">\n'
         '            <label for="hour">Preview the edition at <output for="hour">--:--</output></label>\n'
         '            <input class="range" id="hour" type="range" min="0" max="1439" step="1">\n'
         '          </span>\n')

def credits_for(body):
    used = sorted(set(re.findall(r'assets/img/photo/(ph\d+)-(?:1280|640)\.webp', body)))
    if not used:
        return ''
    cred = '; '.join(f'{e(PH[p].get("author", ""))} ({e(PH[p].get("license", ""))})' for p in used if p in PH)
    return f'      <p>Archive photographs from Wikimedia Commons, each dated and placed in its caption; none shows the events reported beside it: {cred}.</p>\n'

STANDARD_NOTE = ('      <p>Every report links to the source it was read from, and each figure names who counted it. Times are when the source published, in Palestine time (UTC+3). '
                 'A TakTek prototype for In Palestine Today: social accounts, the newsletter service and masthead details are placeholders.</p>')

def page(path, *, title, desc, body, edition=None, nav=None, skip='Skip to the content', css=(), js=(), og_type='website', og_title=None,
         find=False, scrub=False, base=False, bodyclass='', jsonld='', og_image=None, og_alt=None, art_meta=''):
    depth = path.count('/')
    R = '../' * depth
    navs = []
    for key, name, href in NAV:
        cur = ' aria-current="page"' if key == nav else ''
        navs.append(f'        <li><a href="{R}{href}"{cur}>{name}</a></li>')
    head = TPL['head']
    for k, v in {'{{EDITION}}': edition or LATEST, '{{TITLE}}': e(title), '{{OGTITLE}}': e(og_title or title), '{{DESC}}': e(desc), '{{OGTYPE}}': og_type,
                 '{{OGIMAGE}}': og_image or BASE_URL + 'assets/og.jpg', '{{OGURL}}': BASE_URL + ('' if path == 'index.html' else path),
                 '{{OGALT}}': e(og_alt or 'The In Palestine Today wordmark over a day of Palestine’s sky'), '{{ARTMETA}}': art_meta,
                 '{{R}}': R, '{{V}}': V, '{{CSS}}': ''.join(f'<link rel="stylesheet" href="{R}assets/css/{c}?v={V}">\n' for c in css),
                 '{{BASE}}': ('<script>if(/github\\.io$/.test(location.hostname))document.write(\'<base href="' + REPO_BASE + '">\')</script>\n') if base else '',
                 '{{JSONLD}}': jsonld}.items():
        head = head.replace(k, v)
    top = (TPL['top'].replace('{{BODYCLASS}}', bodyclass).replace('{{SKIP}}', skip).replace('{{NAV}}', '\n'.join(navs))
           .replace('{{FIND}}', find_panel(R) if find else search_link(R)).replace('{{SCRUB}}', SCRUB if scrub else '').replace('{{R}}', R))
    foot = TPL['foot']
    for k, v in {'{{EDITION}}': edition or LATEST, '{{R}}': R, '{{V}}': V, '{{CREDITS}}': credits_for(body) + STANDARD_NOTE,
                 '{{JS}}': ''.join(f'<script src="{R}assets/js/{j}?v={V}"></script>\n' for j in js)}.items():
        foot = foot.replace(k, v)
    if base:   # a missing path can be any depth: the <base> makes the frame's root-relative links resolve
        top = top.replace('href="../', 'href="')
    out = head + top + body + foot
    assert '{{' not in out, 'unfilled token in ' + path
    write(path, out)
    return out

# ---------------------------------------------------------------- small renderers
def photo_fig(pid, R, cls='', sizes='(max-width: 760px) 100vw, 760px', ratio=None, eager=False):
    p = PH[pid]
    f = R + p['file']
    w, h = p.get('w', 1280), p.get('h', 853)
    cap = esc_text(p.get('caption', ''))
    credit = ' '.join(x for x in [('Photo: ' + e(p['author'])) if p.get('author') else '', 'via Wikimedia Commons' if p.get('commons_page') else ''] if x)
    lic = e(p.get('license', ''))
    lic_html = f'<a href="{e(p.get("license_url"))}" rel="noopener license">{lic}</a>' if p.get('license_url') else lic
    src_html = f'<a href="{e(p.get("commons_page"))}" rel="noopener">{credit}</a>' if p.get('commons_page') else credit
    st = f' style="aspect-ratio:{ratio}"' if ratio else ''
    load = 'eager" fetchpriority="high' if eager else 'lazy'
    return (f'<figure{(" class=" + chr(34) + cls + chr(34)) if cls else ""}><img src="{e(f)}-1280.webp" srcset="{e(f)}-640.webp 640w, {e(f)}-1280.webp 1280w" sizes="{sizes}" '
            f'width="{w}" height="{h}" alt="{e(p.get("alt", ""))}" loading="{load}" decoding="async"{st}>'
            f'<figcaption>{cap} {src_html}, {lic_html}.</figcaption></figure>')

def item_photo(it):
    for p in it.get('photo_ids') or []:
        if p in PH:
            return p
    return None

# wire-style datelines: the place a report is filed from, short. The research keeps the full location.
DATELINES = {
    'd01': 'al-Mawasi, Khan Younis', 'd02': 'al-Zawaida, Gaza Strip', 'd07': 'Nablus', 'd10': 'Gaza City', 'd17': 'Masafer Yatta, south of Hebron',
    'd26': 'Gaza City', 'd35': 'Khan Younis, Gaza Strip', 'd45': 'Masafer Yatta, south of Hebron', 'd46': 'Gaza Strip', 'd51': 'Tulkarm and Qalqilya',
    'b01': 'Rafah, Gaza Strip', 'b03': 'Occupied East Jerusalem', 'b04': 'Nablus and Hebron', 'b05': 'Tubas plain', 'b07': 'Northern West Bank',
    'b08': 'Jenin', 'b10': 'Occupied East Jerusalem', 'b16': 'Masafer Yatta, south of Hebron', 'b19': 'Northeast of Ramallah', 'b23': 'Occupied East Jerusalem',
    'b24': 'Northern West Bank', 'b28': 'Gaza Strip', 'b29': 'Tubas governorate', 'b30': 'Nablus', 'c01': 'Northern West Bank', 'c02': 'Gaza Strip',
    'c03': 'Nablus governorate', 'c05': 'al-Tur, occupied East Jerusalem', 'c07': 'Beit Imrin, north of Nablus', 'c09': 'Ramallah', 'c10': 'South of Hebron',
    'c11': 'Beit Lid, east of Tulkarm', 'c12': 'Idhna, Hebron governorate', 'c13': 'Occupied East Jerusalem', 'c14': 'Silwan, occupied East Jerusalem',
    'c15': 'Gaza City', 'c22': 'Salfit governorate', 'c25': 'Near Tulkarm',
}

def dateline(it, override=None):
    place = clean_place(override or DATELINES.get(it.get('id')) or it.get('dateline') or it.get('place'))
    return f'<span class="dateline">{e(place)} —</span> ' if place else ''

def ledger(nums, title='The figures', h='h4'):
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
    return f'<{h} class="lh">{e(title)}</{h}><dl class="ledger">' + ''.join(rows) + '</dl>'

def tattr(date, t):
    return f'{date}T{t}+03:00' if t else date

def when_label(it, home_date):
    t = it.get('time') or ''
    lab = e(t) if t else '—'
    if it.get('date') and it['date'] != home_date:
        lab = WD[datetime.date(*ymd(it['date'])).weekday()] + '<br>' + lab
    return lab

def row(it, R, home_date=None, meta=True, thumb=False, note=None):
    """One line of the record: time gutter with the sun stamp, headline to its page, dek, desk and source."""
    t = it.get('time') or ''
    href = R + ITEM_URL[it['id']] if it['id'] in ITEM_URL else e(it.get('source_url'))
    desk = DESK_NAME.get(it.get('region'), '')
    m = ' · '.join(x for x in [note, KIND.get(it.get('kind'), 'Update'), desk, e(it.get('source_name', ''))] if x)
    ph = item_photo(it) if thumb else None
    img = (f'<img class="row-img" src="{R}{e(PH[ph]["file"])}-640.webp" width="640" height="{int(640 * PH[ph].get("h", 853) / PH[ph].get("w", 1280))}" alt="" loading="lazy" decoding="async">' if ph else '')
    return (f'<li class="row{" has-img" if img else ""}" data-date="{it["date"]}" data-time="{t or "12:00"}"><time datetime="{tattr(it["date"], t)}">{when_label(it, home_date or it["date"])}</time>'
            f'<span class="row-stamp"><span data-stamp="{t}"></span></span>'
            f'<div class="row-text"><h3><a href="{href}">{esc_text(it["headline"])}</a></h3><p>{esc_text(it.get("dek", ""))}</p>' + (f'<p class="row-m">{m}</p>' if meta else '') + f'</div>{img}</li>')

def n_reports(date):
    return len({s['item'] for s in SLOTS[date]} | {b for s in SLOTS[date] for b in s.get('briefs', [])})

# ---------------------------------------------------------------- edition (day) pages
def render_brief(bid, R, date):
    it = item(bid)
    t = it.get('time') or ''
    head = esc_text(it['headline'])
    h = f'<a href="{R}{ITEM_URL[bid]}">{head}</a>'
    return (f'<li><time datetime="{tattr(it["date"], t)}">{when_label(it, date)}</time><div><h4>{h}</h4>'
            f'<p>{esc_text(it.get("dek", ""))} <span class="by">{e(it.get("source_name", ""))}</span></p></div></li>')

def render_ahead():
    lis = []
    for a in AHEAD:
        yy, mm, dd = a['date'].split('-')
        wd = WD[datetime.date(int(yy), int(mm), int(dd)).weekday()]
        lab = f'<a href="{e(a["source_url"])}" rel="noopener">{esc_text(a["label"])}</a>' if a.get('source_url') else f'<b>{esc_text(a["label"])}</b>'
        yr = f' {yy}' if yy != LATEST[:4] else ''
        lis.append(f'<li><time datetime="{e(a["date"])}"><small>{wd}</small>{int(dd)} {SHORTM[int(mm) - 1]}{yr}</time><p>{lab}{esc_text(a.get("detail", ""))}</p></li>')
    return '<h4 class="briefs-h">Ahead</h4><ol class="ahead">' + ''.join(lis) + '</ol>'

def quote_in(q, headline):
    """True when the headline already carries the quote, so it isn't set twice in a row."""
    norm = lambda x: re.sub(r'[^a-z0-9 ]', '', x.lower())
    return norm(q).strip()[:40] in norm(headline)

def render_slot(s, R, date):
    it = item(s['item'])
    t = s['_time']
    kind = s.get('kind') or KIND.get(it.get('kind'), 'Update')
    layout = s.get('layout', 'standard')
    cls = 'slot' + (' big' if layout == 'big' else '')
    head = esc_text(s.get('headline') or it['headline'])
    h3 = f'<h3 id="{s["_id"]}-h"><a href="{R}{ITEM_URL[s["item"]]}">{head}</a></h3>'
    parts = []
    if layout == 'quote' and it.get('quote') and not quote_in(it['quote']['text'], s.get('headline') or it['headline']):
        q = it['quote']
        parts.append(f'<p class="quote">{esc_text(q["text"])}</p><p class="quote-by">{e(q.get("who", ""))}{", " + e(q["role"]) if q.get("role") else ""}{" (translated from " + e(q["translated_from"]) + ")" if q.get("translated_from") else ""}</p>')
    parts.append(h3)
    parts.append(f'<p class="dek">{dateline(it, s.get("dateline"))}{esc_text(s.get("dek") or it.get("dek", ""))}</p>')
    body = it.get('body', [])
    nb = s.get('paras', 2 if layout in ('big', 'story', 'two') else 1)
    paras = ''.join(f'<p>{esc_text(p)}</p>' for p in body[:nb])
    photo = s.get('photo')
    if layout == 'two' and photo:
        parts.append(f'<div class="two"><div>{paras}</div>{photo_fig(photo, R, sizes="(max-width: 860px) 100vw, 380px")}</div>')
    else:
        if photo:
            parts.append(photo_fig(photo, R, sizes='(max-width: 760px) 100vw, 800px'))
        if paras:
            parts.append(f'<div class="cols">{paras}</div>' if layout == 'big' and nb > 1 else paras)
    if s.get('briefs'):
        bt = s.get('briefs_title')
        parts.append((f'<h4 class="briefs-h">{e(bt)}</h4>' if bt else '<h4 class="sr">Also in this hour</h4>') + '<ul class="briefs">' + ''.join(render_brief(b, R, date) for b in s['briefs']) + '</ul>')
    if s.get('ahead') and date == LATEST:
        parts.append(render_ahead())
    parts.append(f'<p class="src"><span class="kind">{e(kind)}</span> · Source: <a href="{e(it.get("source_url"))}" rel="noopener">{e(it.get("source_name"))}</a>, {short_date(it["date"])}{(", " + e(it.get("time"))) if it.get("time") else ""} · <a href="{R}{ITEM_URL[s["item"]]}">The full report</a></p>')
    mg = s.get('margin')
    margin = ''
    if mg == 'ledger' or (mg is None and it.get('numbers')):
        nums = list(it.get('numbers', [])) if s.get('margin_own', True) else []
        for x in s.get('margin_from', []):
            nums += item(x).get('numbers', [])
        nums = nums[: s.get('margin_max', 3)]
        if nums:
            margin = f'<aside class="margin" aria-label="Figures">{ledger(nums, s.get("margin_title", "The figures"))}</aside>'
    elif isinstance(mg, dict) and mg.get('photo'):
        margin = f'<aside class="margin" aria-label="Photograph">{photo_fig(mg["photo"], R, sizes="300px")}</aside>'
    if not margin:
        margin = '<aside class="margin" aria-hidden="true" style="border:0"></aside>'
    state = s.get('state', '')
    when = (f'<div class="when"><time datetime="{tattr(date, t)}">{t}</time>'
            f'<span class="sunat"><span data-stamp="{t}"{(" data-state=" + chr(34) + state + chr(34)) if state else ""}></span><span data-alt>Sun</span></span></div>')
    return f'<article class="{cls}" id="{s["_id"]}" data-time="{t}" aria-labelledby="{s["_id"]}-h">{when}<div class="story">{"".join(parts)}</div>{margin}</article>'

def dial_html(date, R, links, *, mini=False, label='', legend=False, leaders=True, delay=0, hidden_index=False):
    """links: list of (time, href, label, classes)."""
    n = len(links)
    lis = ''.join(f'<li><a href="{h}" data-t="{t}"{(" class=" + chr(34) + c + chr(34)) if c else ""}><time>{t}</time><span>{e(l)}</span></a></li>' for t, h, l, c in links)
    idx = f'<ol class="dial-index" style="--n:{n}"{" hidden" if hidden_index else ""}>{lis}</ol>'
    return (f'<div class="dial{" mini" if mini else ""}" data-dial data-date="{date}"{(" data-delay=" + chr(34) + str(delay) + chr(34)) if delay else ""}{" aria-hidden=" + chr(34) + "true" + chr(34) if hidden_index else ""}>'
            f'<div class="dial-band"><svg class="sky" role="img" aria-label="{e(label)}"></svg></div>'
            + ('<svg class="dial-leaders" aria-hidden="true"></svg>' if leaders and not mini else '')
            + (f'<nav aria-label="The running order of {long_date(date)}">{idx}</nav>' if not hidden_index else idx)
            + '</div>' + ('<p class="dial-legend" data-dial-legend></p>' if legend else ''))

def render_edition(date):
    plan = EDITIONS[date]
    path = edition_path(date)
    R = '../' * path.count('/')
    slots = SLOTS[date]
    parts_html = []
    for p in plan['parts']:
        pid = 'p-' + p['key']
        parts_html.append(
            f'<section class="part" id="{pid}" data-at="{p["at"]}" data-span="{p["from"]}-{p["to"]}" aria-labelledby="{pid}-h"><div class="wrap">'
            f'<header class="part-head"><p class="span"><b>{p["from"]}–{p["to"]}</b><span class="light">{e(p["light"])}</span></p>'
            f'<h2 id="{pid}-h">{esc_text(p["title"])}</h2>'
            f'<p class="sundata" data-sundata="{p["from"]}-{p["to"]}"></p></header>'
            + ''.join(render_slot(s, R, date) for s in p['slots']) + '</div></section>')
    L = plan['lead']
    lit = item(L['item'])
    lead_slot = next((s for s in slots if s['item'] == L['item']), None)
    lead_t = lead_slot['_time'] if lead_slot else lit.get('time')
    more = []
    for m in L.get('more', []):
        mi = item(m)
        more.append(f'<a href="{R}{ITEM_URL[m]}"><h3>{esc_text(mi["headline"])}</h3><span class="filed"><span data-stamp="{e(mi.get("time"))}"></span>{e(mi.get("time"))} · {e(clean_place(mi.get("place", "")).split(",")[0])}</span></a>')
    lead_html = (
        f'<article class="lead" aria-labelledby="lead-h"><div class="lead-text">'
        f'<h2 class="hl" id="lead-h"><a href="{R}{ITEM_URL[L["item"]]}">{esc_text(L.get("headline") or lit["headline"])}</a></h2>'
        f'<p class="dek">{dateline(lit, L.get("dateline"))}{esc_text(L.get("dek") or lit.get("dek", ""))}</p>'
        f'<p class="filed"><span data-stamp="{lead_t}"></span><span>Filed {lead_t} · <span data-alt-at="{lead_t}"></span> · {e(lit.get("source_name", ""))}</span><a href="#{lead_slot["_id"] if lead_slot else ""}">Read it in its hour</a></p>'
        f'</div>{photo_fig(L["photo"], R, sizes="(max-width: 860px) 100vw, 540px", ratio="3 / 2", eager=True)}</article>')
    more_html = f'<div class="more-lead">{"".join(more)}</div>' if more else ''
    index = sorted(((s['_time'], '#' + s['_id'], s.get('label') or item(s['item'])['headline'][:40], '') for s in slots), key=lambda x: x[0])
    times = [x[0] for x in index]
    i = DATES.index(date)
    prev_d = DATES[i - 1] if i > 0 else None
    next_d = DATES[i + 1] if i + 1 < len(DATES) else None
    daynav = ' '.join(x for x in [
        f'<a href="{R}{edition_path(prev_d)}" rel="prev">{weekday(prev_d)}’s edition</a>' if prev_d else '',
        f'<a href="{R}{edition_path(next_d)}" rel="next">{weekday(next_d)}’s edition</a>' if next_d else '',
        f'<a href="{R}days.html">The Days</a>'] if x)
    body = (
        f'<main id="main">\n<section class="edition" aria-labelledby="ed-h"><div class="wrap">'
        f'<div class="edhead"><h1 id="ed-h">The Day <span>· {long_date(date)}</span></h1>'
        f'<p>{n_reports(date)} reports · first filed {times[0]} · last {times[-1]} · Palestine time (UTC+3) <a data-continue hidden href="#main">Continue from <b>—</b></a></p>'
        f'<p class="daynav">{daynav}</p></div>'
        + lead_html
        + dial_html(date, R, index, label=f'The sky over Palestine on {long_date(date)}: the sun\'s path from night to night, with each slot of the day placed on it', legend=True, delay=250)
        + more_html + '</div></section>\n' + '\n'.join(parts_html) + '\n</main>\n')
    title = f'The Day, {long_date(date)} · In Palestine Today'
    desc = f'One day in Palestine, in order: {long_date(date)} from the night to the last report before midnight, every figure sourced, in Palestine time.'
    page(path, title=title, desc=desc, body=body, edition=date, nav='day', skip='Skip to the day', find=True, scrub=True, og_title=f'The Day · {long_date(date)} · In Palestine Today')
    return slots

# ---------------------------------------------------------------- report and story pages
PUBLISHERS = [('english.wafa.ps', 'WAFA, English'), ('wafa.ps', 'WAFA'), ('ochaopt.org', 'UN OCHA'), ('news.un.org', 'UN News'), ('un.org', 'United Nations'),
              ('reliefweb.int', 'ReliefWeb'), ('qudsn.co', 'Quds News Network'), ('cwrc.ps', 'Colonization and Wall Resistance Commission'), ('addameer.ps', 'Addameer'),
              ('al-monitor.com', 'Al-Monitor'), ('jpost.com', 'The Jerusalem Post'), ('haaretz.com', 'Haaretz'), ('timesofisrael.com', 'The Times of Israel'),
              ('thenationalnews.com', 'The National'), ('mondoweiss.net', 'Mondoweiss'), ('securitycouncilreport.org', 'Security Council Report'), ('icrc.org', 'ICRC'),
              ('amnesty.de', 'Amnesty International Germany'), ('globes.co.il', 'Globes'), ('almamlakatv.com', 'Al-Mamlaka TV'), ('aa.com.tr', 'Anadolu Agency'),
              ('aljazeera.com', 'Al Jazeera'), ('middleeasteye.net', 'Middle East Eye'), ('reuters.com', 'Reuters'), ('apnews.com', 'AP'), ('dfat.gov.au', 'Australian foreign ministry'),
              ('palinfo.com', 'Palestinian Information Center'), ('alquds.com', 'Al-Quds'), ('unesco.org', 'UNESCO'), ('pcbs.gov.ps', 'Palestinian Central Bureau of Statistics')]

def describe_url(u):
    from urllib.parse import unquote, urlparse
    pu = urlparse(u)
    host = pu.netloc.lower().replace('www.', '')
    pub = next((n for h, n in PUBLISHERS if host == h or host.endswith('.' + h) or host.endswith(h)), host)
    seg = [x for x in unquote(pu.path).split('/') if x]
    m = re.search(r'/(20\d\d)/(\d{1,2})/(\d{1,2})/', pu.path)
    when = f'{int(m.group(3))} {SHORTM[int(m.group(2)) - 1]}' if m else ''
    tail = seg[-1] if seg else ''
    tail = re.sub(r'\.(html?|php|aspx)$', '', tail)
    if re.search(r'[\u0600-\u06FF]', tail):
        what = 'Arabic-language report'
    elif re.search(r'[a-z]{3,}', tail) and '-' in tail:
        words = re.sub(r'[-_]+', ' ', re.sub(r'-?\d{5,}$', '', tail)).strip()
        what = words[:1].upper() + words[1:]
        what = (what[:72] + '…') if len(what) > 73 else what
    else:
        what = 'Report page'
    return pub, ', '.join(x for x in [what, when] if x)

def jsonld_article(it, path, photo):
    d = {'@context': 'https://schema.org', '@type': 'NewsArticle', 'headline': it['headline'][:110], 'description': it.get('dek', ''),
         'datePublished': tattr(it['date'], it.get('time') or '00:00'), 'inLanguage': 'en',
         'author': {'@type': 'Organization', 'name': 'In Palestine Today'}, 'publisher': {'@type': 'Organization', 'name': 'In Palestine Today'},
         'mainEntityOfPage': BASE_URL + path, 'isBasedOn': it.get('source_url')}
    if photo:
        d['image'] = BASE_URL + PH[photo]['file'] + '-1280.webp'
    return '<script type="application/ld+json">' + json.dumps(d, ensure_ascii=False) + '</script>\n'

# ---------------------------------------------------------------- sharing
CARDS = []          # one share card per report, drawn by tools/cards.mjs into assets/img/card/

def card_slug(iid):
    return ITEM_URL[iid].split('/')[-1][:-5]

def card_url(iid, photo):
    f = 'assets/img/card/' + card_slug(iid) + '.jpg'
    if os.path.exists(os.path.join(ROOT, f)):
        return BASE_URL + f
    return (BASE_URL + PH[photo]['file'] + '-1280.webp') if photo else None

def share_links(url, headline, dek):
    from urllib.parse import quote
    u, h = quote(url, safe=''), quote(headline, safe='')
    return [
        ('x', 'X', f'https://twitter.com/intent/tweet?text={h}&url={u}'),
        ('facebook', 'Facebook', f'https://www.facebook.com/sharer/sharer.php?u={u}'),
        ('whatsapp', 'WhatsApp', f'https://wa.me/?text={quote(headline + " " + url, safe="")}'),
        ('telegram', 'Telegram', f'https://t.me/share/url?url={u}&text={h}'),
        ('bluesky', 'Bluesky', f'https://bsky.app/intent/compose?text={quote(headline + " " + url, safe="")}'),
        ('linkedin', 'LinkedIn', f'https://www.linkedin.com/sharing/share-offsite/?url={u}'),
        ('email', 'Email', f'mailto:?subject={h}&body={quote(dek + chr(10) + chr(10) + url, safe="")}'),
    ]

def render_article(iid):
    it = ITEMS[iid]
    path = ITEM_URL[iid]
    R = '../'
    date = it['date']
    home_date, slot, role = ITEM_HOME[iid]
    t = it.get('time') or ''
    kind = KIND.get(it.get('kind'), 'Update')
    story = is_story(it)
    photo = (slot.get('photo') if role == 'main' else None) or item_photo(it)
    if photo and photo not in PH:
        photo = None
    thread = [slot['item']] + slot.get('briefs', []) if role == 'brief' else slot.get('briefs', [])
    thread = [x for x in thread if x != iid]
    updated = role == 'main' and slot.get('state') == 'updated'
    later = [x for x in thread if (ITEMS[x]['date'], ITEMS[x].get('time') or '') > (date, t)]
    upd = f'<span class="upd"><span data-stamp="{ITEMS[later[0]].get("time")}" data-state="updated"></span>Updated {ITEMS[later[0]].get("time")}</span>' if (updated and later) else ''
    quote = ''
    if it.get('quote'):
        q = it['quote']
        quote = f'<blockquote class="art-quote"><p>{esc_text(q["text"])}</p><footer>{e(q.get("who", ""))}{", " + e(q["role"]) if q.get("role") else ""}{" (translated from " + e(q["translated_from"]) + ")" if q.get("translated_from") else ""}</footer></blockquote>'
    paras = [f'<p>{esc_text(p)}</p>' for p in it.get('body', [])]
    if quote:
        paras.insert(min(1, len(paras)), quote)
    srcs = [f'<li><a href="{e(it.get("source_url"))}" rel="noopener">{e(it.get("source_name"))}</a><span>The source of this report, {short_date(date)}{", " + e(t) if t else ""}</span></li>']
    for u in it.get('related_urls') or []:
        pub, what = describe_url(u)
        srcs.append(f'<li><a href="{e(u)}" rel="noopener">{e(pub)}</a><span>{e(what)}</span></li>')
    nums = [n for n in it.get('numbers', []) if str(n.get('value')).strip() not in ('1', 'one')]
    margin = (f'<aside class="margin art-margin" aria-label="Sources and figures"><h2 class="lh">On whose word</h2><ul class="srcs">{"".join(srcs)}</ul>'
              + (ledger(nums, h='h3') if nums else '') + '</aside>')
    thread_html = ''
    if thread:
        title = slot.get('briefs_title') if role == 'main' else 'The rest of this hour'
        thread_html = (f'<section class="art-thread" aria-labelledby="th-h"><h2 id="th-h">{e(title or "Around it")}</h2><ol class="rows">'
                       + ''.join(row(ITEMS[x], R, home_date=date) for x in thread) + '</ol></section>')
    # its place in the day: the edition's dial with this slot marked, the slots either side
    slots = SLOTS[home_date]
    idx = []
    for s in sorted(slots, key=lambda x: x['_time']):
        cur = s is slot
        href = R + ITEM_URL[s['item']] if not cur else '#main'
        idx.append((s['_time'], href, s.get('label') or item(s['item'])['headline'][:40], 'is-current' if cur else ''))
    order = sorted(slots, key=lambda x: x['_time'])
    k = order.index(slot)
    prev_s, next_s = (order[k - 1] if k > 0 else None), (order[k + 1] if k + 1 < len(order) else None)
    pn = ''.join(row(item(x['item']), R, note=lab) for x, lab in ((prev_s, 'Earlier in the day'), (next_s, 'Later in the day')) if x)
    inday = (f'<section class="inday" aria-labelledby="inday-h" data-date="{home_date}"><div class="wrap">'
             f'<h2 id="inday-h">Where it sits in the day <span>· <a href="{R}{edition_path(home_date)}#{slot["_id"]}">{long_date(home_date)}</a></span></h2>'
             + dial_html(home_date, R, idx, label=f'The sky over Palestine on {long_date(home_date)}, this report marked on the sun\'s path')
             + f'<p class="dial-legend" data-dial-legend></p><ol class="rows pns" aria-label="Earlier and later in the day">{pn}</ol></div></section>')
    also_ids = [x for x in ITEMS if x in ITEM_URL and x != iid and x not in thread and ITEMS[x]['date'] == date and ITEMS[x].get('region') == it.get('region')]
    also_ids = sorted(also_ids, key=lambda x: ITEMS[x].get('time') or '')[:5]
    also = (f'<section class="also" aria-labelledby="also-h"><div class="wrap"><h2 id="also-h">Also from {DESK_NAME.get(it.get("region"), "the day")} on {long_date(date, year=False)}</h2>'
            f'<ol class="rows">{"".join(row(ITEMS[x], R) for x in also_ids)}</ol><p class="more-link"><a href="{R}{it.get("region", "home")}.html">All of {DESK_NAME.get(it.get("region"), "the day")}, day by day</a></p></div></section>') if also_ids else ''
    fig = photo_fig(photo, R, cls='art-fig', sizes='(max-width: 860px) 100vw, 1100px', eager=True) if photo else ''
    meta = (f'<p class="art-meta"><span class="kind">{e(kind)}</span> · {long_date(date)}, filed <time datetime="{tattr(date, t)}">{t or "—"}</time> Palestine time · '
            f'Source: <a href="{e(it.get("source_url"))}" rel="noopener">{e(it.get("source_name"))}</a></p>')
    canon = BASE_URL + path
    nets = share_links(canon, smart(it['headline']), smart(it.get('dek', '')))
    acts = ('<div class="art-acts" data-share><button type="button" class="btn ghost" data-share-open aria-expanded="false" aria-controls="sh-top">Share</button>'
            '<button type="button" class="btn ghost" data-copy>Copy link</button><span class="msg" role="status"></span>'
            '<div class="share-pop" id="sh-top" role="group" aria-label="Share this report" hidden><ul>'
            + ''.join(f'<li><a class="sh" href="{e(u)}" target="_blank" rel="noopener" data-net="{k}">{n}</a></li>' for k, n, u in nets)
            + '</ul><button type="button" class="sh-native" data-native hidden>More apps on this device</button></div></div>')
    endshare = ('<section class="art-share" aria-labelledby="sh-h" data-share><h2 id="sh-h">Share this report</h2><ul class="sh-list">'
                + ''.join(f'<li><a class="btn ghost sh" href="{e(u)}" target="_blank" rel="noopener" data-net="{k}">{n}</a></li>' for k, n, u in nets)
                + '<li><button type="button" class="btn ghost" data-copy>Copy link</button></li><li><button type="button" class="btn ghost" data-native hidden>More apps</button></li></ul>'
                '<p class="msg" role="status"></p></section>')
    body = (f'<main id="main">\n<article class="art{" is-story" if story else ""}" data-at="{t or "12:00"}" aria-labelledby="art-h"><div class="wrap">'
            f'<div class="art-top"><div class="when"><time datetime="{tattr(date, t)}">{t or "—"}</time><span class="sunat"><span data-stamp="{t or "12:00"}"></span><span data-alt>Sun</span></span>{upd}</div>'
            f'<header class="art-head"><h1 id="art-h">{esc_text(it["headline"])}</h1><p class="dek">{dateline(it)}{esc_text(it.get("dek", ""))}</p>{meta}{acts}</header></div>'
            + fig
            + f'<div class="art-body"><div></div><div class="art-text">{"".join(paras)}{endshare}</div>{margin}</div>'
            + thread_html + '</div></article>\n' + inday + also + '\n</main>\n')
    page(path, title=f'{it["headline"]} · In Palestine Today', desc=it.get('dek', ''), body=body, edition=date,
         nav=('stories' if story else it.get('region')), skip='Skip to the report', css=('pages.css',), js=('pages.js',), og_type='article',
         og_image=card_url(iid, photo), og_alt=smart(it['headline']), og_title=smart(it['headline']), jsonld=jsonld_article(it, path, photo),
         art_meta=(f'<meta property="article:published_time" content="{date}T{t or "12:00"}:00+03:00">\n'
                   + (f'<meta property="article:modified_time" content="{ITEMS[later[0]]["date"]}T{ITEMS[later[0]].get("time")}:00+03:00">\n' if (updated and later) else '')
                   + f'<meta property="article:section" content="{e(DESK_NAME.get(it.get("region"), "The Day"))}">\n'))
    CARDS.append({'slug': card_slug(iid), 'headline': smart(it['headline']), 'date': date, 'time': t or '12:00', 'kind': kind,
                  'desk': DESK_NAME.get(it.get('region'), ''), 'source': 'Source: ' + (publishers(it.get('source_name', '')) or [''])[0], 'place': re.split(r'[;,]| and ', clean_place(it.get('place', '')))[0].strip(),
                  'photo': ('../' + PH[photo]['file'] + '-1280.webp') if photo else ''})

# ---------------------------------------------------------------- desks, stories, the harvest thread
def figures_for(pred, limit=4, avoid=()):
    out, seen = [], set()
    for n in HEADLINE_NUMBERS:
        src = ITEMS.get(n.get('item_id'))
        lab = n.get('label', '')
        if src and pred(src) and not any(a in lab for a in avoid) and lab not in seen:
            seen.add(lab)
            out.append(n)
    return out[:limit]

AVOID = {'west-bank': ('Gaza',), 'gaza': ('West Bank',), 'jerusalem': ('Gaza',), 'world': ()}

def part_of(date, t):
    m = int(t[:2]) * 60 + int(t[3:5]) if t else 720
    parts = EDITIONS[date]['parts']
    for p in parts:
        a = int(p['from'][:2]) * 60 + int(p['from'][3:5])
        b = int(p['to'][:2]) * 60 + int(p['to'][3:5])
        if a <= m < b or (m >= a and p is parts[-1]):
            return p
    return parts[0]

def render_record(path, key, title, intro, pred, *, nav=None, thumbs=False, figures=None):
    R = ''
    figs = figures if figures is not None else figures_for(pred, avoid=AVOID.get(key, ()))
    blocks = []
    first = True
    for date in reversed(DATES):
        ids = [x for x in ITEM_URL if ITEMS[x]['date'] == date and pred(ITEMS[x])]
        if not ids:
            continue
        ids.sort(key=lambda x: ITEMS[x].get('time') or '')
        mine = set(ids)
        links = [(ITEMS[x].get('time') or '12:00', R + ITEM_URL[x], ITEMS[x]['headline'][:40], '') for x in ids]
        links += [(s['_time'], R + edition_path(date) + '#' + s['_id'], '', 'is-dim') for s in SLOTS[date] if s['item'] not in mine]
        links.sort(key=lambda x: x[0])
        groups = []
        for x in ids:
            p = part_of(date, ITEMS[x].get('time'))
            if not groups or groups[-1][0] is not p:
                groups.append((p, []))
            groups[-1][1].append(x)
        bands = []
        # the ledger sits beside one of the newest day's fuller parts, and never runs longer than its rows
        # (the first part with three or more rows, so it stays near the top; else the busiest)
        busiest = next((i for i, g in enumerate(groups) if len(g[1]) >= 3), max(range(len(groups)), key=lambda i: (len(groups[i][1]), -i)))
        for gi, (p, xs) in enumerate(groups):
            side = ''
            if first and gi == busiest and figs:
                side = f'<aside class="margin rec-figs" aria-label="Where things stand">{ledger(figs[:max(2, len(xs))], "Where things stand", h="h3")}</aside>'
            bands.append(
                f'<section class="part recpart" data-at="{p["at"]}" data-span="{p["from"]}-{p["to"]}" data-date="{date}" aria-label="{e(p["light"])}, {p["from"]} to {p["to"]}"><div class="wrap recpart-grid">'
                f'<p class="span"><b>{p["from"]}–{p["to"]}</b><span class="light">{e(p["light"])}</span></p>'
                f'<ol class="rows{" thumbs" if thumbs else ""}">' + ''.join(row(ITEMS[x], R, thumb=thumbs) for x in xs) + f'</ol>{side}</div></section>')
        blocks.append(
            f'<section class="recday" data-date="{date}" aria-labelledby="rd-{date}"><div class="wrap">'
            f'<header class="recday-head"><h2 id="rd-{date}">{long_date(date, year=False)}</h2>'
            f'<p><span data-sun-brief></span> · {len(ids)} {"report" if len(ids) == 1 else "reports"} · <a href="{R}{edition_path(date)}">The whole day</a></p></header>'
            + dial_html(date, R, links, mini=True, hidden_index=True, label='')
            + '</div>' + ''.join(bands) + '</section>')
        first = False
    body = (f'<main id="main">\n<header class="rec-head"><div class="wrap"><h1>{e(title)}</h1><p class="rec-intro">{esc_text(intro)}</p></div></header>\n'
            + '\n'.join(blocks) + '\n</main>\n')
    page(path, title=f'{title} · In Palestine Today', desc=intro, body=body, nav=nav or key, css=('pages.css',), js=('pages.js',))

# ---------------------------------------------------------------- the days archive
def render_days():
    eds = []
    data = {}
    for date in reversed(DATES):
        plan = EDITIONS[date]
        lit = item(plan['lead']['item'])
        slots = SLOTS[date]
        times = sorted(s['_time'] for s in slots)
        data[date] = {'url': edition_path(date), 'times': times, 'lead': plan['lead'].get('headline') or lit['headline']}
        ph = plan['lead'].get('photo')
        eds.append(
            f'<li class="ed" data-date="{date}"><a href="{edition_path(date)}">'
            f'<span class="ed-date"><b>{weekday(date)}</b>{short_date(date)}</span>'
            f'<span class="ed-text"><span class="ed-lead">{esc_text(data[date]["lead"])}</span>'
            f'<span class="ed-dek">{esc_text(plan["lead"].get("dek") or lit.get("dek", ""))}</span>'
            f'<span class="ed-meta">{n_reports(date)} reports · first filed {times[0]} · last {times[-1]} · <span data-sun-brief></span></span></span>'
            + (f'<img src="{e(PH[ph]["file"])}-640.webp" width="640" height="{int(640 * PH[ph].get("h", 853) / PH[ph].get("w", 1280))}" alt="" loading="lazy" decoding="async">' if ph in PH else '')
            + '</a></li>')
    body = (
        '<main id="main">\n<header class="rec-head"><div class="wrap"><h1>The Days</h1>'
        '<p class="rec-intro">Each edition is one day in Palestine, told in order from midnight to midnight. Below them, every day of October 2026 as the sky over Jerusalem ran it: each row is a day, left to right from midnight, with the sun up where the row is light.</p></div></header>\n'
        f'<section class="eds-wrap"><div class="wrap"><h2 class="sr">Editions</h2><ol class="eds">{"".join(eds)}</ol></div></section>\n'
        '<section class="skycal-wrap" aria-labelledby="sky-h"><div class="wrap"><h2 id="sky-h">October 2026 in Palestine’s sky</h2>'
        '<p class="note-s">Computed for Jerusalem, in Palestine time. Beads are the slots of each edition, placed on their day at the minute they were filed. When the clocks change, the whole row shifts by an hour.</p>'
        '<div class="skycal" data-skycal="2026-10" aria-label="Thirty-one rows, one for each day of October 2026, showing night, dawn, daylight and dusk"></div></div></section>\n'
        f'<script type="application/json" id="days-data">{json.dumps(data, ensure_ascii=False)}</script>\n</main>\n')
    page('days.html', title='The Days · In Palestine Today', desc='Every edition of The Day, and October 2026 in Palestine’s sky.', body=body, nav=None, css=('pages.css',), js=('pages.js',))

# ---------------------------------------------------------------- in pictures
def render_visuals():
    seen, days = set(), []
    for date in reversed(DATES):
        plan = EDITIONS[date]
        pairs = [(plan['lead']['photo'], plan['lead']['item'])] + [(s['photo'], s['item']) for s in SLOTS[date] if s.get('photo')]
        pairs = [(ph, iid) for ph, iid in pairs if ph in PH and ph not in seen]
        pairs.sort(key=lambda x: ITEMS[x[1]].get('time') or '')
        rows = []
        for ph, iid in pairs:
            seen.add(ph)
            it = ITEMS[iid]
            t = it.get('time') or ''
            rows.append(
                f'<li class="vis-row" data-time="{t}"><div class="when"><time datetime="{tattr(it["date"], t)}">{t}</time><span class="sunat"><span data-stamp="{t}"></span><span data-alt>Sun</span></span></div>'
                + photo_fig(ph, '', sizes='(max-width: 860px) 100vw, 820px')
                + f'<p class="vis-with">Beside <a href="{ITEM_URL[iid]}">{esc_text(it["headline"])}</a></p></li>')
        if rows:
            days.append(f'<section class="visday" data-date="{date}" aria-labelledby="vd-{date}"><div class="wrap"><h2 id="vd-{date}">{long_date(date, year=False)}</h2><ol class="vis-list">{"".join(rows)}</ol></div></section>')
    body = ('<main id="main">\n<header class="rec-head"><div class="wrap"><h1>In pictures</h1>'
            '<p class="rec-intro">The places in the news, from the archive, day by day and hung at the minute of the report each one sits beside. Every photograph is a Wikimedia Commons archive image, dated and placed in its caption. None shows the events reported, and none has been tinted, cropped for drama or graded to the hour.</p></div></header>\n'
            + '\n'.join(days) + '\n</main>\n')
    page('visuals.html', title='In pictures · In Palestine Today', desc='The places in the news, from the archive, each photograph dated in its caption.', body=body, nav=None, css=('pages.css',), js=('pages.js',))

# ---------------------------------------------------------------- search
def article_photo(iid):
    """The photograph a report's page leads with (its slot's, else its own), if it is published."""
    it = ITEMS[iid]
    _, slot, role = ITEM_HOME[iid]
    ph = (slot.get('photo') if role == 'main' else None) or item_photo(it)
    return ph if ph in PH else None

def publishers(name):
    """'WAFA / Jerusalem Governorate; AFP' -> ['WAFA', 'Jerusalem Governorate', 'AFP']"""
    out = []
    for part in re.split(r'\s*[/;]\s*', name or ''):
        part = re.sub(r'\s*\(.*?\)', '', part).strip()
        if part and part not in out:
            out.append(part)
    return out

def render_search():
    idx = []
    for x in ITEM_URL:
        it = ITEMS[x]
        q = it.get('quote') or {}
        o = {'u': ITEM_URL[x], 'd': it['date'], 't': it.get('time') or '', 'r': it.get('region', ''), 'k': KIND.get(it.get('kind'), 'Update'),
             'h': smart(it['headline']), 'g': it.get('topic', ''), 'x': smart(it.get('dek', '')), 's': it.get('source_name', ''),
             'sp': publishers(it.get('source_name', '')), 'p': clean_place(it.get('place', '')),
             'b': smart(' '.join(it.get('body', [])))}
        if q.get('text'):
            o['q'] = smart(q['text'])
            o['w'] = ', '.join(v for v in (q.get('who'), q.get('role')) if v)
        nums = [[n['value'], smart(n['label']), n.get('source_name', '')] for n in it.get('numbers', []) if str(n.get('value')).strip() not in ('1', 'one')]
        if nums:
            o['n'] = nums
        if article_photo(x):
            o['ph'] = 1
        idx.append(o)
    idx.sort(key=lambda o: o['t'])
    idx.sort(key=lambda o: o['d'], reverse=True)
    write('assets/js/search-index.js', '/* generated by tools/build.py */\nwindow.IPT_INDEX=' + json.dumps(idx, ensure_ascii=False, separators=(',', ':')) + ';\n')
    first, last = DATES[0], DATES[-1]
    tips = ('<details class="stips"><summary>How to search</summary><dl>'
            '<div><dt><code>olive harvest</code></dt><dd>Reports with both words, in any form: harvest, harvests, harvesting.</dd></div>'
            '<div><dt><code>&quot;Masafer Yatta&quot;</code></dt><dd>The exact words, in that order.</dd></div>'
            '<div><dt><code>settlers -Jerusalem</code></dt><dd>Leave out reports that mention a word.</dd></div>'
            '<div><dt><code>Jenin OR Tulkarm</code></dt><dd>Either word.</dd></div>'
            '<div><dt><code>source:Haaretz</code> <code>place:Hebron</code> <code>kind:figures</code> <code>desk:gaza</code></dt><dd>Search one part of a report: who it came from, where, what kind, which desk.</dd></div>'
            '<div><dt><code>after:18:00</code> <code>before:06:00</code></dt><dd>Filed after or before a minute, in Palestine time.</dd></div>'
            '<div><dt><code>has:figures</code> <code>has:photo</code> <code>has:quote</code></dt><dd>Only reports that carry figures, a photograph or a quote.</dd></div>'
            '<div><dt><kbd>/</kbd> <kbd>↓</kbd> <kbd>Esc</kbd></dt><dd>Jump to the search box, move through the results, come back to the box.</dd></div>'
            '</dl><p>Place names are matched however they are spelt: Khan Younis or Khan Yunis, Issawiya or al-Issawiya, Hebron or al-Khalil.</p></details>')
    body = ('<main id="main">\n<header class="rec-head shead"><div class="wrap"><h1>Search</h1>'
            f'<p class="rec-intro">Every report and story from {long_date(first, year=False)} to {long_date(last, year=False)}, in Palestine time.</p>'
            '<form class="sform" role="search" data-search action="search.html">'
            '<span class="field grow"><label for="sq">Search the record</label><input id="sq" name="q" type="search" autocomplete="off" spellcheck="false" '
            'placeholder="A place, a name, a number, or &quot;an exact phrase&quot;" aria-describedby="scount"></span>'
            '<button class="btn" type="submit">Search</button></form>' + tips + '</div></header>\n'
            '<section class="sres"><div class="wrap sgrid">'
            '<details class="sfacets" open data-facets-wrap><summary><span>Filters</span> <span class="nf" data-nf></span></summary>'
            '<div data-facets></div><button type="button" class="btn ghost sclear" data-clear hidden>Clear filters</button></details>'
            '<div class="sbody"><div class="sbar"><p class="scount" id="scount" aria-live="polite" data-count></p>'
            '<p class="sorder" role="group" aria-label="Order"><button type="button" data-order="best" aria-pressed="false">Best match</button>'
            '<button type="button" data-order="day" aria-pressed="true">As it happened</button></p></div>'
            '<p class="stry" data-try hidden></p><div data-results></div><div class="none" data-none hidden></div>'
            '<p class="smore" hidden><button type="button" class="btn ghost" data-more>Show more</button></p></div></div></section>\n</main>\n')
    page('search.html', title='Search · In Palestine Today', desc='Search every report and story, by words, place, source, day, desk and the light of the hour.', body=body, nav=None, css=('pages.css',), js=('search-index.js', 'pages.js', 'search.js'))

# ---------------------------------------------------------------- about
def render_about():
    body = '''<main id="main">
<header class="rec-head"><div class="wrap"><h1>Who we are</h1>
<p class="rec-intro">In Palestine Today says it aims to show “the human side of events in Palestine”, and to bring “the world closer to Palestine, one story at a time”. It publishes daily updates, stories, visuals and reports in English.</p>
<p class="draft-note">Draft copy for the newsroom to confirm or rewrite before launch. The wording in quotation marks is the outlet’s own, from its current About page.</p></div></header>
<div class="about">
  <section class="ab part" data-at="06:41" id="time" aria-labelledby="ab1"><div class="wrap ab-in"><p class="ab-at"><time>06:41</time><span>Sunrise over Jericho</span></p><div class="prose">
    <h2 id="ab1">Palestine time</h2>
    <p>The site keeps Palestine’s clock. Every time on it is Palestine time, the IANA zone Asia/Hebron, whatever the reader’s own clock says. The page also keeps Palestine’s light. It is pale at noon over Jerusalem, warm in the afternoon and violet at dusk, and it is dark at night there, even when it is morning where you read.</p>
    <p>The homepage tells one day in order, from midnight to the last report before the next. Each part of the day is printed in the light it happened in, and every report sits on the sun’s real path in the Day Dial at the minute it was filed. The full stop in our name is the sun, at its real height above the horizon now. The <a href="index.html">identity book</a> explains the system.</p>
  </div></div></section>
  <section class="ab part" data-at="12:25" id="sourcing" aria-labelledby="ab2"><div class="wrap ab-in"><p class="ab-at"><time>12:25</time><span>Noon</span></p><div class="prose">
    <h2 id="ab2">How we source</h2>
    <p>Each report names the source it was read from and links to it. Each figure names who counted it, and the date of the count. An accusation is attributed in the same sentence that makes it.</p>
    <p>We read the official Palestinian news agency WAFA, the UN’s humanitarian office OCHA and UN News, prisoners’ institutions, the Colonization and Wall Resistance Commission, municipal and health authorities, and international outlets. When two sources disagree, both are reported, as on <a href="{D52}">14 October</a>, when the agency’s count of the dead changed between evening and midnight.</p>
    <p>Times are when the source published, in Palestine time, not when the event happened; a report says so when the two differ. Children are never named. Private people are named only with their consent.</p>
    <p>Photographs from our own archive or from Wikimedia Commons carry the date and place they were taken. None is presented as showing an event it does not show, and none is tinted or graded.</p>
  </div></div></section>
  <section class="ab part" data-at="18:12" id="corrections" aria-labelledby="ab3"><div class="wrap ab-in"><p class="ab-at"><time>18:12</time><span>Sunset into Gaza’s sea</span></p><div class="prose">
    <h2 id="ab3">Corrections</h2>
    <p>When we get something wrong, we correct the report, say what changed and when, and keep the change visible at the end of the report. Write to <span class="ph">[corrections address]</span>.</p>
  </div></div></section>
  <section class="ab part" data-at="21:00" id="contact" aria-labelledby="ab4"><div class="wrap ab-in"><p class="ab-at"><time>21:00</time><span>Night</span></p><div class="prose">
    <h2 id="ab4">Contact</h2>
    <p>Newsroom: <span class="ph">[newsroom email]</span>. Tips and documents: <span class="ph">[secure contact]</span>. Editors: <span class="ph">[names and roles]</span>. Publisher and registered address: <span class="ph">[legal imprint]</span>.</p>
  </div></div></section>
</div>
</main>
'''
    body = body.replace('{D52}', ITEM_URL.get('d52', 'home.html'))
    page('about.html', title='Who we are · In Palestine Today', desc='Who In Palestine Today is, why its clock keeps Palestine time, how it sources every report, and how it corrects mistakes.', body=body, nav=None, css=('pages.css',), js=('pages.js',))

# ---------------------------------------------------------------- 404
def render_404():
    body = '''<main id="main">
<section class="lost" data-at="23:00" aria-labelledby="lost-h"><div class="wrap">
  <p class="lost-mark"><span class="wm" role="img" aria-label="In Palestine Today" data-mark-fixed data-fixed-alt="-30"><span class="w-in">in</span><span class="w-pal">palestine</span><span class="w-sun"></span><span class="w-today">today</span></span></p>
  <h1 id="lost-h">This page has set.</h1>
  <p class="rec-intro">The address doesn’t lead to a report, a day or a desk. It may have moved, or it may never have been filed.</p>
  <p class="lost-acts"><a class="btn" href="home.html">Read The Day</a><a class="btn ghost" href="search.html">Search every day</a><a class="btn ghost" href="days.html">The Days</a></p>
</div></section>
</main>
'''
    page('404.html', title='Not found · In Palestine Today', desc='This page has set.', body=body, nav=None, css=('pages.css',), js=('pages.js',), base=True)

# ---------------------------------------------------------------- build everything
for date in DATES:
    render_edition(date)
for iid in ITEM_URL:
    render_article(iid)
for key, name, intro in DESKS:
    render_record(f'{key}.html', key, name, intro, (lambda k: lambda it: it.get('region') == k)(key))
render_record('stories.html', 'stories', 'Stories', 'The human side of the day: people, places and what they lived through, reported at length.', is_story, nav='stories', thumbs=True, figures=[])
render_record('harvest.html', 'harvest', 'The olive harvest', 'The 2026 harvest, attack by attack and grove by grove, as farmers, the Colonization and Wall Resistance Commission and the agencies reported it.',
              lambda it: it.get('topic') == 'olive-harvest', nav=None,
              figures=[n for n in HEADLINE_NUMBERS if ITEMS.get(n.get('item_id'), {}).get('topic') == 'olive-harvest'][:4])
render_days()
render_visuals()
render_search()
render_about()
render_404()

# what tools/cards.mjs draws: one 1200 × 630 share card per report
os.makedirs(os.path.join(ROOT, 'tools', 'out'), exist_ok=True)
with open(os.path.join(ROOT, 'tools', 'out', 'cards.json'), 'w', encoding='utf-8') as f:
    json.dump(CARDS, f, ensure_ascii=False)

# the identity book borrows the latest edition
plan = EDITIONS[LATEST]
book = {'top': [[item(x).get('time'), item(x)['headline']] for x in plan.get('book_top', [])]}
bp = plan.get('book_photo')
if bp:
    p = PH[bp['photo']]
    book['photo'] = {'src': p['file'] + '-640.webp', 'alt': p.get('alt', ''), 'caption': p.get('caption', '') + ' Photo: ' + p.get('author', '') + ', via Wikimedia Commons, ' + p.get('license', '') + '.', 'headline': item(bp['item'])['headline'], 'time': item(bp['item']).get('time')}
bsp = plan.get('book_section_photo')
if bsp:
    p = PH[bsp]
    book['section'] = {'src': p['file'] + '-1280.webp', 'alt': p.get('alt', ''), 'w': p.get('w'), 'h': p.get('h'),
                       'caption': p.get('caption', '') + ' Photo: ' + p.get('author', '') + ', via Wikimedia Commons, ' + p.get('license', '') + '.'}
write('assets/js/edition.js', '/* generated by tools/build.py */\nwindow.IPT_EDITION_TOP=' + json.dumps(book['top'], ensure_ascii=False) + ';\nwindow.IPT_BOOK_PHOTO=' + json.dumps(book.get('photo'), ensure_ascii=False)
      + ';\nwindow.IPT_BOOK_SECTION_PHOTO=' + json.dumps(book.get('section'), ensure_ascii=False) + ';\n')
bd = plan.get('book_dial', [])
if bd:
    lis = [f'          <li><a href="home.html#{s["_id"]}" data-t="{s["_time"]}"><time>{s["_time"]}</time><span>{e(s.get("label", ""))}</span></a></li>' for s in SLOTS[LATEST] if s['_id'] in bd]
    book_html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    new = f'<ol class="dial-index" style="--n:{len(lis)}">\n' + '\n'.join(lis) + '\n        </ol>'
    book_html = re.sub(r'<ol class="dial-index" style="--n:\d+">.*?</ol>', new, book_html, count=1, flags=re.S)
    write('index.html', book_html)

print('editions', DATES, '· reports', len(ITEM_URL), '· photos', len(PH))

# ---------------------------------------------------------------- housekeeping
# stale report pages from earlier builds go; only credited, used photos are published
keep = {os.path.basename(p) for p in ITEM_URL.values()}
for f in glob.glob(os.path.join(ROOT, 'news', '*.html')):
    if os.path.basename(f) not in keep:
        os.remove(f)
used = set()
for f in glob.glob(os.path.join(ROOT, '**', '*.html'), recursive=True) + [os.path.join(ROOT, 'assets', 'js', 'edition.js')]:
    if os.sep + 'research' + os.sep in f or os.sep + 'tools' + os.sep in f:
        continue
    used |= set(re.findall(r'assets/img/photo/(ph\d+)-(?:1280|640)\.webp', open(f, encoding='utf-8').read()))
lines = ['# Photo credits', '', 'Archive photographs from Wikimedia Commons used on this site. Each caption on the page gives the real date and place; none shows the events reported beside it.', '']
for pid in sorted(used):
    p = PH[pid]
    lines.append(f"- **{pid}** — {p['caption']} Author: {p.get('author', '')}. Licence: {p.get('license', '')} ({p.get('license_url', '')}). Source: {p.get('commons_page', '')}")
write('assets/img/photo/CREDITS.md', '\n'.join(lines) + '\n')
gi = open(os.path.join(ROOT, '.gitignore'), encoding='utf-8').read().split('# archive photos not used on any page')[0].rstrip('\n')
unused = sorted(set(PH) - used)
gi += '\n\n# archive photos not used on any page (kept locally, not published) — rewritten by tools/build.py\n' + ''.join(f'assets/img/photo/{p}-*.webp\n' for p in unused)
write('.gitignore', gi)
print('photos published', len(used), '· kept local', len(unused))
