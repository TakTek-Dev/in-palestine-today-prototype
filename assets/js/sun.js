/* In Palestine Today — the sun over Palestine.
 *
 * Everything that moves on the site moves from this file: the Palestine clock (IANA Asia/Hebron),
 * the sun's position over Jerusalem (NOAA solar-position equations, about a minute of accuracy),
 * the day's events (first light, sunrise over Jericho, solar noon, sunset over Gaza, night),
 * the moon's phase, and the light model that turns the sun's altitude into the page's colours.
 *
 * window.IPTSun is the single source of truth: one time in, one set of lights out.
 */
(function () {
  'use strict';

  var RAD = Math.PI / 180, DEG = 180 / Math.PI;
  var PLACES = {
    jerusalem: { name: 'Jerusalem', lat: 31.7767, lon: 35.2345 },
    jericho: { name: 'Jericho', lat: 31.8611, lon: 35.4600 },
    gaza: { name: 'Gaza', lat: 31.5017, lon: 34.4668 }
  };
  var TZ = 'Asia/Hebron';

  /* ---------- clock ---------- */

  var tzOk = (function () {
    try { new Intl.DateTimeFormat('en-GB', { timeZone: TZ }).format(new Date()); return TZ; }
    catch (e) { try { new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem' }).format(new Date()); return 'Asia/Jerusalem'; } catch (e2) { return null; } }
  })();

  // Palestine's UTC offset in minutes for a given instant. The offset only changes on the hour,
  // twice a year, so it is kept per UTC hour: a page asks for thousands of instants as it paints.
  var OFFSETS = {};
  function offsetAt(date) {
    if (!tzOk) return 180;
    var hour = Math.floor(date.getTime() / 3600000);
    if (OFFSETS[hour] != null) return OFFSETS[hour];
    var p = parts(new Date(hour * 3600000));
    var asUTC = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss);
    return (OFFSETS[hour] = Math.round((asUTC - hour * 3600000) / 60000));
  }

  // Calendar parts of an instant in Palestine time.
  var FMT = null;   // building an Intl formatter is slow: build it once
  function parts(date) {
    if (!tzOk) {
      var t = new Date(date.getTime() + 180 * 60000);
      return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), hh: t.getUTCHours(), mm: t.getUTCMinutes(), ss: t.getUTCSeconds(), wd: t.getUTCDay() };
    }
    var f = FMT || (FMT = new Intl.DateTimeFormat('en-GB', { timeZone: tzOk, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23', weekday: 'short' }));
    var o = {};
    f.formatToParts(date).forEach(function (x) { o[x.type] = x.value; });
    var wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday);
    return { y: +o.year, m: +o.month, d: +o.day, hh: +o.hour % 24, mm: +o.minute, ss: +o.second, wd: wd };
  }

  // The instant at hh:mm Palestine time on a Palestine calendar date (y, m, d).
  function instant(y, m, d, minutes) {
    var guess = Date.UTC(y, m - 1, d, 0, 0) + (minutes - 180) * 60000;
    var off = offsetAt(new Date(guess));
    return new Date(Date.UTC(y, m - 1, d, 0, 0) + (minutes - off) * 60000);
  }

  /* ---------- sun ---------- */

  function julian(date) { return date.getTime() / 86400000 + 2440587.5; }

  function solar(date) {
    var jc = (julian(date) - 2451545) / 36525;
    var l0 = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360;
    var m = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
    var e = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);
    var c = Math.sin(m * RAD) * (1.914602 - jc * (0.004817 + 0.000014 * jc)) + Math.sin(2 * m * RAD) * (0.019993 - 0.000101 * jc) + Math.sin(3 * m * RAD) * 0.000289;
    var omega = 125.04 - 1934.136 * jc;
    var lambda = l0 + c - 0.00569 - 0.00478 * Math.sin(omega * RAD);
    var eps0 = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60;
    var eps = eps0 + 0.00256 * Math.cos(omega * RAD);
    var dec = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD)) * DEG;
    var y = Math.pow(Math.tan(eps * RAD / 2), 2);
    var eot = 4 * DEG * (y * Math.sin(2 * l0 * RAD) - 2 * e * Math.sin(m * RAD) + 4 * e * y * Math.sin(m * RAD) * Math.cos(2 * l0 * RAD) - 0.5 * y * y * Math.sin(4 * l0 * RAD) - 1.25 * e * e * Math.sin(2 * m * RAD));
    return { dec: dec, eot: eot };
  }

  // Altitude (degrees, refraction-corrected) and azimuth of the sun at an instant over a place.
  function position(date, place) {
    place = place || PLACES.jerusalem;
    var s = solar(date);
    var utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
    var tst = ((utcMin + s.eot + 4 * place.lon) % 1440 + 1440) % 1440;
    var ha = tst / 4 - 180;
    var cosZ = Math.sin(place.lat * RAD) * Math.sin(s.dec * RAD) + Math.cos(place.lat * RAD) * Math.cos(s.dec * RAD) * Math.cos(ha * RAD);
    var zen = Math.acos(Math.max(-1, Math.min(1, cosZ))) * DEG;
    var alt = 90 - zen;
    var r = 0;
    if (alt > 85) r = 0;
    else if (alt > 5) r = 58.1 / Math.tan(alt * RAD) - 0.07 / Math.pow(Math.tan(alt * RAD), 3) + 0.000086 / Math.pow(Math.tan(alt * RAD), 5);
    else if (alt > -0.575) r = 1735 + alt * (-518.2 + alt * (103.4 + alt * (-12.79 + alt * 0.711)));
    else r = -20.772 / Math.tan(alt * RAD);
    alt += r / 3600;
    var az = Math.atan2(Math.sin(ha * RAD), Math.cos(ha * RAD) * Math.sin(place.lat * RAD) - Math.tan(s.dec * RAD) * Math.cos(place.lat * RAD)) * DEG + 180;
    return { alt: alt, az: az % 360, rising: ha < 0 };
  }

  // Minutes after Palestine midnight when the sun's centre crosses a given zenith, refined twice.
  function crossing(y, m, d, place, zenith, morning) {
    var t = morning ? 360 : 1080;
    for (var i = 0; i < 3; i++) {
      var at = instant(y, m, d, t);
      var s = solar(at);
      var cosH = (Math.cos(zenith * RAD) / (Math.cos(place.lat * RAD) * Math.cos(s.dec * RAD))) - Math.tan(place.lat * RAD) * Math.tan(s.dec * RAD);
      if (cosH > 1 || cosH < -1) return null;
      var h = Math.acos(cosH) * DEG;
      var noonUTC = 720 - 4 * place.lon - s.eot;
      var utc = morning ? noonUTC - 4 * h : noonUTC + 4 * h;
      t = utc + offsetAt(at);
    }
    return t;
  }

  var dayCache = {};
  // The day's sun over Palestine, in minutes after Palestine midnight.
  function day(y, m, d) {
    var key = y + '-' + m + '-' + d;
    if (dayCache[key]) return dayCache[key];
    var J = PLACES.jerusalem;
    var s = solar(instant(y, m, d, 720));
    var noon = 720 - 4 * J.lon - s.eot + offsetAt(instant(y, m, d, 720));
    var ev = {
      astroDawn: crossing(y, m, d, J, 108, true),
      nauticalDawn: crossing(y, m, d, J, 102, true),
      firstLight: crossing(y, m, d, J, 96, true),
      sunrise: crossing(y, m, d, J, 90.833, true),
      sunriseJericho: crossing(y, m, d, PLACES.jericho, 90.833, true),
      noon: noon,
      noonAlt: position(instant(y, m, d, noon)).alt,
      sunset: crossing(y, m, d, J, 90.833, false),
      sunsetGaza: crossing(y, m, d, PLACES.gaza, 90.833, false),
      lastLight: crossing(y, m, d, J, 96, false),
      nauticalDusk: crossing(y, m, d, J, 102, false),
      astroDusk: crossing(y, m, d, J, 108, false)
    };
    ev.length = ev.sunset - ev.sunrise;
    dayCache[key] = ev;
    return ev;
  }

  /* ---------- moon (phase only) ---------- */

  function moon(date) {
    var syn = 29.530588853;
    var age = ((julian(date) - 2451550.1) / syn) % 1;
    if (age < 0) age += 1;
    return { age: age * syn, phase: age, lit: (1 - Math.cos(2 * Math.PI * age)) / 2, waxing: age < 0.5 };
  }

  /* ---------- light ---------- */
  // Each light is a place on the day: a ground for reading in daylight and one for reading in the dark,
  // in OKLCH so hue moves without lightness drifting. L C H.
  var LIGHTS = {
    night:      { name: 'Night',       day: [0.955, 0.010, 268], dark: [0.165, 0.032, 272] },
    dawn:       { name: 'Dawn',        day: [0.952, 0.014, 290], dark: [0.195, 0.050, 280] },
    firstLight: { name: 'First light', day: [0.950, 0.018, 300], dark: [0.220, 0.060, 284] },
    sunrise:    { name: 'Sunrise',     day: [0.952, 0.017, 30],  dark: [0.225, 0.042, 335] },
    morning:    { name: 'Morning',     day: [0.966, 0.010, 92],  dark: [0.195, 0.026, 262] },
    midday:     { name: 'Midday',      day: [0.976, 0.008, 98], dark: [0.185, 0.018, 255] },
    afternoon:  { name: 'Afternoon',   day: [0.955, 0.034, 80],  dark: [0.200, 0.026, 62] },
    golden:     { name: 'Golden hour', day: [0.950, 0.027, 66],  dark: [0.210, 0.036, 44] },
    sunset:     { name: 'Sunset',      day: [0.948, 0.021, 34],  dark: [0.220, 0.046, 18] },
    dusk:       { name: 'Blue hour',   day: [0.948, 0.020, 292], dark: [0.215, 0.068, 288] }
  };

  // Keyframes of the day's light, pinned to its real events.
  function track(ev) {
    var k = [
      [0, 'night'],
      [ev.astroDawn, 'night'],
      [ev.nauticalDawn, 'dawn'],
      [ev.firstLight, 'firstLight'],
      [ev.sunrise - 6, 'sunrise'],
      [ev.sunrise + 40, 'morning'],
      [ev.noon - 100, 'midday'],
      [ev.noon + 100, 'midday'],
      [ev.sunset - 110, 'afternoon'],
      [ev.sunset - 45, 'golden'],
      [ev.sunset + 2, 'sunset'],
      [ev.lastLight + 6, 'dusk'],
      [ev.nauticalDusk + 10, 'night'],
      [1440, 'night']
    ];
    return k.filter(function (x) { return x[0] != null; });
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpHue(a, b, t) { var d = ((b - a + 540) % 360) - 180; return (a + d * t + 360) % 360; }
  function mix(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerpHue(a[2], b[2], t)]; }
  function ok(c, alpha) { return 'oklch(' + c[0].toFixed(3) + ' ' + c[1].toFixed(3) + ' ' + c[2].toFixed(1) + (alpha != null ? ' / ' + alpha : '') + ')'; }
  function smooth(t) { return t * t * (3 - 2 * t); }

  // The sun's own colour: red at the horizon, gold when high.
  var SUNCOL = [[-6, [0.560, 0.190, 30]], [0, [0.620, 0.205, 36]], [6, [0.665, 0.200, 44]], [15, [0.715, 0.185, 56]], [30, [0.760, 0.170, 66]], [60, [0.785, 0.165, 74]]];
  function sunColour(alt) {
    if (alt <= SUNCOL[0][0]) return SUNCOL[0][1];
    for (var i = 1; i < SUNCOL.length; i++) {
      if (alt <= SUNCOL[i][0]) { var a = SUNCOL[i - 1], b = SUNCOL[i]; return mix(a[1], b[1], (alt - a[0]) / (b[0] - a[0])); }
    }
    return SUNCOL[SUNCOL.length - 1][1];
  }

  // The sky itself, for the Day Dial: physical colour, not reading ground.
  var SKY = [[-18, [0.155, 0.040, 270]], [-12, [0.205, 0.070, 272]], [-8, [0.270, 0.090, 285]], [-4, [0.380, 0.100, 305]], [-1.5, [0.560, 0.120, 15]], [0.5, [0.700, 0.150, 42]], [4, [0.820, 0.090, 62]], [10, [0.880, 0.045, 225]], [25, [0.850, 0.060, 232]], [60, [0.820, 0.075, 236]]];
  function sky(alt, rising) {
    var tbl = SKY;
    if (alt <= tbl[0][0]) return tbl[0][1];
    for (var i = 1; i < tbl.length; i++) {
      if (alt <= tbl[i][0]) {
        var a = tbl[i - 1], b = tbl[i], c = mix(a[1], b[1], (alt - a[0]) / (b[0] - a[0]));
        if (!rising && alt > -2 && alt < 18) c = mix(c, [c[0] - 0.02, c[1] + 0.03, 52], 0.35 * (1 - Math.abs(alt - 6) / 12)); // evenings are warmer than mornings
        return c;
      }
    }
    return tbl[tbl.length - 1][1];
  }

  /* light(y, m, d, minutes, mode) → the full set of tokens for that moment.
     mode: 'follow' (Palestine's sky decides), 'day' or 'dark' (the reader fixed it). */
  function light(y, m, d, minutes, mode) {
    var ev = day(y, m, d);
    var at = instant(y, m, d, minutes);
    var pos = position(at);
    var k = track(ev), i = 1;
    while (i < k.length - 1 && minutes > k[i][0]) i++;
    var A = k[i - 1], B = k[i];
    var t = B[0] === A[0] ? 0 : smooth(Math.max(0, Math.min(1, (minutes - A[0]) / (B[0] - A[0]))));
    var key = t < 0.5 ? A[1] : B[1];
    var dark = mode === 'dark' ? true : mode === 'day' ? false : pos.alt < -4;
    var g = mix(LIGHTS[A[1]][dark ? 'dark' : 'day'], LIGHTS[B[1]][dark ? 'dark' : 'day'], t);
    var tokens;
    if (dark) {
      tokens = {
        ground: ok(g), ground2: ok([g[0] + 0.035, g[1] + 0.006, g[2]]), sink: ok([g[0] - 0.04, g[1], g[2]]),
        ink: ok([0.950, 0.010, g[2]]), ink2: ok([0.790, 0.030, g[2]]), rule: ok([g[0] + 0.14, g[1] + 0.01, g[2]]), rule2: ok([g[0] + 0.08, g[1] + 0.008, g[2]])
      };
    } else {
      tokens = {
        ground: ok(g), ground2: ok([g[0] - 0.028, g[1] + 0.006, g[2]]), sink: ok([g[0] - 0.06, g[1] + 0.008, g[2]]),
        ink: ok([0.215, 0.035, 275]), ink2: ok([0.445, 0.035, 275]), rule: ok([g[0] - 0.17, g[1] + 0.012, g[2]]), rule2: ok([g[0] - 0.09, g[1] + 0.008, g[2]])
      };
    }
    tokens.sun = ok(sunColour(pos.alt));
    tokens.sunGlow = ok(sunColour(pos.alt), 0.22);
    return { minutes: minutes, alt: pos.alt, az: pos.az, rising: pos.rising, key: key, name: LIGHTS[key].name, dark: dark, tokens: tokens, events: ev, ground: g };
  }

  function applyTokens(el, tokens) {
    var s = el.style;
    s.setProperty('--ground', tokens.ground);
    s.setProperty('--ground-2', tokens.ground2);
    s.setProperty('--sink', tokens.sink);
    s.setProperty('--ink', tokens.ink);
    s.setProperty('--ink-2', tokens.ink2);
    s.setProperty('--rule', tokens.rule);
    s.setProperty('--rule-2', tokens.rule2);
    s.setProperty('--sun', tokens.sun);
    s.setProperty('--sun-glow', tokens.sunGlow);
  }

  /* ---------- formatting ---------- */

  function hhmm(min) {
    if (min == null) return '—';
    min = Math.round(((min % 1440) + 1440) % 1440);
    var h = Math.floor(min / 60), m = min % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  function span(min) {
    min = Math.round(min);
    var h = Math.floor(min / 60), m = min % 60;
    return (h ? h + ' h ' : '') + m + ' min';
  }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function longDate(p) { return DAYS[p.wd] + ' ' + p.d + ' ' + MONTHS[p.m - 1] + ' ' + p.y; }
  function weekday(y, m, d) { return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }

  window.IPTSun = {
    TZ: tzOk || 'UTC+3',
    PLACES: PLACES,
    LIGHTS: LIGHTS,
    parts: parts,
    instant: instant,
    offsetAt: offsetAt,
    position: position,
    day: day,
    moon: moon,
    light: light,
    sky: sky,
    sunColour: sunColour,
    applyTokens: applyTokens,
    ok: ok,
    hhmm: hhmm,
    span: span,
    longDate: longDate,
    weekday: weekday,
    MONTHS: MONTHS,
    DAYS: DAYS,
    now: function () { var d = new Date(); var p = parts(d); p.minutes = p.hh * 60 + p.mm + p.ss / 60; p.date = d; return p; }
  };
})();
