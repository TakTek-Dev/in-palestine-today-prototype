/* In Palestine Today — the search. Needs sun.js, ipt.js and search-index.js.
   Words match in any form (harvest, harvests, harvesting) and any spelling of a place; "quotes" keep a phrase,
   -word leaves one out, OR gives a choice, and field:value searches one part of a report. Results are ranked,
   or told day by day in the order they happened, each day drawn on its own sky. */
(function () {
  'use strict';
  var S = window.IPTSun, I = window.IPT, IDX = window.IPT_INDEX;
  var form = document.querySelector('[data-search]');
  if (!S || !I || !IDX || !form) return;
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toMin(t) { var p = String(t || '').split(':'); return +p[0] * 60 + (+p[1] || 0); }
  function ymd(s) { return String(s).split('-').map(Number); }

  /* ---------- words: one form for every spelling ---------- */
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/(\d),(?=\d{3}\b)/g, '$1').replace(/['’‘`ʼ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function stem(w) {
    if (w.length < 4 || /^\d+$/.test(w)) return w;
    if (w.length > 5 && /ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (w.length > 5 && /ing$/.test(w)) { w = w.slice(0, -3); return /(.)\1$/.test(w) && !/[lsz]$/.test(w) ? w.slice(0, -1) : w; }
    if (w.length > 4 && /ed$/.test(w)) { w = w.slice(0, -2); return /(.)\1$/.test(w) && !/[lsz]$/.test(w) ? w.slice(0, -1) : w; }
    if (/(ss|us|is)$/.test(w)) return w;
    if (/(ches|shes|xes|sses)$/.test(w)) return w.slice(0, -2);
    if (/s$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function toks(s) { var n = norm(s); return n ? n.split(' ').map(stem) : []; }

  // spellings of the same place, and words a reader may use for the same thing
  var SAME = [
    ['khan younis', 'khan yunis'], ['beit lahia', 'beit lahiya'], ['deir al balah', 'deir el balah'], ['tulkarm', 'tulkarem'],
    ['qalqilya', 'qalqiliya', 'qalqilia'], ['nablus', 'nabulus'], ['issawiya', 'issawiyeh', 'al issawiya', 'isawiya'], ['hebron', 'al khalil'],
    ['masafer yatta', 'masafer yata'], ['turmus ayya', 'turmusayya'], ['al aqsa', 'aqsa'], ['gaza city', 'gaza'], ['jenin camp', 'jenin'],
    ['arrest', 'detain', 'detention', 'detainee'], ['prisoner', 'detainee', 'captive'], ['kill', 'dead', 'death'],
    ['demolish', 'demolition', 'raze', 'bulldoze'], ['settler', 'settlement', 'outpost'],
    ['army', 'military', 'force', 'soldier'], ['un', 'united nations', 'ocha', 'unrwa'], ['hospital', 'health', 'medical'],
    ['journalist', 'reporter', 'press'], ['child', 'children', 'minor', 'boy', 'girl']
  ];
  var SYN = {};
  SAME.forEach(function (g) {
    var forms = g.map(function (x) { return toks(x).join(' '); });
    forms.forEach(function (f) { SYN[f] = (SYN[f] || []).concat(forms.filter(function (o) { return o !== f; })); });
  });

  /* ---------- the record, prepared once ---------- */
  var DESK = { gaza: 'Gaza', 'west-bank': 'West Bank', jerusalem: 'Jerusalem', prisoners: 'Prisoners', world: 'World' };
  var LIGHTS = [['night', 'Night'], ['dawn', 'Dawn'], ['morning', 'Morning'], ['midday', 'Midday'], ['afternoon', 'Afternoon'], ['sunset', 'Golden hour and sunset'], ['dusk', 'Dusk and night']];
  var FIELDS = { h: 8, p: 5, g: 4, x: 3, q: 2.5, n: 2.5, w: 2, s: 2, k: 2, b: 1 };
  function lightGroup(date, t) {
    var d = ymd(date), m = toMin(t);
    var key = S.light(d[0], d[1], d[2], m, 'day').key;
    if (key === 'night') return m < 720 ? 'night' : 'dusk';
    if (key === 'dawn' || key === 'firstLight') return 'dawn';
    if (key === 'sunrise' || key === 'morning') return 'morning';
    if (key === 'golden' || key === 'sunset') return 'sunset';
    if (key === 'dusk') return 'dusk';
    return key;
  }
  IDX.forEach(function (o, i) {
    o._i = i;
    o._l = lightGroup(o.d, o.t || '12:00');
    o._m = toMin(o.t || '12:00');
    o._sp = o.sp || [o.s];
    var nums = (o.n || []).map(function (n) { return n.join(' '); }).join(' ');
    o._f = { h: toks(o.h), p: toks(o.p), g: toks(o.g.replace(/-/g, ' ')), x: toks(o.x), q: toks(o.q), w: toks(o.w), n: toks(nums), s: toks(o.s), k: toks(o.k), b: toks(o.b) };
    o._all = ' ' + [o.h, o.p, o.x, o.q, o.w, nums, o.s, o.b].map(norm).join(' ') + ' ';
    o._stems = ' ' + Object.keys(o._f).map(function (k) { return o._f[k].join(' '); }).join(' ') + ' ';
  });
  var VOCAB = {};
  IDX.forEach(function (o) { norm(o.h + ' ' + o.p + ' ' + o.x + ' ' + o.b + ' ' + o.s).split(' ').forEach(function (w) { if (w.length > 3 && !/^\d+$/.test(w)) VOCAB[w] = (VOCAB[w] || 0) + 1; }); });

  /* ---------- reading a query ---------- */
  var OPS = { source: 'src', src: 'src', from: 'src', place: 'place', in: 'place', kind: 'kind', desk: 'desk', topic: 'topic', before: 'before', after: 'after', has: 'has', day: 'day' };
  function parse(raw) {
    var q = { clauses: [], phrases: [], not: [], ops: [], last: null };
    var re = /(-?)"([^"]*)"?|(-?)([^\s"]+)/g, m, parts = [];
    while ((m = re.exec(raw))) parts.push(m[2] != null ? { neg: !!m[1], phrase: m[2] } : { neg: !!m[3], word: m[4] });
    var or = false;
    parts.forEach(function (p, i) {
      if (p.phrase != null) { var n = norm(p.phrase); if (n) (p.neg ? q.not : q.phrases).push(n); return; }
      var w = p.word;
      if (w === 'OR') { or = true; return; }
      var op = /^([a-z]+):(.+)$/i.exec(w);
      if (op && OPS[op[1].toLowerCase()]) { q.ops.push({ k: OPS[op[1].toLowerCase()], v: op[2], neg: p.neg }); return; }
      var t = toks(w);
      if (!t.length) return;
      if (p.neg) { q.not.push(t.join(' ')); return; }
      var term = { s: t.join(' '), raw: w, prefix: i === parts.length - 1 && !/\s$/.test(raw) && t.length === 1 && w.length > 1 };
      if (or && q.clauses.length) q.clauses[q.clauses.length - 1].push(term); else q.clauses.push([term]);
      or = false;
    });
    // two or three words that name one place in another spelling ("Khan Yunis") become one term
    for (var i = 0; i < q.clauses.length; i++) {
      for (var n = 3; n >= 2; n--) {
        var run = q.clauses.slice(i, i + n);
        if (run.length < n || run.some(function (c) { return c.length > 1; })) continue;
        var joined = run.map(function (c) { return c[0].s; }).join(' ');
        if (SYN[joined]) {
          q.clauses.splice(i, n, [{ s: joined, raw: run.map(function (c) { return c[0].raw; }).join(' '), prefix: false }]);
          break;
        }
      }
    }
    var flat = [];
    q.clauses.forEach(function (c) { c.forEach(function (t) { flat.push(t); }); });
    q.terms = flat;
    return q;
  }
  function variants(term) {
    var out = [{ s: term.s, w: 1 }];
    (SYN[term.s] || []).forEach(function (v) { out.push({ s: v, w: 0.6 }); });
    return out;
  }
  function inField(arr, s, prefix) {
    var parts = s.split(' '), n = 0;
    for (var i = 0; i <= arr.length - parts.length; i++) {
      var ok = true;
      for (var j = 0; j < parts.length; j++) {
        var a = arr[i + j], b = parts[j];
        if (!(a === b || (prefix && j === parts.length - 1 && a.indexOf(b) === 0))) { ok = false; break; }
      }
      if (ok) n++;
    }
    return n;
  }
  function scoreTerm(o, term) {
    var best = 0;
    variants(term).forEach(function (v) {
      var sc = 0;
      for (var f in FIELDS) {
        var n = inField(o._f[f], v.s, term.prefix);
        if (n) sc += FIELDS[f] * Math.min(n, f === 'b' ? 3 : 2);
      }
      sc *= v.w;
      if (sc > best) best = sc;
    });
    return best;
  }
  function opMatch(o, op) {
    var v = norm(op.v), hit;
    switch (op.k) {
      case 'src': hit = norm(o.s).indexOf(v) > -1 || (o.n || []).some(function (n) { return norm(n[2]).indexOf(v) > -1; }); break;
      case 'place': hit = norm(o.p).indexOf(v) > -1 || (SYN[toks(op.v).join(' ')] || []).some(function (x) { return o._f.p.join(' ').indexOf(x) > -1; }); break;
      case 'kind': hit = norm(o.k).indexOf(v) === 0; break;
      case 'desk': hit = norm(DESK[o.r] || o.r).indexOf(v) === 0 || o.r === op.v; break;
      case 'topic': hit = norm(o.g).indexOf(v) > -1; break;
      case 'before': hit = o._m < toMin(op.v); break;
      case 'after': hit = o._m >= toMin(op.v); break;
      case 'day': hit = o.d === op.v || norm(longDay(o.d)).indexOf(v) > -1; break;
      case 'has': hit = v === 'photo' ? !!o.ph : v === 'figures' || v === 'figure' ? !!o.n : v === 'quote' ? !!o.q : true; break;
      default: hit = true;
    }
    return op.neg ? !hit : hit;
  }
  function match(o, q) {
    for (var i = 0; i < q.ops.length; i++) if (!opMatch(o, q.ops[i])) return -1;
    for (i = 0; i < q.not.length; i++) if (o._stems.indexOf(' ' + q.not[i] + ' ') > -1 || o._all.indexOf(' ' + q.not[i] + ' ') > -1) return -1;
    var score = 0;
    for (i = 0; i < q.phrases.length; i++) {
      if (o._all.indexOf(' ' + q.phrases[i] + ' ') < 0) return -1;
      score += norm(o.h).indexOf(q.phrases[i]) > -1 ? 12 : 4;
    }
    for (i = 0; i < q.clauses.length; i++) {
      var best = 0;
      q.clauses[i].forEach(function (t) { var s = scoreTerm(o, t); if (s > best) best = s; });
      if (!best) return -1;
      score += best;
    }
    // words typed together and found together rank above the same words scattered
    if (q.clauses.length > 1 && q.clauses.every(function (c) { return c.length === 1; })) {
      var run = q.clauses.map(function (c) { return c[0].s; }).join(' ');
      if ((' ' + o._f.h.join(' ') + ' ').indexOf(' ' + run) > -1) score += 14;
      else if (o._stems.indexOf(' ' + run) > -1) score += 5;
    }
    return score;
  }

  /* ---------- filters ---------- */
  var FACETS = [
    { k: 'day', label: 'Day', of: function (o) { return [o.d]; }, name: function (v) { return longDay(v); } },
    { k: 'desk', label: 'Desk', of: function (o) { return [o.r]; }, name: function (v) { return DESK[v] || v; } },
    { k: 'light', label: 'The light of the hour', of: function (o) { return [o._l]; }, name: function (v) { return (LIGHTS.filter(function (l) { return l[0] === v; })[0] || [0, v])[1]; }, order: LIGHTS.map(function (l) { return l[0]; }) },
    { k: 'kind', label: 'Kind', of: function (o) { return [o.k]; }, name: function (v) { return v; } },
    { k: 'src', label: 'Source', of: function (o) { return o._sp; }, name: function (v) { return v; }, top: 8 },
    { k: 'has', label: 'Carries', of: function (o) { var a = []; if (o.n) a.push('figures'); if (o.ph) a.push('photo'); if (o.q) a.push('quote'); return a; }, name: function (v) { return { figures: 'Figures', photo: 'A photograph', quote: 'A quote' }[v]; }, order: ['figures', 'photo', 'quote'] }
  ];
  function longDay(date) { var d = ymd(date); return S.DAYS[S.weekday(d[0], d[1], d[2])] + ' ' + d[2] + ' ' + S.MONTHS[d[1] - 1]; }
  var sel = {};
  FACETS.forEach(function (f) { sel[f.k] = []; });
  function passes(o, except) {
    for (var i = 0; i < FACETS.length; i++) {
      var f = FACETS[i];
      if (f.k === except || !sel[f.k].length) continue;
      var vals = f.of(o);
      // within a filter any value will do, except "carries", where each one is required
      if (f.k === 'has' ? !sel.has.every(function (v) { return vals.indexOf(v) > -1; }) : !vals.some(function (v) { return sel[f.k].indexOf(v) > -1; })) return false;
    }
    return true;
  }

  /* ---------- the page ---------- */
  var input = $('#sq'), list = $('[data-results]'), count = $('[data-count]'), none = $('[data-none]'), facetsEl = $('[data-facets]'),
      nf = $('[data-nf]'), clear = $('[data-clear]'), more = $('[data-more]'), tryEl = $('[data-try]'), wrapF = $('[data-facets-wrap]');
  var order = null, limit = 40;
  var phone = window.matchMedia('(max-width: 760px)');
  if (phone.matches) wrapF.open = false;

  function markHTML(text, terms) {
    if (!terms.length) return esc(text);
    var want = [];
    terms.forEach(function (t) { variants(t).forEach(function (v) { want.push({ s: v.s.split(' '), prefix: t.prefix }); }); });
    var out = '', last = 0, re = /[\p{L}\p{N}](?:[\p{L}\p{N}'’‘\-]|,(?=\d{3}))*/gu, m, words = [];
    while ((m = re.exec(text))) words.push({ i: m.index, w: m[0], t: toks(m[0]) });
    var on = new Array(words.length);
    for (var i = 0; i < words.length; i++) {
      want.forEach(function (v) {
        // a phrase variant ("khan yunis") can span words; a hyphenated word ("al-Aqsa") holds several
        var flat = [], map = [];
        for (var j = i; j < words.length && flat.length < v.s.length + 2; j++) words[j].t.forEach(function (t) { flat.push(t); map.push(j); });
        for (var k = 0; k + v.s.length <= flat.length && map[k] === i; k++) {
          var ok = true;
          for (var x = 0; x < v.s.length; x++) { var a = flat[k + x], b = v.s[x]; if (!(a === b || (v.prefix && x === v.s.length - 1 && a.indexOf(b) === 0))) { ok = false; break; } }
          if (ok) for (x = 0; x < v.s.length; x++) on[map[k + x]] = true;
        }
      });
    }
    words.forEach(function (w, i) {
      out += esc(text.slice(last, w.i)) + (on[i] ? '<mark>' + esc(w.w) + '</mark>' : esc(w.w));
      last = w.i + w.w.length;
    });
    return out + esc(text.slice(last));
  }
  function phraseMark(html, phrases) {
    phrases.forEach(function (p) {
      var words = p.split(' ').map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
      var re = new RegExp('(' + words.join('[^\\p{L}\\p{N}<]+') + ')', 'giu');
      html = html.replace(re, '<mark>$1</mark>');
    });
    return html;
  }
  function snippet(o, q) {
    if (!q.terms.length && !q.phrases.length) return '';
    var seen = norm(o.h + ' ' + o.x);
    var hitsHead = q.terms.every(function (t) { return inField(toks(o.h + ' ' + o.x), t.s, t.prefix); }) && q.phrases.every(function (p) { return seen.indexOf(p) > -1; });
    var out = '';
    if (o.n) {
      o.n.forEach(function (n) {
        var line = n[0] + ' ' + n[1];
        if (q.terms.some(function (t) { return inField(toks(line), t.s, t.prefix); }) || q.phrases.some(function (p) { return norm(line).indexOf(p) > -1; }))
          out += '<span class="sfig"><b>' + esc(n[0]) + '</b> ' + markHTML(n[1], q.terms) + (n[2] ? ' <cite>' + esc(n[2]) + '</cite>' : '') + '</span>';
      });
    }
    if (hitsHead) return out;
    var srcs = [o.q ? '“' + o.q + '”' + (o.w ? ' ' + o.w : '') : '', o.b];
    for (var s = 0; s < srcs.length; s++) {
      var sentences = (srcs[s] || '').match(/[^.!?]+[.!?]+["”’]?|[^.!?]+$/g) || [];
      for (var i = 0; i < sentences.length; i++) {
        var sn = sentences[i].trim(), nn = norm(sn), tt = toks(sn);
        if (q.terms.some(function (t) { return variants(t).some(function (v) { return inField(tt, v.s, t.prefix); }); }) || q.phrases.some(function (p) { return nn.indexOf(p) > -1; })) {
          if (sn.length > 260) sn = sn.slice(0, 250).replace(/\s+\S*$/, '') + '…';
          return '<span class="ssnip">' + phraseMark(markHTML(sn, q.terms), q.phrases) + '</span>' + out;
        }
      }
    }
    return out;
  }
  function row(o, q, best) {
    var dd = ymd(o.d), alt = S.position(S.instant(dd[0], dd[1], dd[2], o._m)).alt;
    var snip = snippet(o, q);
    var meta = [best ? longDay(o.d) : '', o.k, DESK[o.r] || '', o.s].filter(Boolean).map(esc).join(' · ');
    return '<li class="row" data-i="' + o._i + '" id="r' + o._i + '"><time datetime="' + o.d + 'T' + o.t + '+03:00">' + esc(o.t) + '</time><span class="row-stamp">' + I.stamp(alt) + '</span>' +
      '<div class="row-text"><h3><a href="' + o.u + '">' + phraseMark(markHTML(o.h, q.terms), q.phrases) + '</a></h3><p>' + phraseMark(markHTML(o.x, q.terms), q.phrases) + '</p>' +
      (snip ? '<p class="smatch">' + snip + '</p>' : '') + '<p class="row-m">' + meta + '</p></div></li>';
  }
  function sky(date, hits) {
    var d = ymd(date), stops = [];
    for (var t = 0; t <= 1440; t += 20) { var p = S.position(S.instant(d[0], d[1], d[2], t)); stops.push(S.ok(S.sky(p.alt, p.rising)) + ' ' + (t / 14.4).toFixed(2) + '%'); }
    var ev = S.day(d[0], d[1], d[2]);
    var beads = hits.map(function (o) {
      var a = S.position(S.instant(d[0], d[1], d[2], o._m)).alt;
      return '<a class="bd" href="#r' + o._i + '" style="left:' + (o._m / 14.4).toFixed(2) + '%;background:' + (a > -6 ? S.ok(S.sunColour(a)) : '#E9E8F0') + '" aria-label="' + esc(o.t + ', ' + o.h) + '" title="' + esc(o.t + ' · ' + o.h) + '"></a>';
    }).join('');
    return '<div class="sstrip" style="background:linear-gradient(90deg,' + stops.join(',') + ')"><span class="tk" style="left:' + (ev.sunriseJericho / 14.4).toFixed(2) + '%"></span><span class="tk" style="left:' + (ev.sunsetGaza / 14.4).toFixed(2) + '%"></span>' + beads + '</div>';
  }

  function facetsHTML(base) {
    return FACETS.map(function (f) {
      var counts = {};
      base.forEach(function (o) { if (passes(o, f.k)) f.of(o).forEach(function (v) { counts[v] = (counts[v] || 0) + 1; }); });
      var all = {};
      IDX.forEach(function (o) { f.of(o).forEach(function (v) { all[v] = (all[v] || 0) + 1; }); });
      var vals = Object.keys(all);
      if (f.order) vals.sort(function (a, b) { return f.order.indexOf(a) - f.order.indexOf(b); });
      else if (f.k === 'day') vals.sort().reverse();
      else vals.sort(function (a, b) { return (all[b] - all[a]) || (a < b ? -1 : 1); });
      var extra = '';
      if (f.top && vals.length > f.top) {
        var head = vals.slice(0, f.top), rest = vals.slice(f.top).filter(function (v) { return counts[v] || sel[f.k].indexOf(v) > -1; });
        vals = head; extra = rest;
      }
      function opt(v) {
        var c = counts[v] || 0, on = sel[f.k].indexOf(v) > -1;
        return '<label class="fo' + (c || on ? '' : ' is-zero') + '"><input type="checkbox" name="' + f.k + '" value="' + esc(v) + '"' + (on ? ' checked' : '') + (c || on ? '' : ' disabled') + '><span>' + esc(f.name(v)) + '</span><b>' + c + '</b></label>';
      }
      var body = vals.map(opt).join('');
      if (extra && extra.length) body += '<details class="fmore"' + (extra.some(function (v) { return sel[f.k].indexOf(v) > -1; }) ? ' open' : '') + '><summary>' + extra.length + ' more</summary>' + extra.map(opt).join('') + '</details>';
      return '<fieldset class="fg"><legend>' + f.label + '</legend>' + body + '</fieldset>';
    }).join('');
  }

  var timer = null, lastQ = null;
  function run(push) {
    var raw = input.value, q = parse(raw), hasQ = q.terms.length || q.phrases.length || q.ops.length || q.not.length;
    var scored = [];
    IDX.forEach(function (o) { var s = hasQ ? match(o, q) : 0; if (s >= 0) scored.push({ o: o, s: s }); });
    var base = scored.map(function (x) { return x.o; });
    var hits = scored.filter(function (x) { return passes(x.o); });
    var ord = order || (q.terms.length || q.phrases.length ? 'best' : 'day');
    if (ord === 'best') hits.sort(function (a, b) { return (b.s - a.s) || (a.o.d < b.o.d ? 1 : a.o.d > b.o.d ? -1 : a.o._m - b.o._m); });
    else hits.sort(function (a, b) { return (a.o.d < b.o.d ? 1 : a.o.d > b.o.d ? -1 : a.o._m - b.o._m); });
    $$('[data-order]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-order') === ord)); });

    var shown = hits.slice(0, limit), out = '';
    if (ord === 'best') {
      out = '<ol class="rows sbest">' + shown.map(function (x) { return row(x.o, q, true); }).join('') + '</ol>';
    } else {
      var groups = [];
      shown.forEach(function (x) { if (!groups.length || groups[groups.length - 1].d !== x.o.d) groups.push({ d: x.o.d, l: [] }); groups[groups.length - 1].l.push(x.o); });
      out = groups.map(function (g) {
        var total = hits.filter(function (x) { return x.o.d === g.d; }).length;
        return '<section class="sday" data-date="' + g.d + '"><h2>' + longDay(g.d) + ' <span>' + total + (total === 1 ? ' report' : ' reports') + '</span></h2>' + sky(g.d, g.l) +
          '<ol class="rows">' + g.l.map(function (o) { return row(o, q, false); }).join('') + '</ol></section>';
      }).join('');
    }
    list.innerHTML = out;
    more.parentNode.hidden = hits.length <= limit;
    more.textContent = 'Show ' + Math.min(40, hits.length - limit) + ' more of ' + (hits.length - limit);

    // the sentence above the results
    var nSel = FACETS.reduce(function (n, f) { return n + sel[f.k].length; }, 0);
    var what = raw.trim() ? ' for “' + esc(raw.trim()) + '”' : '';
    count.innerHTML = hits.length
      ? (hits.length === IDX.length ? 'All ' + IDX.length + ' reports and stories' : '<b>' + hits.length + '</b> of ' + IDX.length + ' reports and stories' + what) +
        (ord === 'best' ? ', best match first.' : ', day by day, each day in the order it happened.')
      : '';
    nf.textContent = nSel ? nSel + ' on' : '';
    clear.hidden = !nSel;
    facetsEl.innerHTML = facetsHTML(base);

    // nothing found: say why, and offer a way out
    none.hidden = hits.length > 0;
    if (!hits.length) {
      var tips = [];
      var sugg = didYouMean(q);
      if (sugg) tips.push('Did you mean <a href="?q=' + encodeURIComponent(sugg) + '" data-q="' + esc(sugg) + '">' + esc(sugg) + '</a>?');
      if (nSel) tips.push('<button type="button" class="linkish" data-clear-in>Clear the filters</button> to search every day, desk and hour.');
      else if (q.clauses.length > 1) tips.push('Try fewer words, or <code>OR</code> between them.');
      none.innerHTML = '<p>Nothing matches' + what + (nSel ? ' with these filters' : '') + '.</p>' + (tips.length ? '<p>' + tips.join(' ') + '</p>' : '');
    }
    tryEl.hidden = !!hasQ || nSel > 0;

    // the address keeps the search
    var p = new URLSearchParams();
    if (raw.trim()) p.set('q', raw.trim());
    FACETS.forEach(function (f) { if (sel[f.k].length) p.set(f.k, sel[f.k].join(',')); });
    if (order) p.set('order', order);
    var url = location.pathname + (p.toString() ? '?' + p : '');
    if (url !== location.pathname + location.search) history[push ? 'pushState' : 'replaceState'](null, '', url);
    lastQ = raw;
  }
  function didYouMean(q) {
    var changed = false;
    var words = q.terms.map(function (t) {
      if (IDX.some(function (o) { return scoreTerm(o, t) > 0; })) return t.raw;
      var w = norm(t.raw), best = null, bd = 3;
      Object.keys(VOCAB).forEach(function (v) { if (Math.abs(v.length - w.length) > 2) return; var dd = lev(w, v); if (dd < bd || (dd === bd && best && VOCAB[v] > VOCAB[best])) { bd = dd; best = v; } });
      if (best && bd <= (w.length > 6 ? 2 : 1)) { changed = true; return best; }
      return t.raw;
    });
    return changed ? words.join(' ') : null;
  }
  // edit distance where swapping two neighbouring letters ("olvie") counts as one slip
  function lev(a, b) {
    var m = [], i, j;
    for (i = 0; i <= a.length; i++) { m[i] = [i]; }
    for (j = 0; j <= b.length; j++) m[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) {
      var c = a[i - 1] === b[j - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) m[i][j] = Math.min(m[i][j], m[i - 2][j - 2] + 1);
    }
    return m[a.length][b.length];
  }

  // a few ways in, from what the record actually holds
  (function () {
    var places = {};
    IDX.forEach(function (o) { var p = o.p.split(',')[0].trim(); if (p && p.length < 24) places[p] = (places[p] || 0) + 1; });
    var top = Object.keys(places).sort(function (a, b) { return places[b] - places[a]; }).slice(0, 4);
    var ex = top.map(function (p) { return '"' + p + '"'; }).concat(['olive harvest', 'source:Haaretz', 'has:figures', 'settlers -Jerusalem']);
    tryEl.innerHTML = 'Try ' + ex.map(function (x) { return '<a href="?q=' + encodeURIComponent(x) + '" data-q="' + esc(x) + '"><code>' + esc(x) + '</code></a>'; }).join(' ');
  })();

  function readURL() {
    var p = new URLSearchParams(location.search);
    input.value = p.get('q') || '';
    FACETS.forEach(function (f) { sel[f.k] = (p.get(f.k) || '').split(',').filter(Boolean); });
    order = p.get('order') === 'best' || p.get('order') === 'day' ? p.get('order') : null;
  }
  readURL();
  run(false);

  input.addEventListener('input', function () { clearTimeout(timer); limit = 40; timer = setTimeout(function () { run(false); }, 140); });
  form.addEventListener('submit', function (e) { e.preventDefault(); clearTimeout(timer); limit = 40; run(true); var first = $('.row h3 a', list); if (phone.matches && first) input.blur(); });
  facetsEl.addEventListener('change', function (e) {
    var c = e.target; if (!c.matches('input[type=checkbox]')) return;
    var a = sel[c.name], i = a.indexOf(c.value);
    if (c.checked && i < 0) a.push(c.value); else if (!c.checked && i > -1) a.splice(i, 1);
    limit = 40; run(true);
    var again = $('input[name="' + c.name + '"][value="' + c.value.replace(/"/g, '\\"') + '"]', facetsEl); if (again) again.focus();
  });
  function clearAll() { FACETS.forEach(function (f) { sel[f.k] = []; }); limit = 40; run(true); }
  clear.addEventListener('click', clearAll);
  none.addEventListener('click', function (e) { if (e.target.closest('[data-clear-in]')) clearAll(); });
  $$('[data-order]').forEach(function (b) { b.addEventListener('click', function () { order = b.getAttribute('data-order'); run(true); }); });
  more.addEventListener('click', function () { var n = $$('.row', list).length; limit += 40; run(false); var r = $$('.row', list)[n]; if (r) $('a', r).focus(); });
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-q]'); if (!a) return;
    e.preventDefault(); input.value = a.getAttribute('data-q'); order = null; limit = 40; run(true); input.focus();
  });
  window.addEventListener('popstate', function () { readURL(); limit = 40; run(false); });

  // the keyboard: / to the box, ↓ ↑ through the results, Esc back to the box
  document.addEventListener('keydown', function (e) {
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(tag) && !e.metaKey && !e.ctrlKey) { e.preventDefault(); input.focus(); input.select(); return; }
    var links = $$('.row h3 a', list);
    if (!links.length) return;
    var at = links.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && (document.activeElement === input || at > -1)) { e.preventDefault(); links[Math.min(at + 1, links.length - 1)].focus(); }
    else if (e.key === 'ArrowUp' && at > -1) { e.preventDefault(); if (at === 0) input.focus(); else links[at - 1].focus(); }
    else if (e.key === 'Escape' && at > -1) { input.focus(); }
  });
  // a bead on a day's sky takes you to its report in the list
  list.addEventListener('click', function (e) {
    var b = e.target.closest('.bd'); if (!b) return;
    e.preventDefault();
    var r = document.getElementById(b.getAttribute('href').slice(1));
    if (r) { r.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); $('a', r).focus({ preventScroll: true }); r.classList.add('is-hit'); setTimeout(function () { r.classList.remove('is-hit'); }, 1600); }
  });
})();
