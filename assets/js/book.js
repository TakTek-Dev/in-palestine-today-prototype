/* Identity book — live demonstrations of the system. Needs sun.js and ipt.js. */
(function () {
  'use strict';
  var S = window.IPTSun, I = window.IPT;
  if (!S || !I) return;
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function toMin(t) { var p = String(t).split(':'); return +p[0] * 60 + (+p[1] || 0); }
  var ED = (document.documentElement.getAttribute('data-edition') || '2026-10-14').split('-').map(Number);
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MARK = '<span class="w-in">in</span><span class="w-pal">palestine</span><span class="w-sun"></span><span class="w-today">today</span>';

  /* ---------- colour maths: OKLCH → sRGB, for hex values and contrast ---------- */
  function lin(c) {
    var L = c[0], a = c[1] * Math.cos(c[2] * Math.PI / 180), b = c[1] * Math.sin(c[2] * Math.PI / 180);
    var l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    var m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    var s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s].map(function (v) { return Math.max(0, Math.min(1, v)); });
  }
  function hex(c) {
    return '#' + lin(c).map(function (v) { var g = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; var h = Math.round(g * 255).toString(16); return h.length < 2 ? '0' + h : h; }).join('').toUpperCase();
  }
  function lum(c) { var r = lin(c); return 0.2126 * r[0] + 0.7152 * r[1] + 0.0722 * r[2]; }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  var INK_DAY = [0.215, 0.035, 275], INK_DARK = function (g) { return [0.950, 0.010, g[2]]; };

  function deg(a) { a = Math.round(a); return (a < 0 ? '−' + (-a) : a) + '°'; }
  function altAt(t) { return S.position(S.instant(ED[0], ED[1], ED[2], t)).alt; }

  /* ---------- sun altitude labels ---------- */
  $$('[data-alt-of]').forEach(function (el) {
    var t = toMin(el.getAttribute('data-alt-of'));
    var p = S.position(S.instant(ED[0], ED[1], ED[2], t));
    el.textContent = 'Sun ' + deg(p.alt) + ' · ' + (p.alt < -12 ? 'night' : p.alt < 0 ? (p.rising ? 'before sunrise' : 'after sunset') : p.rising ? 'rising' : 'setting');
  });

  /* ---------- fixed marks ---------- */
  $$('[data-fixed-alt]').forEach(function (el) { I.setMark(el, +el.getAttribute('data-fixed-alt'), new Date()); });

  /* ---------- cover: move the sun across today ---------- */
  var cover = $('.cover'), range = $('#cover-range'), cmark = $('[data-cover-mark]');
  var today = S.now();
  var playing = 0;
  function coverAt(min, fixed) {
    var L = S.light(today.y, today.m, today.d, min, 'follow');
    if (fixed) {
      cmark.setAttribute('data-mark-fixed', '');
      S.applyTokens(cover, L.tokens);
      cover.classList.toggle('is-dark', L.dark);
    }
    I.setMark(cmark, L.alt, S.instant(today.y, today.m, today.d, min));
    $('[data-cover-time]').textContent = S.hhmm(min);
    $('[data-cover-alt]').textContent = deg(L.alt);
    $('[data-cover-light]').textContent = L.name;
  }
  if (range) {
    var stops = [];
    for (var t = 0; t <= 1440; t += 30) { var p = S.position(S.instant(today.y, today.m, today.d, t)); stops.push(S.ok(S.sky(p.alt, p.rising)) + ' ' + (t / 14.4).toFixed(2) + '%'); }
    range.style.setProperty('--sky-track', 'linear-gradient(90deg,' + stops.join(',') + ')');
    var ev = S.day(today.y, today.m, today.d);
    var ticks = $('[data-cover-ticks]');
    var tk = [[0, '00:00'], [ev.sunriseJericho, 'Sunrise ' + S.hhmm(ev.sunriseJericho)], [ev.noon, 'Noon ' + S.hhmm(ev.noon)], [ev.sunsetGaza, 'Sunset ' + S.hhmm(ev.sunsetGaza)], [1439, '24:00']];
    ticks.innerHTML = tk.map(function (x) { return '<span style="left:' + (x[0] / 14.39).toFixed(2) + '%">' + x[1] + '</span>'; }).join('');
    range.value = Math.round(today.minutes);
    coverAt(+range.value, false);
    range.addEventListener('input', function () { cancelAnimationFrame(playing); coverAt(+range.value, true); });
    $('[data-cover-live]').addEventListener('click', function () {
      cancelAnimationFrame(playing);
      today = S.now();
      cmark.removeAttribute('data-mark-fixed');
      ['--ground', '--ground-2', '--sink', '--ink', '--ink-2', '--rule', '--rule-2', '--sun', '--sun-glow'].forEach(function (k) { cover.style.removeProperty(k); });
      cover.classList.remove('is-dark');
      range.value = Math.round(today.minutes);
      coverAt(+range.value, false);
      I.paint();
    });
    $('[data-cover-play]').addEventListener('click', function () {
      cancelAnimationFrame(playing);
      var start = performance.now(), from = 0, dur = reduce ? 1 : 14000;
      function step(now) {
        var k = Math.min(1, (now - start) / dur);
        var m = Math.round(from + 1439 * k);
        range.value = m; coverAt(m, true);
        if (k < 1) playing = requestAnimationFrame(step);
      }
      playing = requestAnimationFrame(step);
    });
    document.addEventListener('ipt:light', function () {
      if (cmark.hasAttribute('data-mark-fixed')) return;
      today = S.now(); range.value = Math.round(today.minutes); coverAt(+range.value, false);
    });
  }

  /* ---------- anatomy ---------- */
  var anat = $('[data-anatomy]');
  function drawAnatomy() {
    if (!anat) return;
    var mk = $('[data-anatomy-mark]', anat), svg = $('svg.ann', anat);
    I.setMark(mk, 36, new Date());
    var A = anat.getBoundingClientRect();
    function r(sel) { var b = $(sel, mk).getBoundingClientRect(); return { l: b.left - A.left, r: b.right - A.left, t: b.top - A.top, b: b.bottom - A.top, w: b.width, h: b.height }; }
    var sun = r('.w-sun'), dot = r('.w-sun i'), pin = r('.w-in'), pal = r('.w-pal'), tod = r('.w-today');
    var base = sun.b, asc = sun.t, W = A.width, narrow = W < 640;
    var g = '';
    g += '<line x1="0" x2="' + W + '" y1="' + base + '" y2="' + base + '"/>';
    g += '<line class="dash" x1="0" x2="' + W + '" y1="' + asc + '" y2="' + asc + '"/>';
    g += '<line class="dash" x1="' + (sun.l + sun.w / 2) + '" x2="' + (sun.l + sun.w / 2) + '" y1="' + asc + '" y2="' + base + '"/>';
    g += '<text x="' + (W - 2) + '" y="' + (base + 16) + '" text-anchor="end" class="k">' + (narrow ? 'Horizon · 0°' : 'Baseline = horizon · 0°') + '</text>';
    g += '<text x="' + (W - 2) + '" y="' + (asc - 8) + '" text-anchor="end" class="k">' + (narrow ? 'Zenith · 72°' : 'Ascender line = 72° and above') + '</text>';
    var cx = dot.l + dot.w / 2, cy = dot.t + dot.h / 2;
    if (!narrow) {
      g += '<path d="M' + (cx + dot.w * .7) + ' ' + cy + ' L ' + (cx + dot.w * 2.4) + ' ' + (asc - 30) + ' H ' + (cx + dot.w * 2.4 + 16) + '"/>';
      g += '<text x="' + (cx + dot.w * 2.4 + 20) + '" y="' + (asc - 26) + '">The sun · 0.205 em · shown at 36°</text>';
    }
    function under(b, label) {
      var x = b.l + b.w / 2, y0 = base + 30;
      g += '<path d="M' + b.l + ' ' + (y0) + ' V ' + (y0 + 8) + ' H ' + b.r + ' V ' + y0 + '"/>';
      g += '<text x="' + x + '" y="' + (y0 + 26) + '" text-anchor="middle">' + label + '</text>';
    }
    under(pin, 'in · 370');
    under(pal, 'palestine · 720');
    under(tod, 'today · 370');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + A.height);
    svg.innerHTML = g;
  }

  /* ---------- the mark through the day ---------- */
  var md = $('[data-markday]');
  if (md) {
    var ev2 = S.day(ED[0], ED[1], ED[2]);
    var times = [300, Math.round(ev2.firstLight + 12), Math.round(ev2.sunrise + 2), 480, 600, Math.round(ev2.noon), 900, 1050, Math.round(ev2.sunset + 12), 1260];
    md.innerHTML = times.map(function (t) {
      var a = altAt(t);
      return '<figure data-at="' + S.hhmm(t) + '"><span class="wm" role="img" aria-label="Wordmark at ' + S.hhmm(t) + '" data-mark-fixed data-t="' + t + '">' + MARK + '</span><figcaption><b>' + S.hhmm(t) + '</b> · ' + (a < -6 ? 'moon, ' + Math.round(S.moon(S.instant(ED[0], ED[1], ED[2], t)).lit * 100) + '% lit' : 'sun ' + deg(a)) + '</figcaption></figure>';
    }).join('');
  }

  /* ---------- the nine lights ---------- */
  var lt = $('[data-lights]');
  if (lt) {
    var ev3 = S.day(ED[0], ED[1], ED[2]);
    var when = {
      night: 'from ' + S.hhmm(ev3.nauticalDusk + 10) + ' to ' + S.hhmm(ev3.nauticalDawn),
      dawn: 'from ' + S.hhmm(ev3.nauticalDawn),
      firstLight: 'around ' + S.hhmm(ev3.firstLight),
      sunrise: 'around ' + S.hhmm(ev3.sunrise - 6),
      morning: 'around ' + S.hhmm(ev3.sunrise + 40),
      midday: S.hhmm(ev3.noon - 100) + ' to ' + S.hhmm(ev3.noon + 100),
      afternoon: 'around ' + S.hhmm(ev3.sunset - 110),
      golden: 'around ' + S.hhmm(ev3.sunset - 45),
      sunset: 'around ' + S.hhmm(ev3.sunset + 2),
      dusk: 'around ' + S.hhmm(ev3.lastLight + 6)
    };
    var order = ['dawn', 'firstLight', 'sunrise', 'morning', 'midday', 'afternoon', 'golden', 'sunset', 'dusk', 'night'];
    lt.innerHTML = order.map(function (k) {
      var L = S.LIGHTS[k], d = L.day, n = L.dark;
      var cd = contrast(d, INK_DAY), cn = contrast(n, INK_DARK(n));
      return '<article><div class="sw"><div style="background:' + S.ok(d) + ';color:' + S.ok(INK_DAY) + '"><span>By day</span>' + hex(d) + '<br>Ink ' + cd.toFixed(1) + ':1</div>' +
        '<div style="background:' + S.ok(n) + ';color:' + S.ok(INK_DARK(n)) + '"><span>In the dark</span>' + hex(n) + '<br>Ink ' + cn.toFixed(1) + ':1</div></div>' +
        '<div class="meta"><h4>' + L.name + '</h4>' + when[k] + ' today · <span class="sans">oklch(' + d.join(' ') + ')</span></div></article>';
    }).join('');
  }

  /* ---------- ramps ---------- */
  var sr = $('[data-sun-ramp]');
  if (sr) {
    var st = [];
    for (var a = -6; a <= 72; a += 3) st.push(S.ok(S.sunColour(a)) + ' ' + ((a + 6) / 78 * 100).toFixed(1) + '%');
    sr.style.background = 'linear-gradient(90deg,' + st.join(',') + ')';
    $('[data-sun-ticks]').innerHTML = [-6, 0, 6, 15, 30, 50, 72].map(function (a) { return '<span style="left:' + ((a + 6) / 78 * 100).toFixed(1) + '%">' + a + '°</span>'; }).join('');
  }
  var kr = $('[data-sky-ramp]');
  if (kr) {
    var s2 = [];
    for (var t2 = 0; t2 <= 1440; t2 += 10) { var p2 = S.position(S.instant(ED[0], ED[1], ED[2], t2)); s2.push(S.ok(S.sky(p2.alt, p2.rising)) + ' ' + (t2 / 14.4).toFixed(2) + '%'); }
    kr.style.background = 'linear-gradient(90deg,' + s2.join(',') + ')';
    $('[data-sky-ticks]').innerHTML = [0, 3, 6, 9, 12, 15, 18, 21, 24].map(function (h) { return '<span style="left:' + (h / 24 * 100).toFixed(2) + '%">' + (h < 10 ? '0' : '') + h + ':00</span>'; }).join('');
  }

  /* ---------- live favicon tile ---------- */
  var ft = $('[data-live-fav]');
  function favTile() { var l = document.querySelector('link[rel="icon"][data-live]'); if (ft && l) ft.innerHTML = '<img src="' + l.href + '" alt="The favicon now, the sun at its current height" style="width:62%;height:62%;image-rendering:pixelated">'; }

  /* ---------- loader frames ---------- */
  var fr = $('[data-frames]');
  if (fr) {
    var F = [
      ['Horizon', -9, 0, 0, '0 ms'],
      ['The sun rises', -2, 1, 0.4, '600 ms'],
      ['Words settle', 14, 1, 1, '1100 ms'],
      ['Its height now', 24, 1, 1, '1700 ms'],
      ['Docked', 24, 0, 1, '2400 ms']
    ];
    fr.innerHTML = F.map(function (f, i) {
      var light = i === 4;
      return '<figure style="' + (light ? 'background:oklch(0.966 0.010 92);color:#15182A' : '') + '"><div style="position:relative"><span class="wm" role="img" aria-label="' + f[0] + '" data-mark-fixed data-frame-alt="' + f[1] + '"><span class="w-in" style="opacity:' + f[3] + '">in</span><span class="w-pal" style="opacity:' + f[3] + '">palestine</span><span class="w-sun"></span><span class="w-today" style="opacity:' + f[3] + '">today</span></span>' +
        (i < 4 ? '<span style="position:absolute;left:-30%;right:-30%;bottom:0;height:1px;background:currentColor;opacity:' + (i === 0 ? .5 : .35) + ';transform:scaleX(' + (i === 0 ? .55 : 1) + ')"></span>' : '') +
        '</div><figcaption>' + f[4] + ' · ' + f[0] + '</figcaption></figure>';
    }).join('');
    $$('[data-frame-alt]', fr).forEach(function (el) { I.setMark(el, +el.getAttribute('data-frame-alt'), new Date()); });
  }

  /* ---------- applications ---------- */
  var DAY_ITEMS = window.IPT_EDITION_TOP || [['09:00', 'Settlers set fire to a mosque in Mukhmas before sunrise'], ['12:25', '2,027 patients died waiting for treatment abroad, Gaza’s medical aid director says'], ['13:18', 'Palestine condemns Colombia’s embassy in Jerusalem']];
  var dateLine = S.DAYS[S.weekday(ED[0], ED[1], ED[2])] + ' ' + ED[2] + ' ' + S.MONTHS[ED[1] - 1] + ' ' + ED[0];
  function skyBand() {
    var s = [];
    for (var t = 0; t <= 1440; t += 20) { var p = S.position(S.instant(ED[0], ED[1], ED[2], t)); s.push(S.ok(S.sky(p.alt, p.rising)) + ' ' + (t / 14.4).toFixed(2) + '%'); }
    return 'linear-gradient(90deg,' + s.join(',') + ')';
  }
  var pd = $('[data-post-day]');
  if (pd) {
    pd.innerHTML = '<div class="in"><span class="wm" role="img" aria-label="In Palestine Today" data-mark-fixed data-t="' + toMin(pd.getAttribute('data-at')) + '">' + MARK + '</span><span class="date">The Day · ' + dateLine + '</span><div class="skyband" style="background:' + skyBand() + '"></div><ol>' +
      DAY_ITEMS.map(function (x) { return '<li><time>' + x[0] + '</time><span>' + x[1] + '</span></li>'; }).join('') + '</ol></div>';
  }
  var ps = $('[data-post-story]');
  if (ps) {
    var ph = window.IPT_BOOK_PHOTO || { src: 'assets/img/photo/ph01-640.webp', alt: '' };
    var tt = toMin(ps.getAttribute('data-at'));
    if (ph.time) tt = toMin(ph.time);
    ps.setAttribute('data-at', S.hhmm(tt));
    ps.innerHTML = '<div class="ph"><img src="' + ph.src + '" alt="' + ph.alt + '" loading="lazy"></div><div class="panel"><span class="t"><span data-stamp="' + S.hhmm(tt) + '"></span>' + S.hhmm(tt) + ' · sun ' + deg(altAt(tt)) + '</span><h4>' + (ph.headline || DAY_ITEMS[1][1]) + '</h4><span class="wm" role="img" aria-label="In Palestine Today" data-mark-fixed data-t="' + tt + '">' + MARK + '</span></div>';
    var stp = $('[data-stamp]', ps); if (stp) stp.innerHTML = I.stamp(altAt(tt));
  }
  var og = $('[data-og]');
  if (og) {
    og.innerHTML = '<div class="in"><span class="wm" role="img" aria-label="In Palestine Today" data-mark-fixed data-og-mark>' + MARK + '</span><div class="row"><span>The Day · ' + dateLine + '</span><span>One day in Palestine, in order</span></div></div>';
  }
  $$('[data-mark-fixed][data-t]').forEach(function (el) { var t = +el.getAttribute('data-t'); I.setMark(el, altAt(t), S.instant(ED[0], ED[1], ED[2], t)); });

  /* ---------- the book's own photograph ---------- */
  var bp = $('[data-book-photo]');
  if (bp && window.IPT_BOOK_SECTION_PHOTO) {
    var q = window.IPT_BOOK_SECTION_PHOTO;
    bp.innerHTML = '<img src="' + q.src + '" alt="' + q.alt + '" width="' + q.w + '" height="' + q.h + '" loading="lazy" style="width:100%;height:auto;aspect-ratio:16/8;object-fit:cover"><figcaption>' + q.caption + '</figcaption>';
  }

  /* ---------- chapter nav follows the hour you read ---------- */
  var nav = $('.bk-nav');
  if (nav && 'IntersectionObserver' in window) {
    var links = $$('ol a', nav);
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = e.target.id;
        links.forEach(function (a) { a.classList.toggle('is-on', a.getAttribute('href') === '#' + id); });
        var L = e.target._light;
        if (L) { S.applyTokens(nav, L.tokens); nav.classList.toggle('is-dark', L.dark); I.setMark($('.wm', nav), L.alt, S.instant(ED[0], ED[1], ED[2], toMin(e.target.getAttribute('data-at')))); $('.wm', nav).setAttribute('data-mark-fixed', ''); }
      });
    }, { rootMargin: '-30% 0px -65% 0px' });
    $$('section.ch[id]').forEach(function (s) { io.observe(s); });
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { ['--ground', '--ground-2', '--sink', '--ink', '--ink-2', '--rule', '--rule-2', '--sun', '--sun-glow'].forEach(function (k) { nav.style.removeProperty(k); }); nav.classList.remove('is-dark'); $('.wm', nav).removeAttribute('data-mark-fixed'); links.forEach(function (a) { a.classList.remove('is-on'); }); } });
    }, { threshold: 0.3 }).observe(cover);
  }

  I.paint();
  function all() { drawAnatomy(); favTile(); }
  document.addEventListener('ipt:light', favTile);
  if (document.fonts) document.fonts.ready.then(all); else all();
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(drawAnatomy, 100); });
})();
