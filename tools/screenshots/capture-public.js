// Снимает публичную страницу на трёх устройствах: первый экран и всю страницу.
// Запуск: node capture.js <url> <папка> <префикс>
// Chrome запускается отдельно и невидимо, окно пользователя не трогается.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const [url, outDir, prefix] = process.argv.slice(2);
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333; // свой порт, не мешает Chrome с админкой
const DEVICES = [
  { name: 'desktop', width: 1440, height: 900, dpr: 1, mobile: false },
  { name: 'tablet', width: 820, height: 1180, dpr: 1, mobile: true },
  { name: 'mobile', width: 390, height: 844, dpr: 2, mobile: true },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-'));
  const chrome = spawn(
    CHROME,
    ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userData}`, 'about:blank'],
    { stdio: 'ignore' },
  );
  try {
    let wsUrl;
    for (let i = 0; i < 40 && !wsUrl; i++) {
      await sleep(250);
      try {
        const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
        wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
      } catch {
        // Chrome ещё поднимается
      }
    }
    if (!wsUrl) throw new Error('Chrome не ответил');
    const ws = new WebSocket(wsUrl);
    await new Promise((r) => (ws.onopen = r));
    let id = 0;
    const pending = new Map();
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      }
    };
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const myId = ++id;
        pending.set(myId, { resolve, reject });
        ws.send(JSON.stringify({ id: myId, method, params }));
      });
    const evalJs = async (expression) =>
      (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;

    await send('Page.enable');
    for (const d of DEVICES) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: d.width,
        height: d.height,
        deviceScaleFactor: d.dpr,
        mobile: d.mobile,
      });
      await send('Page.navigate', { url });
      await sleep(3500);
      // Баннер cookie в кадре портфолио не нужен: принимаем его, как обычный посетитель.
      await evalJs(
        "[...document.querySelectorAll('button,a,div,span')].filter(e => e.children.length === 0 && e.textContent.trim() === 'Применить').forEach(e => e.click()); 1",
      );
      await sleep(800);
      // Прокрутка вниз и обратно: подгружает ленивые картинки и запускает анимации появления и счётчики.
      const total = await evalJs('document.documentElement.scrollHeight');
      for (let y = 0; y < total; y += Math.round(d.height * 0.6)) {
        await evalJs(`window.scrollTo(0, ${y}); 1`);
        await sleep(350);
      }
      await evalJs('window.scrollTo(0, document.documentElement.scrollHeight); 1');
      await sleep(1500);
      await evalJs('window.scrollTo(0, 0); 1');
      await sleep(1200);

      const height = await evalJs('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)');
      const first = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(outDir, `${prefix}-${d.name}-first.png`), Buffer.from(first.data, 'base64'));
      const full = await send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: d.width, height, scale: 1 },
      });
      fs.writeFileSync(path.join(outDir, `${prefix}-${d.name}-full.png`), Buffer.from(full.data, 'base64'));
      console.log(`${d.name}: ширина ${d.width}, высота страницы ${height}`);
    }
    ws.close();
  } finally {
    chrome.kill();
  }
}

main().catch((e) => {
  console.error('ОШИБКА', e.message);
  process.exit(1);
});
