// Снимает разделы админки на трёх устройствах. Только просмотр: переходы по ссылкам и две
// кнопки, которые ничего не меняют ("Корзина" открывает список удалённых, "Редактировать"
// заполняет форму, не сохраняя). Остальные кнопки не нажимаются никогда.
const fs = require('fs');
const path = require('path');
const { openTab, sleep } = require('./cdp');

const PUBLIC_DIR = path.resolve(__dirname, '../../images/hr-automotive');
const PRIVATE_DIR = path.join(__dirname, 'private');
fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.mkdirSync(PRIVATE_DIR, { recursive: true });

const DEVICES = [
  { name: 'desktop', width: 1440, height: 900, dpr: 1, mobile: false },
  { name: 'tablet', width: 820, height: 1180, dpr: 1, mobile: true },
  { name: 'mobile', width: 390, height: 844, dpr: 2, mobile: true },
];

// private: содержит данные пользователей или внутренние цифры, в репозиторий не кладём.
const PAGES = [
  { key: 'vacancies', url: 'https://hr-automotive.aigrus.ru/admin/vacancies', private: false },
  { key: 'vacancy-editor', url: 'https://hr-automotive.aigrus.ru/admin/vacancies', private: false, action: 'edit' },
  { key: 'trash', url: 'https://hr-automotive.aigrus.ru/admin/vacancies', private: false, action: 'trash' },
  { key: 'contacts', url: 'https://hr-automotive.aigrus.ru/admin/contacts', private: false },
  { key: 'users', url: 'https://hr-automotive.aigrus.ru/admin/users', private: true },
  { key: 'metrics', url: 'https://hr-automotive.aigrus.ru/admin/metrics', private: true },
];

// Единственные разрешённые нажатия. Текст проверяется точно, чтобы не попасть в «В корзину» и другие.
const clickByText = (text, mode) => `(() => {
  const els = [...document.querySelectorAll('button')].filter((b) => {
    const t = b.textContent.trim().replace(/\\s+/g, ' ');
    return ${mode === 'starts' ? 't.startsWith(' + JSON.stringify(text) + ')' : 't === ' + JSON.stringify(text)};
  });
  if (!els.length) return 'нет кнопки';
  els[0].click();
  return 'нажата: ' + els[0].textContent.trim();
})()`;

(async () => {
  const only = process.argv[2]; // необязательно: ключ страницы
  for (const d of DEVICES) {
    const t = await openTab('about:blank');
    await t.send('Emulation.setDeviceMetricsOverride', { width: d.width, height: d.height, deviceScaleFactor: d.dpr, mobile: d.mobile });
    for (const p of PAGES) {
      if (only && p.key !== only) continue;
      await t.send('Page.navigate', { url: p.url });
      await sleep(3500);
      if (p.action === 'edit') {
        console.log(`  ${d.name}/${p.key}:`, await t.evalJs(clickByText('Редактировать', 'exact')));
        await sleep(1200);
      } else if (p.action === 'trash') {
        console.log(`  ${d.name}/${p.key}:`, await t.evalJs(clickByText('Корзина', 'starts')));
        await sleep(1500);
      }
      const url = await t.evalJs('location.href');
      if (url.includes('/login')) throw new Error('сессия слетела, вход нужен заново');
      await t.evalJs('window.scrollTo(0, 0); 1');
      const height = await t.evalJs('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)');
      const dir = p.private ? PRIVATE_DIR : PUBLIC_DIR;
      const base = path.join(dir, `admin-${p.key}-${d.name}`);
      const first = await t.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(`${base}-first.png`, Buffer.from(first.data, 'base64'));
      const full = await t.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: d.width, height, scale: 1 },
      });
      fs.writeFileSync(`${base}-full.png`, Buffer.from(full.data, 'base64'));
      console.log(`${d.name} ${p.key}${p.private ? ' (приватный)' : ''}: ${d.width}x${height}`);
    }
    await t.close();
  }
})().catch((e) => {
  console.error('ОШИБКА', e.message);
  process.exit(1);
});
