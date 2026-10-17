// Draws one 1200 × 630 share card per report into assets/img/card/, from tools/out/cards.json (written by build.py).
// The site must be served (the preview server on 8157): node --experimental-websocket tools/cards.mjs [http://localhost:8157/] [slug…]
// Then run build.py again so each report's og:image points at its card.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [base = 'http://localhost:8157/', ...only] = process.argv.slice(2);
const cards = JSON.parse(readFileSync(join(ROOT, 'tools/out/cards.json'), 'utf8')).filter((c) => !only.length || only.includes(c.slug));
const out = join(ROOT, 'assets/img/card');
mkdirSync(out, { recursive: true });

const port = 9400 + Math.floor(Math.random() * 90);
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ipt-card-'))}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
try {
  let t; for (let k = 0; k < 60; k++) { try { t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((x) => x.type === 'page'); if (t) break; } catch {} await sleep(150); }
  ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: base + 'tools/card.html' });
  await sleep(1500);
  let total = 0;
  for (const c of cards) {
    const r = await send('Runtime.evaluate', { expression: `draw(${JSON.stringify(c)})`, awaitPromise: true, returnByValue: true });
    await sleep(60);
    const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 } });
    const buf = Buffer.from(shot.data, 'base64');
    writeFileSync(join(out, c.slug + '.jpg'), buf);
    total += buf.length;
    if (r.result.value < 40) console.log('small headline', c.slug, r.result.value);
  }
  console.log('cards', cards.length, '·', Math.round(total / 1024), 'KB');
} finally { try { ws.close(); } catch {} proc.kill(); }
