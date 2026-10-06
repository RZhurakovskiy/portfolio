// Снимает страницу целиком при неизменном окне и сохраняет координаты заголовков в JSON.
// Секции потом вырезает crop-sections.py: раскладка не меняется между измерением и снимком.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const OUT = process.argv[2];
const DEVICES = [
  { name: 'desktop', width: 1440, height: 900, dpr: 1, mobile: false },
  { name: 'tablet', width: 820, height: 1180, dpr: 1, mobile: true },
  { name: 'mobile', width: 390, height: 844, dpr: 2, mobile: true },
];
const PORT = 9335;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'cs3-'));
  const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`, `--user-data-dir=${ud}`, 'about:blank'], { stdio: 'ignore' });
  try {
    let wsUrl;
    for (let i = 0; i < 40 && !wsUrl; i++) {
      await sleep(250);
      try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {}
    }
    const ws = new WebSocket(wsUrl);
    await new Promise((r) => (ws.onopen = r));
    let id = 0; const pending = new Map();
    ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result); } };
    const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result.value;
    await send('Page.enable');

    for (const d of DEVICES) {
      await send('Emulation.setDeviceMetricsOverride', { width: d.width, height: d.height, deviceScaleFactor: d.dpr, mobile: d.mobile });
      await send('Page.navigate', { url: 'https://hr-automotive.aigrus.ru/' });
      for (let i = 0; i < 30; i++) { await sleep(500); if (await ev("!!document.getElementById('contacts')")) break; }
      for (let i = 0; i < 30; i++) { await sleep(500); if (await ev("(() => { const p = document.getElementById('preloader'); if (!p) return true; const s = getComputedStyle(p); return s.opacity === '0' || s.display === 'none' || s.visibility === 'hidden' || p.getBoundingClientRect().height === 0; })()")) break; }
      await sleep(1500);
      await ev("[...document.querySelectorAll('button,a,div,span')].filter(e => e.children.length === 0 && e.textContent.trim() === 'Применить').forEach(e => e.click()); 1");
      const total = await ev('document.documentElement.scrollHeight');
      for (let y = 0; y < total; y += Math.round(d.height * 0.6)) { await ev(`window.scrollTo(0, ${y}); 1`); await sleep(350); }
      await ev('window.scrollTo(0, document.documentElement.scrollHeight); 1'); await sleep(1500);
      await ev('window.scrollTo(0, 0); 1'); await sleep(1200);

      const heads = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('h1,h2,h3,h4,p,div,span')].filter(e => !e.closest('nav, .main-nav-list, .menu-overlay, .nav-bar, #cookieConsent, #preloader') && e.children.length === 0 && e.getBoundingClientRect().height > 0).map(e => ({ t: e.textContent.replace(/\\s+/g, ' ').trim().slice(0, 60), y: Math.round(e.getBoundingClientRect().top + scrollY) })).filter(h => h.t))`));
      const height = await ev('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)');
      const full = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: d.width, height, scale: 1 } });
      fs.writeFileSync(path.join(OUT, `site-${d.name}-fullpage.png`), Buffer.from(full.data, 'base64'));
      fs.writeFileSync(path.join(OUT, `site-${d.name}-heads.json`), JSON.stringify({ height, dpr: d.dpr, heads }, null, 1));
      console.log(`${d.name}: высота ${height}, заголовков ${heads.length}`);
    }
    ws.close();
  } finally { chrome.kill(); }
})().catch((e) => { console.error('ОШИБКА', e.message); process.exit(1); });
