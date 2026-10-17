/* In Palestine Today — inner pages: copy and share, October in Palestine’s sky. Needs sun.js and ipt.js. (The search is search.js.) */
(function () {
  'use strict';
  var S = window.IPTSun, I = window.IPT;
  if (!S || !I) return;
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function toMin(t) { var p = String(t || '').split(':'); return +p[0] * 60 + (+p[1] || 0); }
  function esc(x) { return String(x || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* marks shown at a fixed altitude (the 404 sits at night) */
  $$('[data-fixed-alt]').forEach(function (el) { el.setAttribute('data-mark-fixed', ''); I.setMark(el, +el.getAttribute('data-fixed-alt'), new Date()); });

  /* share a report: the networks, the device's own share sheet, the link.
     The link shared is always the report's own address, never a preview hour or an anchor. */
  function canon() { var l = $('link[rel="canonical"]'); return l ? l.href : location.href.split(/[?#]/)[0]; }
  var phoneShare = !!navigator.share && window.matchMedia('(pointer: coarse)').matches;
  function nativeShare() {
    var h = $('h1'), d = $('.art-head .dek');
    return navigator.share({ title: h ? h.textContent : document.title, text: d ? d.textContent : '', url: canon() }).catch(function () {});
  }
  $$('[data-share]').forEach(function (root) {
    function say(text) {
      var m = $('.msg', root); if (!m) return;
      m.textContent = text; clearTimeout(m._t); m._t = setTimeout(function () { m.textContent = ''; }, 4000);
    }
    $$('[data-copy]', root).forEach(function (b) {
      b.addEventListener('click', function () {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(canon()).then(function () { say('Link copied.'); }, function () { say('Copy the address from the bar above.'); });
        else say('Copy the address from the bar above.');
      });
    });
    $$('[data-native]', root).forEach(function (b) {
      if (!phoneShare) return;   // a desktop share sheet adds little to the list above it
      b.hidden = false;
      b.addEventListener('click', nativeShare);
    });
    // a network opens in a small window over the report; mail, and WhatsApp on a phone, go to their apps
    $$('a.sh', root).forEach(function (a) {
      a.addEventListener('click', function (e) {
        var net = a.getAttribute('data-net');
        if (net === 'email' || (net === 'whatsapp' && phoneShare)) return;
        var w = window.open(a.href, 'ipt-share', 'width=620,height=640');
        if (w) { try { w.opener = null; } catch (x) {} e.preventDefault(); }
      });
    });
    var open = $('[data-share-open]', root), pop = open && document.getElementById(open.getAttribute('aria-controls'));
    if (!open || !pop) return;
    function show(v) {
      pop.hidden = !v; open.setAttribute('aria-expanded', String(v));
      if (v) { var f = $('a', pop); if (f) f.focus(); }
    }
    // on a phone, Share is the phone's own sheet; elsewhere it lists the networks
    open.addEventListener('click', function () { if (phoneShare) nativeShare(); else show(pop.hidden); });
    pop.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { show(false); open.focus(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      var items = $$('a, button:not([hidden])', pop), i = items.indexOf(document.activeElement);
      e.preventDefault();
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
    });
    pop.addEventListener('click', function (e) { if (e.target.closest('a, button')) setTimeout(function () { show(false); }, 0); });
    document.addEventListener('click', function (e) { if (!pop.hidden && !pop.contains(e.target) && !open.contains(e.target)) show(false); });
  });

  /* ---------- October in Palestine's sky ---------- */
  var cal = $('[data-skycal]');
  if (cal) {
    var data = {};
    try { data = JSON.parse(($('#days-data') || {}).textContent || '{}'); } catch (e) {}
    var ym = cal.getAttribute('data-skycal').split('-').map(Number), Y = ym[0], Mo = ym[1];
    var days = new Date(Date.UTC(Y, Mo, 0)).getUTCDate();
    var now = S.now();
    var html = '<div class="sk-axis" aria-hidden="true"><span></span><span class="ticks">' +
      [0, 3, 6, 9, 12, 15, 18, 21, 24].map(function (h) { return '<span' + (h % 6 ? ' class="h3"' : '') + ' style="left:' + (h / 24 * 100) + '%' + (h === 0 ? ';transform:none' : h === 24 ? ';transform:translateX(-100%)' : '') + '">' + (h < 10 ? '0' : '') + h + ':00</span>'; }).join('') +
      '</span><span class="sp">Sunrise · sunset</span></div>';
    var prevOff = null;
    for (var d = 1; d <= days; d++) {
      var date = Y + '-' + (Mo < 10 ? '0' : '') + Mo + '-' + (d < 10 ? '0' : '') + d;
      var off = S.offsetAt(S.instant(Y, Mo, d, 720));
      if (prevOff !== null && off !== prevOff) {
        html += '<p class="sk-shift">Clocks in Palestine go ' + (off < prevOff ? 'back' : 'forward') + ' an hour: the day below starts ' + (off < prevOff ? 'later' : 'earlier') + ' on the clock, not in the sky.</p>';
      }
      prevOff = off;
      var stops = [];
      for (var t = 0; t <= 1440; t += 20) { var p = S.position(S.instant(Y, Mo, d, t)); stops.push(S.ok(S.sky(p.alt, p.rising)) + ' ' + (t / 14.4).toFixed(2) + '%'); }
      var ev = S.day(Y, Mo, d);
      var ed = data[date];
      var wd = S.DAYS[S.weekday(Y, Mo, d)].slice(0, 3);
      var inner = '<span class="lab">' + wd + ' ' + d + '</span><span class="bar" style="background:linear-gradient(90deg,' + stops.join(',') + ')">' +
        '<span class="tk" style="left:' + (ev.sunriseJericho / 14.4).toFixed(2) + '%"></span><span class="tk" style="left:' + (ev.sunsetGaza / 14.4).toFixed(2) + '%"></span>';
      if (ed) ed.times.forEach(function (tt) {
        var m = toMin(tt), a = S.position(S.instant(Y, Mo, d, m)).alt;
        inner += '<span class="bd" style="left:' + (m / 14.4).toFixed(2) + '%;background:' + (a > -6 ? S.ok(S.sunColour(a)) : '#E9E8F0') + '"></span>';
      });
      var today = now.y === Y && now.m === Mo && now.d === d;
      if (today) inner += '<span class="now" style="left:' + (now.minutes / 14.4).toFixed(2) + '%"></span>';
      inner += '</span><span class="meta">' + S.hhmm(ev.sunriseJericho) + ' · ' + S.hhmm(ev.sunsetGaza) + '</span>';
      var lab = wd + ' ' + d + ' October: sunrise ' + S.hhmm(ev.sunriseJericho) + ', sunset ' + S.hhmm(ev.sunsetGaza) + (ed ? ', edition with ' + ed.times.length + ' slots' : '') + (today ? ', today' : '');
      html += ed ? '<a class="sk-row has-ed' + (today ? ' is-today' : '') + '" href="' + ed.url + '" aria-label="' + esc(lab) + '">' + inner + '</a>'
                 : '<div class="sk-row' + (today ? ' is-today' : '') + '" role="img" aria-label="' + esc(lab) + '">' + inner + '</div>';
    }
    cal.innerHTML = html;
  }
})();
