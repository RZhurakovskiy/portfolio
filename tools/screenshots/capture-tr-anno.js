// Кейс ТочныйРасчёт, блок «Каждая цифра с объяснением»: крупный снимок разбора по шагам (2x) и
// координаты меток. Проект должен быть запущен локально: npx next dev -p 3100 (в папке tochniy-raschet).
//
//   node capture-tr-anno.js <папка_png>
//
// Сохраняет <папка>/uvolnenie-steps.png и печатает координаты меток в процентах от снимка:
// их нужно перенести в style="--x;--y" кнопок .tr-pin в tochniy-raschet.html.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const out = process.argv[2];
if (!out) { console.error('использование: node capture-tr-anno.js <папка_png>'); process.exit(1); }
const BASE = process.env.TR_BASE || 'http://localhost:3100';
const PAGE = '/vyplaty-pri-sokraschenii?reason=sokraschenie&hireDate=2023-01-15&terminationDate=2026-08-27&monthlySalary=80000&usedDays=0&month2Paid=1';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9345;
const PAD = 24;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'tra-'));
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
    const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };

    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
    await send('Page.navigate', { url: BASE + '/' });
    await sleep(4000);
    await ev(`localStorage.setItem('theme', 'dark'); 1`);
    await send('Page.navigate', { url: BASE + PAGE });
    await sleep(9000);
    await ev("(() => { const s = document.createElement('style'); s.textContent = 'nextjs-portal{display:none !important}'; document.head.appendChild(s); return 1; })()");
    // Разбор спрятан в <details>: раскрываем его так же, как это сделал бы посетитель.
    await ev(`(() => { const d = [...document.querySelectorAll('details')].find((x) => x.querySelector('summary')?.textContent.includes('Показать расчёт по шагам')); d.open = true; return 1; })()`);
    await sleep(1200);

    const geo = await ev(`(() => {
      // В числах сайта неразрывные пробелы: сравниваем текст с обычными.
      const norm = (s) => s.replace(/\\s+/g, ' ');
      const leaf = (t) => [...document.querySelectorAll('body *')].find((el) => el.children.length === 0 && norm(el.textContent).includes(t));
      const rect = (r) => ({ x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height });
      const box = (el) => (el ? rect(el.getBoundingClientRect()) : null);
      // Границы самого текста, а не блока: блок бывает шире строки.
      const text = (el) => { if (!el) return null; const range = document.createRange(); range.selectNodeContents(el); return rect(range.getBoundingClientRect()); };
      const details = [...document.querySelectorAll('details')].find((x) => x.querySelector('summary')?.textContent.includes('Показать расчёт по шагам'));
      const steps = details.querySelector('ol');
      // Формула шага «НДФЛ 13%» (её же цитирует подпись к метке) и статья у первого шага:
      // так метки 2 и 3 не слипаются.
      const tax = [...steps.children].find((li) => li.textContent.includes('НДФЛ 13%'));
      const formula = tax && tax.querySelector('.min-w-0')?.lastElementChild;
      const law = steps.querySelector('a');
      const share = leaf('Скопировать ссылку на этот расчёт');
      const hist = leaf('История расчётов');
      const histCard = hist && (hist.closest('.rounded-xl') || hist.parentElement.parentElement);
      return {
        steps: box(steps),
        badge1: box(steps.children[0]?.firstElementChild),
        badge2: box(steps.children[1]?.firstElementChild),
        // Метка 2 встаёт правее и формулы, и строки заголовка над ней со ссылкой на статью.
        formula: (() => { const f = text(formula); const t = text(tax?.querySelector('.min-w-0')?.firstElementChild); return f && t ? { ...f, w: Math.max(f.x + f.w, t.x + t.w) - f.x } : f; })(),
        law: text(law),
        shareLast: text(share?.parentElement.lastElementChild),
        hist: text(hist),
        histCard: box(histCard),
      };
    })()`);

    const missing = Object.keys(geo).filter((k) => !geo[k]);
    if (missing.length) throw new Error('не найдено на странице: ' + missing.join(', '));
    const clip = {
      x: Math.floor(geo.steps.x - PAD),
      // Сверху отступ меньше: над списком строка «Показать расчёт по шагам», её не режем пополам.
      y: Math.floor(geo.steps.y - 10),
      width: Math.ceil(geo.steps.w + PAD * 2),
      height: Math.ceil(geo.histCard.y + geo.histCard.h + PAD - (geo.steps.y - 10)),
    };
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 }, captureBeyondViewport: true });
    fs.writeFileSync(path.join(out, 'uvolnenie-steps.png'), Buffer.from(shot.data, 'base64'));

    // Метки ставятся справа от текста, чтобы его не закрывать; первая на линии между шагами 1 и 2.
    const pct = (px, py) => ({ x: (((px - clip.x) / clip.width) * 100).toFixed(1) + '%', y: (((py - clip.y) / clip.height) * 100).toFixed(1) + '%' });
    const right = (b, gap = 36) => pct(b.x + b.w + gap, b.y + b.h / 2);
    const pins = {
      1: pct(geo.badge1.x + geo.badge1.w / 2, (geo.badge1.y + geo.badge1.h + geo.badge2.y) / 2),
      2: right(geo.formula),
      3: right(geo.law),
      4: right(geo.shareLast),
      5: right(geo.hist),
    };
    console.log('снимок', clip.width * 2, 'x', clip.height * 2);
    console.log(JSON.stringify(pins));
    ws.close();
  } finally { chrome.kill(); }
})().catch((e) => { console.error('ОШИБКА', e.message); process.exit(1); });
