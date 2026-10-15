// Full-resolution screenshots through Chrome DevTools Protocol.
// node --experimental-websocket tools/shot.mjs <url> <out.png> [width] [height] [full|view|segments] [light|dark]
// The loader is marked as already seen so the capture shows the settled page; ?at=HH:MM previews an hour.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, out, w = '1440', h = '900', mode = 'full', scheme = 'light'] = process.argv.slice(2);
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9300 + Math.floor(Math.random() * 400);
const prof = mkdtempSync(join(tmpdir(), 'ipt-shot-'));
const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws, id = 0; const pending = new Map();
function send(method, params = {}) {
  return new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
}
try {
  let target;
  for (let k = 0; k < 50; k++) {
    try { const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); target = list.find((t) => t.type === 'page'); if (target) break; } catch {}
    await sleep(150);
  }
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } });
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 768 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{sessionStorage.setItem('ipt-loader','1')}catch(e){}" });
  await send('Page.navigate', { url });
  await sleep(2200);
  await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(()=>1)', awaitPromise: true });
  await sleep(300);
  // walk the page once so lazy images load and observers fire
  const total = JSON.parse((await send('Runtime.evaluate', { expression: 'JSON.stringify(document.documentElement.scrollHeight)', returnByValue: true })).result.value);
  for (let y = 0; y < total; y += +h * 0.8) { await send('Runtime.evaluate', { expression: `window.scrollTo(0,${y})` }); await sleep(120); }
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0,0)' }); await sleep(500);
  if (mode === 'segments') {
    // one capture per viewport, as a reader scrolls (sticky bars included)
    const H = JSON.parse((await send('Runtime.evaluate', { expression: 'JSON.stringify(document.documentElement.scrollHeight)', returnByValue: true })).result.value);
    let i = 0;
    for (let y = 0; y < H; y += +h) {
      await send('Runtime.evaluate', { expression: `window.scrollTo(0,${y})` }); await sleep(700);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(out.replace(/\.png$/, `-${String(i).padStart(2, '0')}.png`), Buffer.from(shot.data, 'base64'));
      i++;
    }
    console.log(out, 'segments', i);
  } else {
    let clip;
    if (mode === 'full') {
      const r = await send('Runtime.evaluate', { expression: 'JSON.stringify([document.documentElement.scrollWidth, document.documentElement.scrollHeight])', returnByValue: true });
      const [sw, sh] = JSON.parse(r.result.value);
      clip = { x: 0, y: 0, width: sw, height: Math.min(sh, 16000), scale: 1 };
    }
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: mode === 'full', ...(clip ? { clip } : {}) });
    writeFileSync(out, Buffer.from(shot.data, 'base64'));
  }
  const ov = await send('Runtime.evaluate', { expression: 'JSON.stringify({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,h:document.documentElement.scrollHeight})', returnByValue: true });
  console.log(out, ov.result.value);
} finally {
  try { ws && ws.close(); } catch {}
  proc.kill();
}
