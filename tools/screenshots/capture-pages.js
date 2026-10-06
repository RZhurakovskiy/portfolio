// Снимает страницы любого сайта по списку: первый экран и вся страница на ПК, планшете и телефоне.
// Chrome запускается отдельно и невидимо.
//
//   node capture-pages.js <spec.json> <папка_png>
//
// spec.json: { "base": "http://localhost:3100", "pages": [
//   { "key": "uvolnenie", "path": "/page?x=1", "click": ["Показать расчёт по шагам"], "focus": "Итого на руки" } ] }
//   click: тексты кнопок, которые нужно нажать перед съёмкой (нажимается первая с таким текстом);
//   focus: текст элемента, к которому прокручиваем для дополнительного снимка «деталь» (viewport-кадр).
// Плашка dev-режима Next (кружок «N») скрывается стилем, чтобы не попасть в кадр.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const [specPath, outDir] = process.argv.slice(2);
if (!specPath || !outDir) {
  console.error('использование: node capture-pages.js <spec.json> <папка_png>');
  process.exit(1);
}
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9341;
const DEVICES = [
  { name: 'desktop', width: 1440, height: 900, dpr: 1, mobile: false },
  { name: 'tablet', width: 820, height: 1180, dpr: 1, mobile: true },
  { name: 'mobile', width: 390, height: 844, dpr: 2, mobile: true },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-'));
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`, `--user-data-dir=${ud}`, 'about:blank'], { stdio: 'ignore' });
  try {
    let wsUrl;
    for (let i = 0; i < 40 && !wsUrl; i++) {
      await sleep(250);
      try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {}
    }
    const ws = new WebSocket(wsUrl);
    await new Promise((r) => (ws.onopen = r));
    let id = 0;
    const pending = new Map();
    ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result); } };
    const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result.value;
    await send('Page.enable');

    for (const page of spec.pages) {
      for (const d of DEVICES) {
        await send('Emulation.setDeviceMetricsOverride', { width: d.width, height: d.height, deviceScaleFactor: d.dpr, mobile: d.mobile });
        await send('Page.navigate', { url: spec.base + page.path });
        await sleep(page.wait || 6000);
        await ev("(() => { const s = document.createElement('style'); s.textContent = 'nextjs-portal{display:none !important}'; document.head.appendChild(s); return 1; })()");
        for (const text of page.click || []) {
          const res = await ev(`(() => { const b = [...document.querySelectorAll('button,summary,a')].find(x => x.textContent.trim().includes(${JSON.stringify(text)})); if (!b) return 'нет'; b.click(); return 'ok'; })()`);
          if (res !== 'ok') console.log(`  ${page.key}/${d.name}: кнопка «${text}» не найдена`);
          await sleep(700);
        }
        const total = await ev('document.documentElement.scrollHeight');
        for (let y = 0; y < total; y += Math.round(d.height * 0.6)) { await ev(`window.scrollTo({top:${y},behavior:'instant'}); 1`); await sleep(250); }
        await ev("window.scrollTo({top:0,behavior:'instant'}); 1");
        await sleep(900);
        const height = await ev('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)');
        const first = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(outDir, `${page.key}-${d.name}-first.png`), Buffer.from(first.data, 'base64'));
        const full = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: d.width, height, scale: 1 } });
        fs.writeFileSync(path.join(outDir, `${page.key}-${d.name}-full.png`), Buffer.from(full.data, 'base64'));
        if (page.focus) {
          const found = await ev(`(() => { const el = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.includes(${JSON.stringify(page.focus)})).pop(); if (!el) return false; window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - ${Math.round(d.height * 0.55)}, behavior: 'instant' }); return true; })()`);
          await sleep(900);
          if (found) {
            const detail = await send('Page.captureScreenshot', { format: 'png' });
            fs.writeFileSync(path.join(outDir, `${page.key}-${d.name}-detail.png`), Buffer.from(detail.data, 'base64'));
          } else console.log(`  ${page.key}/${d.name}: элемент «${page.focus}» не найден`);
        }
        console.log(`${page.key} ${d.name}: высота ${height}`);
      }
    }
    ws.close();
  } finally { chrome.kill(); }
})().catch((e) => { console.error('ОШИБКА', e.message); process.exit(1); });
