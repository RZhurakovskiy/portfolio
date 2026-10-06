// Показывает перемещение метки на карте в «Контактах»: клик по карте меняет точку и ссылку в форме.
// «Сохранить контакты» не нажимается; после съёмки страница перезагружается и значение сверяется.
const fs = require('fs');
const { openTab, sleep } = require('./cdp');
const OUT = require('path').resolve(__dirname, '../../images/hr-automotive');
const DEVICES = [
  { name: 'desktop', width: 1440, height: 900, dpr: 1, mobile: false },
  { name: 'tablet', width: 820, height: 1180, dpr: 1, mobile: true },
  { name: 'mobile', width: 390, height: 844, dpr: 2, mobile: true },
];
const MAP_URL_VALUE = `document.querySelector('input[name="mapUrl"]').value`;

(async () => {
  for (const d of DEVICES) {
    const t = await openTab('about:blank');
    await t.send('Emulation.setDeviceMetricsOverride', { width: d.width, height: d.height, deviceScaleFactor: d.dpr, mobile: d.mobile });
    await t.send('Page.navigate', { url: 'https://hr-automotive.aigrus.ru/admin/contacts' });
    await sleep(4500);
    const original = await t.evalJs(MAP_URL_VALUE);

    // Прокрутка так, чтобы в кадре были поле ссылки и карта.
    await t.evalJs(`(() => { const f = document.querySelector('input[name="mapUrl"]'); window.scrollTo(0, f.getBoundingClientRect().top + scrollY - 90); return 1; })()`);
    await sleep(800);
    const before = await t.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/admin-map-before-${d.name}.png`, Buffer.from(before.data, 'base64'));

    const rect = JSON.parse(await t.evalJs(`JSON.stringify((() => { const r = document.getElementById('adminMapPreview').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })())`));
    // Клик в стороне от центра: вправо и вверх.
    const cx = rect.x + rect.w / 2 + Math.min(rect.w * 0.22, 200);
    const cy = rect.y + rect.h / 2 - rect.h * 0.18;
    await t.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy });
    await t.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
    await sleep(80);
    await t.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
    await sleep(1800);
    const moved = await t.evalJs(MAP_URL_VALUE);
    const after = await t.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/admin-map-after-${d.name}.png`, Buffer.from(after.data, 'base64'));
    console.log(`${d.name}: ссылка изменилась = ${moved !== original}`);

    // Отмена: перезагрузка без сохранения, сверяем значение с исходным.
    t.send('Page.navigate', { url: 'https://hr-automotive.aigrus.ru/admin/contacts' }).catch(() => {});
    await sleep(500);
    await t.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
    await sleep(4500);
    const restored = await t.evalJs(MAP_URL_VALUE);
    console.log(`${d.name}: после перезагрузки ссылка равна исходной = ${restored === original}`);
    await t.close();
  }
})().catch((e) => { console.error('ОШИБКА', e.message); process.exit(1); });
