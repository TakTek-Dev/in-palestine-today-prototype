// Draws the identity's fixed images from tools/stills.html: app icons, the social media kit and the newsletter's art.
// The site must be served (the preview server on 8157): node --experimental-websocket tools/stills.mjs [http://localhost:8157/]
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [base = 'http://localhost:8157/'] = process.argv.slice(2);

// the latest edition's lead and slot times, read from the built homepage
const home = readFileSync(join(ROOT, 'home.html'), 'utf8');
const times = [...new Set([...home.matchAll(/<a href="#s\d+" data-t="(\d\d:\d\d)"/g)].map((m) => m[1]))];
const lead = { date: '2026-10-14', time: '09:00', photo: '../assets/img/photo/ph03-1280.webp', headline: 'Settlers set fire to a mosque in Mukhmas after midnight, governorate says' };

const SHADOW = '../assets/brand/monogram-shadow.svg', NIGHT = '../assets/brand/monogram-night.svg', STONE = '../assets/brand/monogram-stone.svg';
const JOBS = [
  // app and browser icons
  ['assets/icons/apple-touch-icon.png', { kind: 'svg', w: 180, h: 180, src: SHADOW }],
  ['assets/icons/icon-192.png', { kind: 'svg', w: 192, h: 192, src: SHADOW }],
  ['assets/icons/icon-512.png', { kind: 'svg', w: 512, h: 512, src: SHADOW }],
  ['assets/icons/icon-maskable-512.png', { kind: 'svg', w: 512, h: 512, src: SHADOW, scale: .74, bg: '#15182A' }],
  ['assets/icons/favicon-32.png', { kind: 'svg', w: 32, h: 32, src: SHADOW }],
  // the social kit
  ['assets/kit/avatar-shadow-800.png', { kind: 'svg', w: 800, h: 800, src: SHADOW }],
  ['assets/kit/avatar-night-800.png', { kind: 'svg', w: 800, h: 800, src: NIGHT }],
  ['assets/kit/avatar-stone-800.png', { kind: 'svg', w: 800, h: 800, src: STONE }],
  ['assets/kit/x-header-1500x500.png', { kind: 'banner', w: 1500, h: 500, fs: 92, cx: 50, cy: 80, hz: .58, line: 'One day in Palestine, in Palestine’s time' }],
  ['assets/kit/facebook-cover-1640x624.png', { kind: 'banner', w: 1640, h: 624, fs: 104, cx: 50, cy: 80, hz: .58, line: 'One day in Palestine, in Palestine’s time' }],
  ['assets/kit/youtube-banner-2560x1440.png', { kind: 'banner', w: 2560, h: 1440, fs: 150, cx: 50, cy: 58, hz: .5, line: 'One day in Palestine, in Palestine’s time' }],
  ['assets/kit/linkedin-cover-1128x191.png', { kind: 'banner', w: 1128, h: 191, fs: 60, cx: 50, cy: 50, hz: .86, nopath: true }],
  ['assets/kit/instagram-post-1080x1350.png', { kind: 'news', w: 1080, h: 1350, photoH: 620, hfs: 80, ...lead }],
  ['assets/kit/instagram-story-1080x1920.png', { kind: 'news', w: 1080, h: 1920, photoH: 860, hfs: 92, ...lead, dek: 'They also burned a car and an olive tree. It is one of 23 arson attacks or attempts on West Bank mosques counted since January 2023 by the Colonization and Wall Resistance Commission.' }],
  // the newsletter's art (drawn at twice the size it is shown)
  ['email/img/wordmark-shadow.png', { kind: 'svg', w: 560, h: 96, src: '../assets/brand/wordmark-shadow.svg', ratio: 1307 / 7656, transparent: true }],
  ['email/img/wordmark-moonlight.png', { kind: 'svg', w: 560, h: 96, src: '../assets/brand/wordmark-moonlight.svg', ratio: 1307 / 7656, transparent: true }],
  ['email/img/sky-2026-10-14.png', { kind: 'strip', w: 1120, h: 40, times }],
  ['email/img/lead-2026-10-14.jpg', { kind: 'photo', w: 1040, h: 600, src: lead.photo, jpeg: true }],
];

const port = 9300 + Math.floor(Math.random() * 90);
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ipt-still-'))}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
try {
  let t; for (let k = 0; k < 60; k++) { try { t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((x) => x.type === 'page'); if (t) break; } catch {} await sleep(150); }
  ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 2600, height: 2000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: base + 'tools/stills.html' });
  await sleep(1500);
  for (const [out, o] of JOBS) {
    await send('Emulation.setDefaultBackgroundColorOverride', o.transparent ? { color: { r: 0, g: 0, b: 0, a: 0 } } : {});
    const r = await send('Runtime.evaluate', { expression: `still(${JSON.stringify(o)})`, awaitPromise: true });
    if (r.exceptionDetails) { console.log('FAILED', out, JSON.stringify(r.exceptionDetails).slice(0, 300)); continue; }
    await sleep(80);
    const shot = await send('Page.captureScreenshot', { format: o.jpeg ? 'jpeg' : 'png', ...(o.jpeg ? { quality: 82 } : {}), clip: { x: 0, y: 0, width: o.w, height: o.h, scale: 1 } });
    mkdirSync(join(ROOT, dirname(out)), { recursive: true });
    writeFileSync(join(ROOT, out), Buffer.from(shot.data, 'base64'));
  }
  console.log('stills', JOBS.length, '· slot times', times.length);
} finally { try { ws.close(); } catch {} proc.kill(); }
