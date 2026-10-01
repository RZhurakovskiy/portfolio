(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const onVisible = (el, cb, threshold = 0.3) => {
    if (!el) return;
    if (!('IntersectionObserver' in window)) return cb();
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        cb();
      }
    }, { threshold });
    io.observe(el);
  };

  /* ---------- Терминал: запуск агента ---------- */
  const term = document.querySelector('[data-term]');
  const launch = document.querySelector('[data-launch]');
  if (term && launch) {
    // То, что агент действительно печатает (agent/ui/mainMenu.go), и адреса его потоков.
    const script = [
      ['<span class="p">$</span> ', 'cd agent &amp;&amp; go run main.go', true],
      ['<span class="h">NEXORA</span> <span class="m">· агент мониторинга системы</span>'],
      ['Главное меню:'],
      [' [1] Мониторинг и управление по загрузке CPU'],
      [' [2] Мониторинг и управление по использованию памяти'],
      [' [3] Запуск сервера и GUI'],
      [' [4] Включить/выключить мониторинг системы'],
      [' [0] Выйти'],
      ['<span class="m">---------------------------------</span>'],
      ['<span class="p">›</span> ', '3', true],
      ['<span class="ok">✓</span> сервер: <span class="u">http://localhost:8080</span>'],
      ['<span class="ok">✓</span> потоки: <span class="u">/ws/cpu</span> · <span class="u">/ws/memory</span> · <span class="u">/ws/processes</span>'],
    ];
    const lines = [];
    const cursor = '<span class="nx-term__cursor"></span>';
    const render = (extra = '') => { term.innerHTML = lines.join('\n') + extra; };

    const typeLine = (prefix, text, done) => {
      let i = 0;
      const plain = text.replace(/&amp;/g, '&');
      const tick = () => {
        i++;
        const shown = plain.slice(0, i).replace(/&/g, '&amp;');
        render(`${lines.length ? '\n' : ''}${prefix}${shown}${cursor}`);
        if (i < plain.length) setTimeout(tick, 22 + Math.random() * 28);
        else { lines.push(prefix + shown); setTimeout(done, 180); }
      };
      tick();
    };

    const run = (n = 0) => {
      if (n >= script.length) {
        render(`\n${cursor}`);
        launch.classList.add('is-up');
        return;
      }
      const [a, b, typed] = script[n];
      if (typed) typeLine(a, b, () => run(n + 1));
      else {
        lines.push(a);
        render(cursor);
        setTimeout(() => run(n + 1), n < 9 ? 35 : 220);
      }
    };

    if (reduceMotion) {
      script.forEach(([a, b]) => lines.push(a + (b || '')));
      render();
      launch.classList.add('is-up');
    } else {
      onVisible(launch, () => setTimeout(run, 250), 0.2);
    }
  }

  /* ---------- Живой график CPU за первым экраном ---------- */
  const line = document.querySelector('[data-line]');
  const area = document.querySelector('[data-area]');
  const head = document.querySelector('[data-head]');
  const cpu = document.querySelector('[data-cpu]');
  if (line && area) {
    const N = 90;
    const values = [];
    let v = 30;
    for (let i = 0; i < N; i++) {
      v += (Math.random() - 0.5) * 10;
      if (Math.random() < 0.05) v = 55 + Math.random() * 25;
      v = Math.max(12, Math.min(85, v * 0.9 + 3));
      values.push(v);
    }
    // Координаты в системе viewBox 1000×300; справа место под подписи оси и значение.
    const x = (i) => (i / (N - 1)) * 900;
    const y = (val) => 300 - (val / 100) * 300;
    const paint = () => {
      const pts = values.map((val, i) => `${x(i).toFixed(1)} ${y(val).toFixed(1)}`);
      line.setAttribute('d', `M${pts.join(' L')}`);
      area.setAttribute('d', `M${pts.join(' L')} L900 300 L0 300 Z`);
      const last = values[N - 1];
      if (head) head.style.setProperty('--y', `${100 - last}%`);
      if (cpu) cpu.textContent = `${Math.round(last)}%`;
    };
    paint();
    if (!reduceMotion) {
      // Как у настоящего потока /ws/cpu: новая точка раз в секунду.
      setInterval(() => {
        if (document.hidden) return;
        let next = values[N - 1] + (Math.random() - 0.5) * 12;
        if (Math.random() < 0.06) next = 60 + Math.random() * 25;
        values.push(Math.max(8, Math.min(92, next * 0.92 + 3)));
        values.shift();
        paint();
      }, 1000);
    }
  }

  /* ---------- Лента событий ---------- */
  const feed = document.querySelector('[data-feed]');
  if (feed) {
    const items = [
      '<b>ws/cpu</b> <em>{"cpu":32.4}</em>',
      '<b>ws/memory</b> <em>{"used_mb":4096,"total_mb":21888}</em>',
      '<b>GET</b> <em>/api/listening-ports</em>',
      '<b>ws/processes</b> <em>210 активных</em>',
      '<b>POST</b> <em>/api/kill-process-by-id · pid 8803</em>',
      '<b>GET</b> <em>/api/disk-health</em>',
      '<b>POST</b> <em>/api/start-recording · 120 с · CPU &gt; 70%</em>',
      '<b>GET</b> <em>/api/metrics-history</em>',
      '<b>GET</b> <em>/api/export/processes · CSV</em>',
      '<b>GET</b> <em>/api/version · 1.1.0</em>',
    ];
    const once = items.map((t) => `<span>${t}</span>`).join('');
    feed.innerHTML = once + once;
  }

  /* ---------- Счётчики ---------- */
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    if (reduceMotion || !target) return;
    el.textContent = '0';
    onVisible(el, () => {
      const start = performance.now();
      const dur = 1200;
      const step = (now) => {
        const k = Math.min(1, (now - start) / dur);
        el.textContent = String(Math.round(target * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });

  /* ---------- Интерфейс: вкладки как в приложении ---------- */
  const app = document.querySelector('[data-app]');
  const notes = {
    'system-info': {
      url: 'localhost:5173/',
      title: 'Общая информация',
      text: 'Что это за машина: ОС, ядро, аптайм и load average, память и swap, диски и разделы. Одна страница вместо uname, free, df и lsblk.',
      list: ['хост и пользователь в шапке', 'SMART дисков, где доступен', 'понятное «недоступно» там, где нет'],
    },
    chart: {
      url: 'localhost:5173/metrics',
      title: 'Метрики',
      text: 'Графики CPU и памяти обновляются потоком, без перезагрузки. Справа текущая нагрузка крупно и словом: низкая, средняя, высокая.',
      list: ['плавная анимация новых точек', 'статус соединения у каждого графика', 'выгрузка накопленного из базы'],
    },
    table: {
      url: 'localhost:5173/processes',
      title: 'Процессы',
      text: 'Все процессы с путём, пользователем, портами, нагрузкой CPU и памятью полосками. Тяжёлые подсвечены сразу, без сортировки глазами.',
      list: ['поиск по PID, имени, порту', 'просмотр деталей и завершение', 'экспорт в JSON и CSV'],
    },
    'network-ports': {
      url: 'localhost:5173/ports',
      title: 'Сетевые порты',
      text: 'Интерфейсы с трафиком и ошибками, под ними соединения: локальный и удалённый адрес, протокол, статус и процесс-владелец.',
      list: ['только серверы (LISTEN) одним флажком', 'автообновление раз в 5 секунд', 'запуск процесса на нужном порту'],
    },
    'record-history': {
      url: 'localhost:5173/history',
      title: 'История метрик',
      text: 'Всё, что агент записал в SQLite, с фильтром по времени и лимитом. Пока идёт запись сессии, в углу видно, сколько осталось.',
      list: ['фильтр «от» и «до»', 'экспорт JSON', 'очистка накопленного'],
    },
  };
  if (app) {
    const tabs = [...app.querySelectorAll('[data-tab]')];
    const screens = [...app.querySelectorAll('[data-screen]')];
    const url = app.querySelector('[data-url]');
    const progress = app.querySelector('[data-progress]');
    const numEl = app.querySelector('[data-note-num]');
    const titleEl = app.querySelector('[data-note-title]');
    const textEl = app.querySelector('[data-note-text]');
    const listEl = app.querySelector('[data-note-list]');
    let current = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    let auto = !reduceMotion;
    let started = 0;
    const PERIOD = 6000;

    const show = (i) => {
      current = (i + tabs.length) % tabs.length;
      const key = tabs[current].dataset.tab;
      tabs.forEach((t, n) => t.setAttribute('aria-selected', String(n === current)));
      screens.forEach((s) => s.classList.toggle('is-active', s.dataset.screen === key));
      const note = notes[key];
      if (url) url.textContent = note.url;
      numEl.textContent = String(current + 1).padStart(2, '0');
      titleEl.textContent = note.title;
      textEl.textContent = note.text;
      listEl.innerHTML = note.list.map((l) => `<li>${l}</li>`).join('');
      started = performance.now();
    };

    tabs.forEach((t, n) => t.addEventListener('click', () => {
      // Клик останавливает автопоказ: человек смотрит сам.
      auto = false;
      if (progress) progress.style.setProperty('--p', '0');
      show(n);
    }));

    const loop = (now) => {
      if (!auto) return;
      const k = (now - started) / PERIOD;
      if (progress) progress.style.setProperty('--p', String(Math.min(1, k)));
      if (k >= 1) show(current + 1);
      requestAnimationFrame(loop);
    };
    show(current);
    onVisible(app, () => { if (auto) { started = performance.now(); requestAnimationFrame(loop); } }, 0.4);
  }

  /* ---------- Таймер записи в плитке ---------- */
  const rec = document.querySelector('[data-rec]');
  if (rec && !reduceMotion) {
    let left = 101;
    setInterval(() => {
      left = left > 0 ? left - 1 : 120;
      rec.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
    }, 1000);
  }

  /* ---------- Просмотр скриншота ---------- */
  const lb = document.querySelector('[data-lightbox]');
  if (lb) {
    const img = lb.querySelector('[data-lb-img]');
    const cap = lb.querySelector('[data-lb-cap]');
    let opener = null;
    const open = (src, alt, from) => {
      opener = from;
      img.src = src;
      img.alt = alt;
      cap.textContent = alt;
      lb.hidden = false;
      document.body.classList.add('is-locked');
      lb.querySelector('.nx-lightbox__close').focus();
    };
    const close = () => {
      lb.hidden = true;
      document.body.classList.remove('is-locked');
      if (opener) opener.focus();
    };
    document.querySelectorAll('[data-open-shot]').forEach((el) => {
      el.addEventListener('click', () => {
        const pic = el.querySelector('img');
        open(pic.currentSrc || pic.src, pic.alt, el);
      });
    });
    const screensBox = document.querySelector('[data-screens]');
    if (screensBox) {
      screensBox.addEventListener('click', () => {
        const pic = screensBox.querySelector('img.is-active');
        if (pic) open(pic.currentSrc || pic.src, pic.alt, screensBox);
      });
    }
    lb.querySelectorAll('[data-lb-close]').forEach((b) => b.addEventListener('click', close));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lb.hidden) close(); });
  }
})();
