// Материал для кейса ТочныйРасчёт: первый экран каждого калькулятора (ПК), светлая тема, карточки соцсетей.
// Проект должен быть запущен локально: npx next dev -p 3100 (в папке tochniy-raschet).
//
//   node capture-tr-gallery.js <папка_png>
//
// Перед съёмкой в профиль браузера кладётся зарплата 80 000 ₽: формы, которые берут её из профиля,
// сразу показывают результат, как у вернувшегося посетителя. Тёмная тема по умолчанию у самого сайта.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const out = process.argv[2];
if (!out) { console.error('использование: node capture-tr-gallery.js <папка_png>'); process.exit(1); }
const BASE = process.env.TR_BASE || 'http://localhost:3100';
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9344;
const SLUGS = [
  'ndfl', 'oklad-iz-zarplaty-na-ruki', 'trudovoy-dogovor-vs-samozanyatost',
  'otpusknye', 'kompensaciya-otpuska', 'vykhodnoe-posobie', 'vyplaty-pri-sokraschenii',
  'bolnichnyy', 'bolnichnyy-po-uhodu',
  'alimenty', 'dekretnye', 'vyplaty-v-dekrete', 'detskie-vychety',
  'peni', 'ispolnitelskiy-sbor', 'shtraf-gibdd',
  'ipoteka-dosrochnoe-pogashenie',
];
const LIGHT = [
  { key: 'home', path: '/' },
  { key: 'uvolnenie', path: '/vyplaty-pri-sokraschenii?reason=sokraschenie&hireDate=2023-01-15&terminationDate=2026-08-27&monthlySalary=80000&usedDays=0&month2Paid=1' },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(path.join(out, 'calc'), { recursive: true });
  fs.mkdirSync(path.join(out, 'og'), { recursive: true });

  // Карточки соцсетей сайт генерирует сам: /<страница>/opengraph-image.
  for (const slug of ['', ...SLUGS]) {
    const res = await fetch(`${BASE}${slug ? '/' + slug : ''}/opengraph-image`);
    if (!res.ok) { console.log('og нет:', slug || 'главная', res.status); continue; }
    fs.writeFileSync(path.join(out, 'og', `${slug || 'home'}.png`), Buffer.from(await res.arrayBuffer()));
  }
  console.log('карточки соцсетей сохранены');

  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'trg-'));
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
    const hideDev = () => ev("(() => { const s = document.createElement('style'); s.textContent = 'nextjs-portal{display:none !important}'; document.head.appendChild(s); return 1; })()");
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    await send('Page.navigate', { url: BASE + '/' });
    await sleep(4000);
    await ev(`localStorage.setItem('tochny-raschet:profile', JSON.stringify({ monthlyIncome: 80000 })); localStorage.setItem('theme', 'dark'); 1`);

    for (const slug of SLUGS) {
      await send('Page.navigate', { url: `${BASE}/${slug}` });
      await sleep(6500);
      await hideDev();
      await sleep(400);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(out, 'calc', `${slug}.png`), Buffer.from(shot.data, 'base64'));
      console.log('снят', slug);
    }

    // Светлая тема: тот же сайт, переключатель темы хранит выбор в localStorage.
    await ev(`localStorage.setItem('theme', 'light'); 1`);
    for (const p of LIGHT) {
      await send('Page.navigate', { url: BASE + p.path });
      await sleep(6500);
      await hideDev();
      const isDark = await ev(`document.documentElement.classList.contains('dark')`);
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(out, `${p.key}-light.png`), Buffer.from(shot.data, 'base64'));
      console.log('светлая', p.key, 'класс dark:', isDark);
    }
    await ev(`localStorage.setItem('theme', 'dark'); localStorage.removeItem('tochny-raschet:profile'); 1`);
    ws.close();
  } finally { chrome.kill(); }
})().catch((e) => { console.error('ОШИБКА', e.message); process.exit(1); });
