/* In Palestine Today — page behaviour.
 * Reads the sun from sun.js and lights the page: the chrome in Palestine's light now,
 * each part of the day in the light it happened in. One time drives everything (live or previewed). */
(function () {
  'use strict';
  var S = window.IPTSun;
  if (!S) return;
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function sstore(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function toMin(t) { var p = String(t).split(':'); return +p[0] * 60 + (+p[1] || 0); }

  /* ---------- state ---------- */
  var ed = (root.getAttribute('data-edition') || '').split('-').map(Number); // y, m, d of the edition shown
  var params = new URLSearchParams(location.search);
  var state = {
    mode: (function () { var m = store('ipt-light'); return m === 'day' || m === 'dark' ? m : 'follow'; })(),
    preview: params.get('at') && /^\d{1,2}:\d{2}$/.test(params.get('at')) ? toMin(params.get('at')) : null
  };

  // "Now" in Palestine. In preview the clock is set to a minute of the edition's day.
  function now() {
    var p = S.now();
    if (state.preview != null && ed.length === 3) {
      return { y: ed[0], m: ed[1], d: ed[2], minutes: state.preview, wd: S.weekday(ed[0], ed[1], ed[2]), preview: true };
    }
    return { y: p.y, m: p.m, d: p.d, minutes: p.minutes, wd: p.wd, preview: false };
  }
  function sameDay(n) { return ed.length === 3 && n.y === ed[0] && n.m === ed[1] && n.d === ed[2]; }

  // the edition day an element belongs to: its nearest [data-date], else the page's edition
  function dateOf(el) {
    var c = el && el.closest ? el.closest('[data-date]') : null;
    var v = c ? c.getAttribute('data-date') : root.getAttribute('data-edition');
    var p = (v || '').split('-').map(Number);
    return p.length === 3 ? p : null;
  }

  /* ---------- wordmark ---------- */
  // Where the full stop sits: 0 = resting on the baseline (the horizon), 1 = the ascender line.
  // Above the horizon it climbs to the ascender at 72° (Palestine's summer noon is ~82°, winter ~35°);
  // from sunset to the end of civil twilight (−6°) it sinks halfway into the baseline, and the moon takes over.
  // It never sinks further: a stop that vanishes leaves "inpalestine today", two words and a gap.
  var SINK = -0.1916; // half a dot diameter in units of the climb
  var UNDER = -0.383; // a whole diameter: where the loader's sun starts, out of sight
  function stopHeight(alt) { return alt >= 0 ? Math.min(1, alt / 72) : Math.max(SINK, -alt / 6 * SINK); }
  var MOON_CACHE = {};
  function moonSVG(m) {
    // the lit part of the moon as seen from Palestine (northern hemisphere): waxing lit on the right.
    var k = Math.round(m.phase * 60);
    if (MOON_CACHE[k]) return MOON_CACHE[k];
    var r = 50, x = Math.cos(2 * Math.PI * m.phase) * r; // terminator ellipse half-width
    var right = m.waxing;
    var sweepOuter = right ? 1 : 0;
    var sweepInner = (m.phase < 0.25 || m.phase > 0.75) ? (right ? 0 : 1) : (right ? 1 : 0);
    var d = 'M50 0 A50 50 0 0 ' + sweepOuter + ' 50 100 A' + Math.abs(x).toFixed(2) + ' 50 0 0 ' + sweepInner + ' 50 0Z';
    var svg = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="moon-ring" cx="50" cy="50" r="46.5"/>' + (m.lit > 0.02 ? '<path class="moon-lit" d="' + d + '"/>' : '') + '</svg>';
    MOON_CACHE[k] = svg;
    return svg;
  }

  function setMark(el, alt, date) {
    var sun = el.querySelector('.w-sun');
    if (!sun) return;
    var night = alt < -6;
    el.classList.toggle('is-night', night);
    if (!sun.querySelector('i')) sun.insertAdjacentHTML('beforeend', '<i></i><b></b>');
    var h = stopHeight(alt);
    sun.style.setProperty('--h', h.toFixed(3));
    if (night) {
      var b = sun.querySelector('b');
      var html = moonSVG(S.moon(date));
      if (b.innerHTML !== html) b.innerHTML = html;
    }
    var lab = el.getAttribute('data-label');
    if (lab !== null) el.setAttribute('aria-label', 'In Palestine Today, home');
  }

  /* ---------- light ---------- */
  function lightFor(y, m, d, minutes, mode) { return S.light(y, m, d, minutes, mode || state.mode); }

  var current = null;
  function paint() {
    var n = now();
    var L = lightFor(n.y, n.m, n.d, n.minutes);
    current = { n: n, L: L };
    S.applyTokens(root, L.tokens);
    root.classList.toggle('is-dark', L.dark);
    var instr = $('.instr');
    if (instr) {
      var sk = S.sky(L.alt, L.rising), lightSky = sk[0] > 0.62;
      instr.style.background = S.ok(sk);
      instr.style.setProperty('--ink', lightSky ? 'oklch(0.215 0.035 275)' : 'oklch(0.960 0.010 270)');
      instr.style.setProperty('--ink-2', lightSky ? 'oklch(0.360 0.040 275)' : 'oklch(0.860 0.025 270)');
      instr.style.setProperty('--rule', lightSky ? 'oklch(0.215 0.035 275 / .35)' : 'oklch(0.960 0.010 270 / .35)');
      instr.style.setProperty('--rule-2', 'transparent');
      instr.style.color = 'var(--ink-2)';
      instr.classList.toggle('on-dark', !lightSky);
      // the strip's inks are set for the sky; the panel that opens from it sits on the page's light instead
      var pnl = $('.lightsw .panel', instr);
      if (pnl) S.applyTokens(pnl, L.tokens);
    }
    root.setAttribute('data-light', L.key);
    root.classList.toggle('is-preview', !!n.preview);
    var at = S.instant(n.y, n.m, n.d, n.minutes);
    $$('.wm').forEach(function (el) { if (!el.closest('[data-mark-fixed]')) setMark(el, L.alt, at); });
    // a part's light depends on its own hour and the reader's mode, not on the time now: repaint them only when the mode changes
    // (fonts arriving, the page loading and resizes re-measure them separately)
    if (partsMode !== state.mode) paintParts();
    writeInstrument(n, L);
    drawDialNow(n, L);
    favicon(L.alt);
    document.dispatchEvent(new CustomEvent('ipt:light', { detail: current }));
  }

  // each part of the edition's day in the light of its own hour, blended slot by slot:
  // the ground at a slot's top is the light of the minute it was filed, so scrolling walks through the day
  // Writes, then reads, then writes: every part's light first, all the geometry in one layout, then the gradients.
  // (Reading a position between two writes makes the browser lay the whole page out again, once per part.)
  var partsMode = null;
  function paintParts() {
    partsMode = state.mode;
    var spans = [];
    $$('[data-at]').forEach(function (el) {
      var dd = dateOf(el);
      if (!dd) return;
      var L = lightFor(dd[0], dd[1], dd[2], toMin(el.getAttribute('data-at')));
      S.applyTokens(el, L.tokens);
      el.classList.toggle('is-dark', L.dark);
      el.setAttribute('data-light', L.key);
      el._light = L;
      if (el.hasAttribute('data-span')) spans.push({ el: el, dd: dd, mode: L.dark ? 'dark' : 'day' });   // one part never crosses the horizon mid-text
    });
    spans.forEach(function (p) {
      // parts below the screen skip rendering (content-visibility) and report a placeholder height;
      // their content still measures true, so the height is taken from the content
      var top = p.el.getBoundingClientRect().top;
      p.H = Math.max(1, Math.round((p.el.lastElementChild || p.el).getBoundingClientRect().bottom - top));
      p.slots = $$('.slot[data-time], .rows > .row[data-time]', p.el).map(function (s) { return { s: s, t: toMin(s.getAttribute('data-time')), y: s.getBoundingClientRect().top - top }; });
    });
    spans.forEach(function (p) {
      var dd = p.dd, span = p.el.getAttribute('data-span').split('-'), from = toMin(span[0]), to = Math.min(1439, toMin(span[1]));
      function col(min) { return S.ok(lightFor(dd[0], dd[1], dd[2], min, p.mode).ground); }
      var stops = [col(from) + ' 0px'];
      p.slots.forEach(function (x) {
        stops.push(col(x.t) + ' ' + Math.max(0, x.y) + 'px');
        x.s._light = lightFor(dd[0], dd[1], dd[2], x.t, p.mode);
      });
      stops.push(col(to) + ' ' + p.H + 'px');
      p.el.style.backgroundImage = 'linear-gradient(180deg,' + stops.join(',') + ')';
    });
  }

  /* ---------- instrument strip ---------- */
  function writeInstrument(n, L) {
    var ev = S.day(n.y, n.m, n.d);
    var clock = $('[data-clock]');
    if (clock) clock.textContent = S.hhmm(n.minutes);
    var date = $('[data-date]');
    if (date) date.textContent = S.DAYS[n.wd] + ' ' + n.d + ' ' + S.MONTHS[n.m - 1];
    var line = $('[data-sunline]');
    if (line) {
      var alt = Math.round(L.alt), txt;
      if (L.alt > 0) {
        txt = 'Sun <b>' + alt + '°</b> and ' + (L.rising ? 'rising' : 'falling') + ' · sets into Gaza’s sea at <b>' + S.hhmm(ev.sunsetGaza) + '</b>';
      } else if (n.minutes > ev.noon) {
        var tm = S.day(n.y, n.m, n.d + 1);
        txt = 'The sun set into Gaza’s sea at <b>' + S.hhmm(ev.sunsetGaza) + '</b> · rises over Jericho at <b>' + S.hhmm(tm.sunriseJericho) + '</b>';
      } else {
        txt = 'The sun is down · rises over Jericho at <b>' + S.hhmm(ev.sunriseJericho) + '</b>, in ' + S.span(ev.sunriseJericho - n.minutes);
      }
      line.innerHTML = txt;
      var sh = $('[data-sunline-short]');
      if (sh) sh.innerHTML = 'Sun <b>' + deg(L.alt) + '</b> · ' + (L.alt > 0 ? 'sets <b>' + S.hhmm(ev.sunsetGaza) + '</b>' : 'rises <b>' + S.hhmm(n.minutes > ev.noon ? S.day(n.y, n.m, n.d + 1).sunriseJericho : ev.sunriseJericho) + '</b>');
    }
    var st = $('[data-sunstamp]');
    if (st) st.innerHTML = stampSVG(L.alt);
    var pv = $('[data-preview-time]');
    if (pv) pv.textContent = S.hhmm(n.minutes);
    var nl = $('[data-night-line]');
    if (nl) {
      var e2 = S.day(n.y, n.m, n.d);
      nl.textContent = L.alt > 0
        ? 'It is ' + S.hhmm(n.minutes) + ' in Palestine. The sun sets into Gaza’s sea in ' + S.span(e2.sunsetGaza - n.minutes) + '.'
        : 'It is ' + S.hhmm(n.minutes) + ' in Palestine. ' + (n.minutes > e2.noon ? 'The next sun rises over Jericho at ' + S.hhmm(S.day(n.y, n.m, n.d + 1).sunriseJericho) + '.' : 'The sun rises over Jericho in ' + S.span(e2.sunriseJericho - n.minutes) + '.');
    }
    var fl = $('[data-first-light]');
    if (fl) { var t = S.day(n.y, n.m, n.d + 1); fl.textContent = S.hhmm(t.firstLight); }
  }

  // a sun stamp: the horizon and the sun at its height (filled), the moon's ring at night
  function stampSVG(alt, kind) {
    var y = alt >= 0 ? 9.5 - Math.min(1, alt / 72) * 8 : 9.5 + Math.min(1, -alt / 6) * 4;
    var cls = kind === 'updated' ? 's ring' : kind === 'scheduled' ? 's dash' : 's';
    var col = alt > -6 ? ' style="--stamp-sun:' + S.ok(S.sunColour(alt)) + '"' : '';
    if (alt < -6) return '<svg class="stamp" viewBox="0 0 22 14" aria-hidden="true"><line class="hz" x1="0" x2="22" y1="11.5" y2="11.5"/><circle class="s ring" cx="11" cy="7.5" r="2.6"/></svg>';
    return '<svg class="stamp" viewBox="0 0 22 14" aria-hidden="true"' + col + '><defs><clipPath id="c' + Math.round(alt * 10) + '"><rect x="0" y="-4" width="22" height="15.5"/></clipPath></defs><circle class="' + cls + '" clip-path="url(#c' + Math.round(alt * 10) + ')" cx="11" cy="' + y.toFixed(2) + '" r="2.6"/><line class="hz" x1="0" x2="22" y1="11.5" y2="11.5"/></svg>';
  }
  window.IPTStamp = stampSVG;

  function paintStamps() {
    $$('[data-stamp]').forEach(function (el) {
      var dd = dateOf(el);
      if (!dd) return;
      var t = toMin(el.getAttribute('data-stamp'));
      var alt = S.position(S.instant(dd[0], dd[1], dd[2], t)).alt;
      el.innerHTML = stampSVG(alt, el.getAttribute('data-state'));
      var lab = el.parentNode.querySelector('[data-alt]');
      if (lab) lab.textContent = alt > -6 ? 'Sun ' + deg(alt) : alt > -12 ? (t < 720 ? 'Dawn' : 'Dusk') : 'Night';
    });
  }

  function deg(a) { a = Math.round(a); return (a < 0 ? '−' + (-a) : a) + '°'; }
  // the sun's data for each part of the day, the lead's altitude, the dial's legend
  function evsOf(dd) {
    var ev = S.day(dd[0], dd[1], dd[2]);
    return [[ev.nauticalDawn, 'dawn'], [ev.firstLight, 'first light'], [ev.sunriseJericho, 'sunrise over Jericho'], [ev.noon, 'noon, sun ' + deg(ev.noonAlt)], [ev.sunsetGaza, 'sunset into Gaza\u2019s sea'], [ev.lastLight, 'last light'], [ev.nauticalDusk, 'night falls']];
  }
  function paintSunData() {
    $$('[data-sundata]').forEach(function (el) {
      var dd = dateOf(el); if (!dd) return;
      var r = el.getAttribute('data-sundata').split('-'), a = toMin(r[0]), b = toMin(r[1]);
      var a1 = S.position(S.instant(dd[0], dd[1], dd[2], a)).alt, a2 = S.position(S.instant(dd[0], dd[1], dd[2], Math.min(b, 1439))).alt;
      var inside = evsOf(dd).filter(function (x) { return x[0] >= a && x[0] <= b; }).map(function (x) { return x[1] + ' <b>' + S.hhmm(x[0]) + '</b>'; });
      el.innerHTML = 'Sun <b>' + deg(a1) + '</b> to <b>' + deg(a2) + '</b>' + (inside.length ? ' · ' + inside.join(' · ') : '');
    });
    $$('[data-alt-at]').forEach(function (el) { var dd = dateOf(el); if (dd) el.textContent = 'sun ' + deg(S.position(S.instant(dd[0], dd[1], dd[2], toMin(el.getAttribute('data-alt-at')))).alt); });
    $$('[data-dial-legend]').forEach(function (lg) {
      var dd = dateOf(lg); if (!dd) return;
      var ev = S.day(dd[0], dd[1], dd[2]);
      var mo = S.moon(S.instant(dd[0], dd[1], dd[2], 1260));
      lg.innerHTML = '<span class="lg-x">Dawn <b>' + S.hhmm(ev.nauticalDawn) + '</b> · First light <b>' + S.hhmm(ev.firstLight) + '</b> · </span>Sunrise over Jericho <b>' + S.hhmm(ev.sunriseJericho) + '</b> · Noon <b>' + S.hhmm(ev.noon) + '</b>, sun <b>' + deg(ev.noonAlt) + '</b> · Sunset into Gaza\u2019s sea <b>' + S.hhmm(ev.sunsetGaza) + '</b><span class="lg-x"> · Last light <b>' + S.hhmm(ev.lastLight) + '</b> · Night <b>' + S.hhmm(ev.nauticalDusk) + '</b> · Moon <b>' + Math.round(mo.lit * 100) + '%</b> lit, ' + (mo.waxing ? 'waxing' : 'waning') + ' · Day length <b>' + S.span(ev.sunset - ev.sunrise) + '</b></span>';
    });
    $$('[data-sun-brief]').forEach(function (el) {
      var dd = dateOf(el); if (!dd) return;
      var ev = S.day(dd[0], dd[1], dd[2]);
      el.innerHTML = 'Sunrise <b>' + S.hhmm(ev.sunriseJericho) + '</b> · noon <b>' + deg(ev.noonAlt) + '</b> · sunset <b>' + S.hhmm(ev.sunsetGaza) + '</b>';
    });
  }

  /* ---------- the Day Dial ---------- */
  // Every [data-dial] draws its own day: data-date on it or an ancestor (else the page's edition).
  // Index links marked .is-current get the big bead; .is-dim ones (other desks) stay small and faint.
  var dials = $$('[data-dial]');
  function drawDials() { dials.forEach(drawDial); }
  function drawDial(dial) {
    var dd = dateOf(dial);
    if (!dial || !dd) return;
    var band = $('.dial-band', dial), svg = $('svg.sky', dial);
    var W = band.clientWidth, H = band.clientHeight;
    if (!W) return;
    var y = dd[0], m = dd[1], d = dd[2], ev = S.day(y, m, d);
    var mini = H < 100;
    var hz = Math.round(H * (mini ? 0.62 : 0.6));
    var up = hz - (mini ? 8 : 14), down = H - hz - (mini ? 6 : 10);
    function yAlt(a) { return a >= 0 ? hz - a / 72 * up : hz + Math.min(1, -a / 60) * down; }
    function xMin(t) { return t / 1440 * W; }
    var stops = '', path = '';
    for (var t = 0; t <= 1440; t += 10) {
      var pos = S.position(S.instant(y, m, d, t));
      stops += '<stop offset="' + (t / 1440).toFixed(4) + '" stop-color="' + S.ok(S.sky(pos.alt, pos.rising)) + '"/>';
      path += (t ? ' L' : 'M') + xMin(t).toFixed(1) + ' ' + yAlt(pos.alt).toFixed(1);
    }
    var uid = 'sky' + y + m + d + '_' + dials.indexOf(dial);
    var g = '';
    g += '<defs><linearGradient id="' + uid + '" x1="0" x2="1" y1="0" y2="0">' + stops + '</linearGradient>';
    g += '<linearGradient id="' + uid + 'v" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="' + (hz / H).toFixed(3) + '" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></linearGradient>';
    g += '<clipPath id="' + uid + 'up"><rect x="0" y="0" width="' + W + '" height="' + hz + '"/></clipPath><clipPath id="' + uid + 'dn"><rect x="0" y="' + hz + '" width="' + W + '" height="' + (H - hz) + '"/></clipPath></defs>';
    g += '<rect width="' + W + '" height="' + H + '" fill="url(#' + uid + ')"/>';
    g += '<rect width="' + W + '" height="' + H + '" fill="url(#' + uid + 'v)"/>';
    var step = (mini || W < 640) ? 6 : 3;
    for (var h = 0; h <= 24; h += step) {
      var x = xMin(h * 60);
      var hp = S.position(S.instant(y, m, d, Math.min(1439, h * 60 + 20)));
      var light = S.sky(hp.alt, hp.rising)[0] > 0.62;
      g += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="0" y2="' + (mini ? 5 : 7) + '" stroke="' + (light ? 'rgba(21,24,42,.55)' : 'rgba(233,232,240,.6)') + '"/>';
      if (h > 0 && h < 24 && !mini) g += '<text class="hours" x="' + (x + 4).toFixed(1) + '" y="16" fill="' + (light ? 'rgba(21,24,42,.78)' : 'rgba(233,232,240,.82)') + '">' + (h < 10 ? '0' : '') + h + ':00</text>';
    }
    // horizon + the sun's path (dashed below the horizon: the sun under the earth)
    g += '<line x1="0" x2="' + W + '" y1="' + hz + '" y2="' + hz + '" stroke="rgba(255,255,255,.55)" stroke-width="1"/>';
    g += '<g clip-path="url(#' + uid + 'dn)"><path d="' + path + '" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.2" stroke-dasharray="3 4" class="sunpath-dn"/></g>';
    g += '<g clip-path="url(#' + uid + 'up)"><path d="' + path + '" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="1.6" class="sunpath"/></g>';
    if (!mini) {
      var evs = [[ev.firstLight, 'First light'], [ev.sunriseJericho, 'Sunrise · Jericho'], [ev.noon, 'Noon · ' + Math.round(ev.noonAlt) + '°'], [ev.sunsetGaza, 'Sunset · Gaza'], [ev.nauticalDusk, 'Night']];
      var ANCH = ['end', 'start', 'middle', 'end', 'start'], DX = [-6, 6, 0, -6, 6];
      if (W < 640) evs = [null, [ev.sunriseJericho, W < 480 ? 'Rise' : 'Sunrise'], null, [ev.sunsetGaza, W < 480 ? 'Set' : 'Sunset'], null];
      evs.forEach(function (e, i) {
        if (!e) return;
        var x = xMin(e[0]), ep = S.position(S.instant(y, m, d, e[0] + DX[i] * 4)), light = S.sky(ep.alt, ep.rising)[0] > 0.62;
        g += '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + (hz - 4) + '" y2="' + (hz + 4) + '" stroke="' + (light ? 'rgba(21,24,42,.7)' : 'rgba(255,255,255,.75)') + '"/>';
        g += '<text class="ev-label" text-anchor="' + ANCH[i] + '" x="' + (x + DX[i]).toFixed(1) + '" y="' + (H - 9) + '" fill="' + (light ? 'rgba(21,24,42,.85)' : 'rgba(240,240,248,.9)') + '">' + e[1] + ' ' + S.hhmm(e[0]) + '</text>';
      });
    }
    // the slots, strung on the sun's path
    var links = $$('.dial-index a[data-t]', dial);
    var beads = '';
    links.forEach(function (a, i) {
      var t = toMin(a.getAttribute('data-t'));
      var pos = S.position(S.instant(y, m, d, t));
      var bx = xMin(t), by = yAlt(pos.alt);
      a._bead = { x: bx, y: by, alt: pos.alt };
      var cur = a.classList.contains('is-current'), dim = a.classList.contains('is-dim');
      var fill = pos.alt > -6 ? S.ok(S.sunColour(pos.alt)) : '#E9E8F0';
      var r = cur ? 8.5 : dim ? 3 : (mini ? 4.5 : 5.5);
      beads += '<g class="bead' + (cur ? ' cur' : '') + (dim ? ' dim' : '') + '" data-i="' + i + '"><circle cx="' + bx.toFixed(1) + '" cy="' + by.toFixed(1) + '" r="13" fill="transparent"/>' +
        (cur ? '<circle cx="' + bx.toFixed(1) + '" cy="' + by.toFixed(1) + '" r="13" fill="none" stroke="#fff" stroke-width="1.5" opacity=".9"/>' : '') +
        '<circle class="b" cx="' + bx.toFixed(1) + '" cy="' + by.toFixed(1) + '" r="' + r + '" fill="' + fill + '" stroke="' + (pos.alt > -6 ? 'rgba(21,24,42,.85)' : 'rgba(14,17,32,.9)') + '" stroke-width="' + (dim ? 1 : 1.5) + '"' + (dim ? ' opacity=".55"' : '') + '/></g>';
    });
    g += '<g class="beads">' + beads + '</g>';
    g += '<g class="now" data-now></g>';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.innerHTML = g;
    dial._geo = { W: W, H: H, hz: hz, yAlt: yAlt, xMin: xMin, date: dd };
    drawLeaders(dial, links, W);
    $$('.bead', svg).forEach(function (b) {
      var a = links[+b.getAttribute('data-i')];
      b.addEventListener('mouseenter', function () { a.classList.add('is-on'); b.classList.add('is-on'); });
      b.addEventListener('mouseleave', function () { a.classList.remove('is-on'); b.classList.remove('is-on'); });
      b.addEventListener('click', function () { a.click(); });
      a.addEventListener('mouseenter', function () { b.classList.add('is-on'); });
      a.addEventListener('mouseleave', function () { b.classList.remove('is-on'); });
      a.addEventListener('focus', function () { b.classList.add('is-on'); });
      a.addEventListener('blur', function () { b.classList.remove('is-on'); });
    });
    if (current) drawDialNow(current.n, current.L);
    if (!dial._drawn && !reduce.matches && 'animate' in Element.prototype && !mini && !dial._waiting && !inView(dial) && 'IntersectionObserver' in window) {
      // below the fold: draw the day when the reader reaches it, not unseen at load
      dial._waiting = true;
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); dial._waiting = false; drawDial(dial); } }, { threshold: 0.35 });
      io.observe(dial);
      dial.classList.add('is-waiting');
    } else if (!dial._drawn && !reduce.matches && 'animate' in Element.prototype && !mini && !dial._waiting) {
      dial._drawn = true;
      dial.classList.remove('is-waiting');
      dial._drawAt = performance.now() + (dial.getAttribute('data-delay') | 0);
      playDraw(svg, links, dial._drawAt);
    } else if (dial._drawAt && performance.now() < dial._drawAt + 2100) {
      // a resize rebuilt the dial mid-draw: carry on from where the line had got to
      playDraw(svg, links, dial._drawAt);
    } else if (!dial._waiting) { dial._drawn = true; }
  }
  // The sun's path traces the day (1600 ms, sine in-out) and each bead lights as the line reaches it.
  function playDraw(svg, links, at) {
    var p = $('.sunpath', svg), pd = $('.sunpath-dn', svg), D = 1600;
    function run(el, frames, o) { var a = el.animate(frames, o); a.startTime = document.timeline.currentTime + (at - performance.now()); return a; }
    if (pd) run(pd, [{ opacity: 0 }, { opacity: 1 }], { duration: D, easing: 'linear', fill: 'backwards' });
    if (p && p.getTotalLength) {
      var len = p.getTotalLength();
      p.style.strokeDasharray = len;
      run(p, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: D, easing: 'cubic-bezier(.37,0,.63,1)', fill: 'backwards' });
      $$('.bead', svg).forEach(function (b, i) {
        // the line moves on a sine in-out curve: invert it so the bead lights as the line arrives
        var f = toMin(links[i].getAttribute('data-t')) / 1440;
        run(b, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: D * Math.acos(1 - 2 * f) / Math.PI, fill: 'backwards', easing: 'ease-out' });
      });
    }
  }
  function inView(el) { var r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }

  function drawLeaders(dial, links, W) {
    var lead = $('.dial-leaders', dial);
    if (!lead) return;
    var idx = $('.dial-index', dial);
    var ir = idx.getBoundingClientRect(), br = $('.dial-band', dial).getBoundingClientRect();
    var Hh = ir.top - br.bottom;
    if (Hh <= 4 || getComputedStyle(lead).display === 'none') { lead.innerHTML = ''; return; }
    lead.setAttribute('viewBox', '0 0 ' + W + ' ' + Hh);
    lead.style.height = Hh + 'px';
    lead.style.top = (br.bottom - dial.getBoundingClientRect().top) + 'px';
    var p = '';
    links.forEach(function (a) {
      var r = a.getBoundingClientRect();
      var cx = r.left - br.left + 12, bx = a._bead ? a._bead.x : cx;
      p += '<path d="M' + bx.toFixed(1) + ' 0 V ' + (Hh * 0.35).toFixed(1) + ' L ' + cx.toFixed(1) + ' ' + (Hh - 2).toFixed(1) + ' V ' + Hh.toFixed(1) + '"/>';
    });
    lead.innerHTML = p;
  }

  function drawDialNow(n, L) {
    dials.forEach(function (dial) {
      var geo = dial._geo;
      if (!geo) return;
      var g = $('[data-now]', dial);
      var live = n.y === geo.date[0] && n.m === geo.date[1] && n.d === geo.date[2];
      $$('.dial-index a[data-t]', dial).forEach(function (a) { a.classList.toggle('is-future', live && toMin(a.getAttribute('data-t')) > n.minutes); });
      if (!g) return;
      if (!live) { g.innerHTML = ''; return; }
      var x = geo.xMin(n.minutes), y = geo.yAlt(L.alt);
      var col = L.alt > -6 ? S.ok(S.sunColour(L.alt)) : '#E9E8F0';
      g.innerHTML = '<line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="0" y2="' + geo.H + '" stroke="rgba(255,255,255,.9)" stroke-width="1.5"/>' +
        '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (geo.H < 100 ? 6 : 9) + '" fill="' + col + '" stroke="#fff" stroke-width="2"/>' +
        (geo.H < 100 ? '' : '<text class="ev-label" x="' + (x + 12).toFixed(1) + '" y="' + (geo.hz - 10) + '" fill="#fff">' + (n.preview ? 'Preview ' : 'Now ') + S.hhmm(n.minutes) + '</text>');
    });
  }

  /* ---------- reading bar + where you stopped ---------- */
  var rbar = $('.rbar');
  function setupReading() {
    var parts = $$('.part[data-at]');
    var slots = $$('.slot[id]');
    if (!rbar || !parts.length) return;
    var mast = $('.mast');
    var io1 = new IntersectionObserver(function (es) { es.forEach(function (e) { rbar.classList.toggle('is-on', !e.isIntersecting && e.boundingClientRect.top < 0); }); }, { threshold: 0 });
    io1.observe(mast);
    var readout = $('.readout', rbar);
    var trackSvg = $('.track svg', rbar);
    var active = null;
    function setActive(slot) {
      if (!slot || slot === active) return;
      active = slot;
      var part = slot.closest('.part');
      var t = slot.getAttribute('data-time');
      var L = slot._light || (part && part._light);
      if (L) { S.applyTokens(rbar, L.tokens); rbar.classList.toggle('is-dark', L.dark); setMark($('.wm', rbar), L.alt, S.instant(ed[0], ed[1], ed[2], toMin(t))); }
      if (readout) readout.innerHTML = t + ' <span>· ' + (L ? L.name : '') + '</span>';
      if (trackSvg) {
        var x = toMin(t) / 1440 * 100;
        trackSvg.innerHTML = '<line x1="0" x2="100%" y1="9" y2="9" stroke="currentColor" stroke-opacity=".35"/><line x1="0" x2="' + x.toFixed(2) + '%" y1="9" y2="9" stroke="currentColor" stroke-width="2"/><circle cx="' + x.toFixed(2) + '%" cy="9" r="5" fill="' + (L && L.alt > -6 ? S.ok(S.sunColour(L.alt)) : 'currentColor') + '"/>';
      }
      store('ipt-stop', ed.join('-') + '|' + slot.id);
      $$('.dial-index a').forEach(function (a) { a.classList.toggle('is-reading', a.getAttribute('href') === '#' + slot.id); });
    }
    var io2 = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) setActive(e.target); });
    }, { rootMargin: '-35% 0px -60% 0px' });
    slots.forEach(function (s) { io2.observe(s); });
  }
  function markStop() {
    var v = store('ipt-stop');
    if (!v) return;
    var p = v.split('|');
    if (p[0] !== ed.join('-')) return;
    var a = $('.dial-index a[href="#' + p[1] + '"]');
    if (a && p[1] !== ($('.slot[id]') || {}).id) {
      a.parentNode.classList.add('here');
      var cont = $('[data-continue]');
      if (cont) { cont.hidden = false; cont.href = '#' + p[1]; var tt = a.querySelector('time'); if (tt) cont.querySelector('b').textContent = tt.textContent; }
    }
  }

  /* ---------- light switch ---------- */
  function setupSwitch() {
    var sw = $('.lightsw');
    if (!sw) return;
    var btn = $('button[aria-controls]', sw), panel = $('.panel', sw), radios = $$('input[name="light"]', sw);
    var range = $('input[type="range"]', sw), out = $('output', sw);
    function label() {
      var l = state.mode === 'day' ? 'Always light' : state.mode === 'dark' ? 'Always dark' : 'Palestine’s light';
      $('[data-mode-label]', sw).textContent = l;
      radios.forEach(function (r) { r.checked = r.value === state.mode; });
    }
    function open(v) { panel.hidden = !v; btn.setAttribute('aria-expanded', String(v)); if (v) (radios.filter(function (r) { return r.checked; })[0] || radios[0]).focus(); }
    btn.addEventListener('click', function () { open(panel.hidden); });
    radios.forEach(function (r) {
      r.addEventListener('change', function () { state.mode = r.value; store('ipt-light', state.mode === 'follow' ? null : state.mode); label(); paint(); });
    });
    sw.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { open(false); btn.focus(); } });
    document.addEventListener('click', function (e) { if (!sw.contains(e.target)) { if (!panel.hidden) open(false); } });
    if (range) {
      if (ed.length === 3) {
        var stops = [];
        for (var t = 0; t <= 1440; t += 60) { var p = S.position(S.instant(ed[0], ed[1], ed[2], t)); stops.push(S.ok(S.sky(p.alt, p.rising)) + ' ' + (t / 14.4).toFixed(1) + '%'); }
        range.style.setProperty('--sky-track', 'linear-gradient(90deg,' + stops.join(',') + ')');
      }
      range.value = state.preview != null ? state.preview : Math.round(S.now().minutes);
      out.textContent = S.hhmm(+range.value);
      range.addEventListener('input', function () { state.preview = +range.value; out.textContent = S.hhmm(state.preview); paint(); });
    }
    $$('[data-live]').forEach(function (b) { b.addEventListener('click', function () { state.preview = null; if (range) { range.value = Math.round(S.now().minutes); out.textContent = S.hhmm(+range.value); } history.replaceState(null, '', location.pathname + location.hash); paint(); }); });
    label();
  }

  /* ---------- find in today's edition ---------- */
  function setupFind() {
    var btn = $('[data-find]'), box = $('.find');
    if (!btn || !box) return;
    var input = $('input', box), list = $('ol', box), none = $('.none', box);
    var items = $$('.slot[id]').map(function (s) {
      var h = $('h3', s), t = s.getAttribute('data-time'), extra = $$('.briefs h4', s).map(function (x) { return x.textContent; }).join(' ');
      return { id: s.id, t: t, title: h ? h.textContent : '', hay: ((h ? h.textContent : '') + ' ' + s.textContent + ' ' + extra).toLowerCase() };
    });
    function esc(x) { return x.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    var all = $('.find-all a', box), allHref = all ? all.getAttribute('href') : '';
    function render() {
      var q = input.value.trim().toLowerCase();
      // "Search every day" carries the words over to the full search
      if (all) all.setAttribute('href', allHref + (q ? '?q=' + encodeURIComponent(input.value.trim()) : ''));
      var hits = q ? items.filter(function (i) { return i.hay.indexOf(q) > -1; }) : items;
      list.innerHTML = hits.map(function (i) {
        var title = esc(i.title);
        if (q) { var k = i.title.toLowerCase().indexOf(q); if (k > -1) title = esc(i.title.slice(0, k)) + '<mark>' + esc(i.title.slice(k, k + q.length)) + '</mark>' + esc(i.title.slice(k + q.length)); }
        return '<li><a href="#' + i.id + '"><time>' + i.t + '</time><span>' + title + '</span></a></li>';
      }).join('');
      none.hidden = hits.length > 0;
    }
    function open(v) { box.hidden = !v; btn.setAttribute('aria-expanded', String(v)); if (v) { render(); input.focus(); } }
    btn.addEventListener('click', function () { open(box.hidden); });
    input.addEventListener('input', render);
    box.addEventListener('click', function (e) { if (e.target.closest('a')) open(false); });
    box.addEventListener('keydown', function (e) { if (e.key === 'Escape') { open(false); btn.focus(); } });
    document.addEventListener('click', function (e) { if (!box.hidden && !box.contains(e.target) && !btn.contains(e.target)) open(false); });
    $('form', box).addEventListener('submit', function (e) { e.preventDefault(); var a = $('a', list); if (a) { a.click(); location.hash = a.getAttribute('href'); } });
  }

  /* ---------- favicon: the sun at its height ---------- */
  var favEl = null, favKey = '';
  function favicon(alt) {
    var M = window.IPT_MARKS && window.IPT_MARKS.mono;
    if (!M) return;
    var h = stopHeight(alt);
    var key = Math.round(h * 24) + (alt < -6 ? 'n' : 'd');
    if (key === favKey) return;
    favKey = key;
    var night = alt < -6;
    // same geometry as tools/brand.py svg_monogram(size=64)
    var size = 64, s = size * 0.62 / M.w, ox = (size - M.w * s) / 2, oy = size / 2 + (M.top * s) / 2;
    var r = M.sun[2], cx = M.sun[0], climb = 0.74 * M.upm - 2 * r;
    var cy = -(r + h * climb);
    var sun = night
      ? '<circle cx="' + cx + '" cy="' + (-r) + '" r="' + (r * 0.82) + '" fill="none" stroke="#E9E8F0" stroke-width="' + (r * 0.36) + '"/>'
      : '<circle cx="' + cx + '" cy="' + cy.toFixed(1) + '" r="' + r + '" fill="' + S.ok(S.sunColour(alt)) + '"/>';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="' + (night ? '#0E1120' : '#15182A') + '"/>' +
      '<g transform="translate(' + ox.toFixed(2) + ' ' + oy.toFixed(2) + ') scale(' + s.toFixed(5) + ')"><clipPath id="h"><rect x="-200" y="-2000" width="4000" height="2000"/></clipPath>' +
      '<path fill="#E9E8F0" d="' + M.d + '"/><g clip-path="url(#h)">' + sun + '</g></g></svg>';
    if (!favEl) favEl = document.querySelector('link[rel="icon"][data-live]');
    if (favEl) favEl.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  /* ---------- loader: every visit starts at first light ---------- */
  function loader(done) {
    var el = $('.loader');
    var force = params.has('loader');
    // a hidden tab pauses animation frames: never hold a page behind a loader nobody can see
    if (!el || document.hidden || (!force && (sstore('ipt-loader') || reduce.matches)) || !('animate' in Element.prototype)) { if (el) el.remove(); done(); return; }
    sstore('ipt-loader', '1');
    el.hidden = false;
    document.body.style.overflow = 'hidden';
    var n = now(), L = lightFor(n.y, n.m, n.d, n.minutes);
    var mark = $('.wm', el), hz = $('.hz', el), note = $('.note', el);
    var sun = $('.w-sun', mark);
    if (!sun.querySelector('i')) sun.insertAdjacentHTML('beforeend', '<i></i><b></b>');
    var target = L.alt;
    note.textContent = S.hhmm(n.minutes) + ' in Palestine · ' + L.name.toLowerCase();
    S.applyTokens(el, lightFor(n.y, n.m, n.d, n.minutes, 'dark').tokens);
    var words = $$('.wm > span:not(.w-sun)', el);
    var E = 'cubic-bezier(.37,0,.63,1)';
    hz.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 560, easing: E, fill: 'forwards' });
    words.forEach(function (w, i) { w.animate([{ opacity: 0, transform: 'translateY(.18em)' }, { opacity: 1, transform: 'none' }], { duration: 640, delay: 300 + i * 90, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' }); });
    // the sun rises from under the baseline to its height now (or the moon takes the stop at night)
    var startH = UNDER, endH = stopHeight(target);
    var night = target < -6;
    var t0 = performance.now() + 360, dur = night ? 420 : 1000;
    sun.style.setProperty('--h', startH);
    var i = $('i', sun);
    i.style.transition = 'none';
    i.style.background = S.ok(S.sunColour(-4));
    function step(t) {
      var k = Math.max(0, Math.min(1, (t - t0) / dur));
      var e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      var h = night ? startH : startH + (endH - startH) * e;
      sun.style.setProperty('--h', h.toFixed(3));
      var altNow = night ? -6 : -6 + (target + 6) * e;
      i.style.background = S.ok(S.sunColour(altNow));
      if (k < 1) requestAnimationFrame(step);
      else {
        if (night) { mark.classList.add('is-night'); $('b', sun).innerHTML = moonSVG(S.moon(new Date())); }
        note.animate([{ opacity: 0 }, { opacity: .8 }], { duration: 400, fill: 'forwards' });
        setTimeout(finish, night ? 560 : 380);
      }
    }
    requestAnimationFrame(step);
    function finish() {
      // the lockup docks into the masthead: the same mark, moved, not a second one appearing
      var dest = $('.mast .wm');
      var a = mark.getBoundingClientRect(), b = dest ? dest.getBoundingClientRect() : null;
      i.style.transition = '';
      S.applyTokens(el, L.tokens);
      el.style.transition = 'background-color .7s cubic-bezier(.37,0,.63,1), color .7s';
      el.style.background = 'var(--ground)'; el.style.color = 'var(--ink)';
      if (b && b.width) {
        var s = b.width / a.width;
        var dx = b.left - a.left, dy = b.top - a.top;
        mark.style.transformOrigin = '0 0';
        mark.animate([{ transform: 'none' }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ')' }], { duration: 680, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' }).onfinish = end;
        hz.animate([{ opacity: .5 }, { opacity: 0 }], { duration: 400, fill: 'forwards' });
        note.animate([{ opacity: .8 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
      } else end();
    }
    function end() {
      clearTimeout(guard);
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }).onfinish = function () { el.remove(); document.body.style.overflow = ''; };
      done();
    }
    function skip() { clearTimeout(guard); if (!el.isConnected) return; el.remove(); document.body.style.overflow = ''; done(); }
    var guard = setTimeout(skip, 6000); // whatever happens, the day is readable within six seconds
    document.addEventListener('visibilitychange', function v() { if (document.hidden) { document.removeEventListener('visibilitychange', v); skip(); } });
    el.addEventListener('click', skip);
    document.addEventListener('keydown', function k(e) { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { document.removeEventListener('keydown', k); skip(); } });
  }

  /* ---------- small things ---------- */
  function setupSignup() {
    $$('form[data-signup]').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var inp = $('input[type="email"]', f), msg = $('.msg', f);
        if (!inp.value || !inp.checkValidity()) { msg.textContent = 'That address looks incomplete. Check it and try again.'; inp.focus(); return; }
        msg.textContent = 'You’re on the list. The Day reaches you at first light, Palestine time.';
      });
    });
  }

  /* ---------- go ---------- */
  var booted = false;
  function boot() {
    if (booted) return; booted = true;
    paintStamps();
    paintSunData();
    paint();
    drawDials();
    markStop();
    setupReading();
    setupSwitch();
    setupFind();
    setupSignup();
    if ('ResizeObserver' in window && dials.length) { var rt; var ro = new ResizeObserver(function () { clearTimeout(rt); rt = setTimeout(function () { drawDials(); paintParts(); }, 80); }); dials.forEach(function (d) { ro.observe($('.dial-band', d)); }); }
    window.addEventListener('load', paintParts);
    setInterval(function () { if (state.preview == null) paint(); }, 20000);
    document.fonts && document.fonts.ready.then(function () { paintParts(); dials.forEach(function (d) { if (d._geo) drawLeaders(d, $$('.dial-index a[data-t]', d), d._geo.W); }); });
    document.dispatchEvent(new CustomEvent('ipt:ready'));
  }
  window.IPT = { state: state, paint: paint, now: now, stamp: stampSVG, setMark: setMark, moonSVG: moonSVG, lightFor: lightFor, store: store };

  // paint immediately (no flash of the wrong light), then let the loader run;
  // transitions wait two frames so the first paint lands in its light instead of fading into it
  paint();
  requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('is-lit'); }); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { paint(); loader(boot); });
  else loader(boot);
})();
