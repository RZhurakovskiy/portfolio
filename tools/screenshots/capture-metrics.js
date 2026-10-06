// Метрики с раскрытыми внутренними списками. Только отображение: нажимаются вкладки фильтра,
// высота списков снимается стилями в кадре, данные и сервер не затрагиваются. Снимки приватные.
const fs = require('fs');
const path = require('path');
const { openTab, sleep } = require('./cdp');
const PRIVATE_DIR = path.join(__dirname, 'private');
const DEVICES = [
  { name: 'desktop', width: 1440, height: 900, dpr: 1, mobile: false },
  { name: 'tablet', width: 820, height: 1180, dpr: 1, mobile: true },
  { name: 'mobile', width: 390, height: 844, dpr: 2, mobile: true },
];
const TABS = [['По вакансиям', 'vacancies'], ['По дням', 'days'], ['Последние просмотры', 'recent']];
const click = (text) => `(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === ${JSON.stringify(text)}); if (!b) return 'нет'; b.click(); return 'нажата: ' + text; })()`;
const EXPAND = `(() => { const s = document.createElement('style'); s.textContent = '.admin-vacancies-list{max-height:none !important;overflow:visible !important;height:auto !important}'; document.head.appendChild(s); return 1; })()`;
const SEG = 12000; // css-пикселей на кусок

(async () => {
  for (const d of DEVICES) {
    const t = await openTab('about:blank');
    await t.send('Emulation.setDeviceMetricsOverride', { width: d.width, height: d.height, deviceScaleFactor: d.dpr, mobile: d.mobile });
    for (const [label, key] of TABS) {
      await t.send('Page.navigate', { url: 'https://hr-automotive.aigrus.ru/admin/metrics' });
      await sleep(3500);
      const res = await t.evalJs(click(label));
      await sleep(1200);
      if ((await t.evalJs('location.href')).includes('/login')) throw new Error('сессия слетела');
      await t.evalJs(EXPAND);
      await sleep(800);
      await t.evalJs('window.scrollTo(0,0); 1');
      const height = await t.evalJs('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)');
      const parts = Math.ceil(height / SEG);
      for (let i = 0; i < parts; i++) {
        const y = i * SEG;
        const h = Math.min(SEG, height - y);
        const shot = await t.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y, width: d.width, height: h, scale: 1 } });
        const suffix = parts > 1 ? `-part${i + 1}` : '';
        fs.writeFileSync(path.join(PRIVATE_DIR, `admin-metrics-${key}-${d.name}${suffix}.png`), Buffer.from(shot.data, 'base64'));
      }
      console.log(`${d.name} ${key}: ${res}, высота ${height}, частей ${parts}`);
    }
    await t.close();
  }
})().catch((e) => { console.error('ОШИБКА', e.message); process.exit(1); });
