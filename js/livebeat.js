(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const IMG = 'images/livebeat/';

  const onVisible = (el, cb, options = { threshold: 0.35 }) => {
    if (!('IntersectionObserver' in window)) return cb();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        cb();
      });
    }, options);
    io.observe(el);
  };

  /* ---------- Нижний док ---------- */
  const dock = document.querySelector('[data-dock]');
  if (dock) {
    const links = [...dock.querySelectorAll('.lb-dock__links a')];
    const pill = dock.querySelector('.lb-dock__pill');
    const ring = dock.querySelector('[data-dock-ring]');
    const label = dock.querySelector('[data-dock-label]');
    const toggle = dock.querySelector('[data-dock-toggle]');
    const sections = links
      .map((a) => document.querySelector(a.getAttribute('href')))
      .filter(Boolean);

    const movePill = (link) => {
      if (!link || !pill) return;
      pill.style.setProperty('--pill-x', `${link.offsetLeft}px`);
      pill.style.setProperty('--pill-w', `${link.offsetWidth}px`);
      pill.classList.add('is-on');
    };

    const setActive = (link) => {
      links.forEach((a) => a.classList.toggle('is-active', a === link));
      if (label && link) label.textContent = link.textContent.trim();
      movePill(link);
    };

    if (links[0]) setActive(links[0]);
    requestAnimationFrame(() => dock.classList.add('is-ready'));

    const foot = document.querySelector('.lb-foot');
    if (foot && 'IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        dock.classList.toggle('is-away', entry.isIntersecting);
      }, { threshold: 0.2 }).observe(foot);
    }
    new ResizeObserver(() => movePill(links.find((a) => a.classList.contains('is-active')))).observe(dock);

    if ('IntersectionObserver' in window) {
      const visible = new Set();
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        });
        const current = sections.filter((s) => visible.has(s)).at(-1);
        if (current) setActive(links.find((a) => a.getAttribute('href') === `#${current.id}`));
      }, { rootMargin: '-40% 0px -45% 0px' });
      sections.forEach((s) => io.observe(s));
    }

    const updateRing = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (ring) ring.style.setProperty('--p', String(max > 0 ? window.scrollY / max : 0));
    };
    window.addEventListener('scroll', updateRing, { passive: true });
    updateRing();

    if (toggle) {
      const closeDock = () => {
        dock.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      };
      toggle.addEventListener('click', () => {
        const open = !dock.classList.contains('is-open');
        dock.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));
      });
      dock.addEventListener('click', (e) => { if (e.target.closest('.lb-dock__links a')) closeDock(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDock(); });
    }
  }

  /* ---------- Заголовок по буквам ---------- */
  const title = document.querySelector('[data-split]');
  if (title) {
    const text = title.textContent.trim();
    title.innerHTML = [...text]
      .map((ch, i) => {
        const grad = i >= 4 ? ` ch--grad" style="--i:${i};--g:${i - 4}` : `" style="--i:${i}`;
        return `<span class="ch${grad}" aria-hidden="true">${ch}</span>`;
      })
      .join('');
  }

  /* ---------- Сцена первого экрана ---------- */
  const stage = document.querySelector('[data-stage]');
  if (stage) {
    const start = () => requestAnimationFrame(() => stage.classList.add('is-in'));
    if (document.readyState === 'complete') setTimeout(start, 150);
    else window.addEventListener('load', () => setTimeout(start, 150), { once: true });
    setTimeout(start, 1800);
  }

  // Линия ЭКГ
  const ecgPath = () => {
    const base = 130;
    let d = `M0 ${base}`;
    for (let x = 0; x < 1600; x += 200) {
      d += ` L${x + 50} ${base}`
        + ` Q${x + 62} ${base - 14} ${x + 74} ${base}`
        + ` L${x + 92} ${base}`
        + ` L${x + 100} ${base + 14}`
        + ` L${x + 110} ${base - 108}`
        + ` L${x + 121} ${base + 44}`
        + ` L${x + 130} ${base}`
        + ` Q${x + 152} ${base - 22} ${x + 174} ${base}`
        + ` L${x + 200} ${base}`;
    }
    return d;
  };
  document.querySelectorAll('[data-ecg]').forEach((path) => {
    path.setAttribute('d', ecgPath());
    path.setAttribute('pathLength', '1000');
  });


  // Живой пульс в чипе
  const bpm = document.querySelector('[data-bpm]');
  if (bpm && !reduceMotion) {
    let value = 148;
    setInterval(() => {
      value = Math.max(138, Math.min(162, value + Math.round((Math.random() - 0.5) * 6)));
      bpm.textContent = value;
    }, 1100);
  }

  /* ---------- Счётчики ---------- */
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    if (reduceMotion) return;
    const from = target === 0 ? 99 : 0;
    el.textContent = from;
    onVisible(el, () => {
      const t0 = performance.now();
      const dur = 1600;
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(from + (target - from) * eased);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.6 });
  });

  /* ---------- Сценарий: смена экранов в закреплённом телефоне ---------- */
  const flowScreens = document.querySelector('[data-flow-screens]');
  const flowSteps = [...document.querySelectorAll('[data-flow-step]')];
  if (flowScreens && flowSteps.length) {
    const screens = [...flowScreens.querySelectorAll('img')];
    const bar = document.querySelector('[data-flow-bar]');
    const halo = document.querySelector('.lb-flow__halo');
    const halos = [
      'rgba(255, 61, 110, 0.4)',
      'rgba(255, 138, 61, 0.38)',
      'rgba(34, 197, 94, 0.3)',
      'rgba(34, 197, 94, 0.32)',
      'rgba(34, 197, 94, 0.28)',
      'rgba(255, 90, 80, 0.36)',
      'rgba(255, 138, 61, 0.4)',
      'rgba(255, 61, 110, 0.36)',
      'rgba(255, 122, 61, 0.38)',
    ];

    const setStep = (i) => {
      screens.forEach((img, n) => img.classList.toggle('is-active', n === i));
      flowSteps.forEach((step, n) => step.classList.toggle('is-active', n === i));
      if (bar) bar.style.setProperty('--progress', (i + 1) / flowSteps.length);
      if (halo) halo.style.setProperty('--halo', halos[i % halos.length]);
    };
    setStep(0);

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setStep(flowSteps.indexOf(entry.target));
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    flowSteps.forEach((s) => io.observe(s));
  }

  /* ---------- Слайдер «до / после» ---------- */
  document.querySelectorAll('[data-compare]').forEach((box) => {
    const range = box.querySelector('input');
    const set = (p) => {
      const v = Math.max(0, Math.min(1, p));
      box.style.setProperty('--p', v);
      range.value = Math.round(v * 100);
    };

    const fromEvent = (e) => {
      const r = box.getBoundingClientRect();
      set((e.clientX - r.left - 8) / (r.width - 16));
    };

    let dragging = false;
    let touched = false;
    box.addEventListener('pointerdown', (e) => {
      dragging = true;
      touched = true;
      box.classList.add('is-dragging');
      box.setPointerCapture(e.pointerId);
      fromEvent(e);
    });
    box.addEventListener('pointermove', (e) => { if (dragging) fromEvent(e); });
    const stop = () => { dragging = false; box.classList.remove('is-dragging'); };
    box.addEventListener('pointerup', stop);
    box.addEventListener('pointercancel', stop);
    range.addEventListener('input', () => { touched = true; set(range.value / 100); });

    // Подсказка: ползунок сам проезжает туда-обратно, пока его не трогали
    if (!reduceMotion) {
      onVisible(box, () => {
        const keys = [0.5, 0.18, 0.82, 0.5];
        const t0 = performance.now();
        const dur = 2600;
        const tick = (now) => {
          if (touched) return;
          const p = Math.min(1, (now - t0) / dur);
          const seg = Math.min(keys.length - 2, Math.floor(p * (keys.length - 1)));
          const local = p * (keys.length - 1) - seg;
          const e = local < 0.5 ? 4 * local ** 3 : 1 - (-2 * local + 2) ** 3 / 2;
          set(keys[seg] + (keys[seg + 1] - keys[seg]) * e);
          if (p < 1) requestAnimationFrame(tick);
        };
        setTimeout(() => requestAnimationFrame(tick), 500);
      }, { threshold: 0.6 });
    }
  });

  /* ---------- Режимы тренировки ---------- */
  const modes = document.querySelector('[data-modes]');
  if (modes) {
    const btns = [...modes.querySelectorAll('[data-mode-btn]')];
    const pill = modes.querySelector('.lb-seg__pill');

    const movePill = () => {
      const active = btns.find((b) => b.getAttribute('aria-selected') === 'true');
      pill.style.setProperty('--pill-x', `${active.offsetLeft}px`);
      pill.style.setProperty('--pill-w', `${active.offsetWidth}px`);
    };

    const setMode = (mode) => {
      modes.dataset.current = mode;
      btns.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.modeBtn === mode)));
      modes.querySelectorAll('[data-mode]').forEach((img) => {
        img.classList.toggle('is-active', img.dataset.mode === mode);
      });
      movePill();
    };

    btns.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.modeBtn)));
    setMode('outdoor');
    new ResizeObserver(movePill).observe(pill.parentElement);
  }

  /* ---------- Переключатели вариантов ---------- */
  document.querySelectorAll('[data-edge]').forEach((card) => {
    const imgs = [...card.querySelectorAll('.phone__screen img')];
    const btns = [...card.querySelectorAll('.lb-toggle button')];
    btns.forEach((btn, i) => {
      btn.addEventListener('click', () => {
        btns.forEach((b, n) => b.setAttribute('aria-pressed', String(n === i)));
        imgs.forEach((img, n) => img.classList.toggle('is-active', n === i));
      });
    });
  });

  /* ---------- Подсветка карточек ---------- */
  if (finePointer) {
    document.querySelectorAll('.lb-feature').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
  }

  /* ---------- Все экраны ---------- */
  const groups = {
    launch: 'Запуск',
    setup: 'Настройка',
    sensor: 'Датчик',
    mode: 'Режимы',
    workout: 'Тренировка',
    alerts: 'Нештатные',
    summary: 'Итоги',
    history: 'История',
  };

  const shots = [
    ['preloader', 'Прелоадер', 'launch'],
    ['preloader-screen', 'Прелоадер, вариант', 'launch'],
    ['welcome', 'Приветствие', 'launch'],
    ['welcome-screen', 'Приветствие, вариант', 'launch'],

    ['setup-empty', 'Настройка: пусто', 'setup'],
    ['setup-filled', 'Настройка: заполнено', 'setup'],
    ['screen-setup-initial', 'Полная настройка', 'setup'],
    ['screen-setup-completed', 'Настройка завершена', 'setup'],

    ['sensor-scanning', 'Поиск датчика', 'sensor'],
    ['sensor-search-scanning', 'Поиск, вариант', 'sensor'],
    ['sensor-found', 'Датчики найдены', 'sensor'],
    ['sensor-search-found', 'Выбор датчика', 'sensor'],
    ['sensor-error', 'Ошибка подключения', 'sensor'],
    ['sensor-search-error', 'Ошибка, вариант', 'sensor'],

    ['screen-1', 'Режим с историей', 'mode'],
    ['screen-2', 'Режим: на улице', 'mode'],
    ['screen-4', 'Режим: дорожка', 'mode'],
    ['mode-outdoor-active', 'На улице, активен', 'mode'],
    ['mode-treadmill-active', 'Дорожка, активна', 'mode'],

    ['active-outdoor', 'Тренировка на улице', 'workout'],
    ['screen-3', 'Улица, вариант с градиентом', 'workout'],
    ['active-treadmill', 'Тренировка на дорожке', 'workout'],
    ['screen-5', 'Разминка, зона 1', 'workout'],

    ['active-outdoor-gps-waiting', 'Ожидание GPS', 'alerts'],
    ['banner-gps-waiting', 'Ожидание GPS, яркий', 'alerts'],
    ['active-outdoor-no-contact', 'Нет контакта с кожей', 'alerts'],
    ['banner-no-skin-contact', 'Нет контакта, яркий', 'alerts'],
    ['active-outdoor-sensor-lost', 'Датчик потерян', 'alerts'],
    ['banner-sensor-lost', 'Датчик потерян, яркий', 'alerts'],

    ['post-run-summary', 'Итоги пробежки', 'summary'],
    ['summary-outdoor', 'Итоги на улице', 'summary'],
    ['summary-treadmill', 'Итоги на дорожке', 'summary'],
    ['treadmill-summary', 'Нагрузка на дорожке', 'summary'],

    ['history-weekly', 'Недельная сводка', 'history'],
    ['history-workouts', 'История тренировок', 'history'],
    ['history-empty', 'История: пусто', 'history'],
    ['empty-state-workouts', 'Пока нет тренировок', 'history'],
  ].map(([file, name, group]) => ({ src: `${IMG}${file}.jpg`, name, group }));

  const grid = document.querySelector('[data-gallery]');
  const filters = document.querySelector('[data-filters]');
  let visibleShots = shots;

  if (grid && filters) {
    grid.innerHTML = shots.map((s, i) => `
      <li data-group="${s.group}">
        <button type="button" class="lb-shot" data-shot="${i}">
          <span class="lb-shot__img">
            <img src="${s.src}" alt="${s.name}" loading="lazy" decoding="async" width="412" height="917">
            <span class="lb-shot__zoom"><svg class="icon"><use href="#i-expand"/></svg></span>
          </span>
          <span class="lb-shot__cap"><strong>${s.name}</strong><span>${groups[s.group]}</span></span>
        </button>
      </li>`).join('');

    const counts = shots.reduce((acc, s) => ({ ...acc, [s.group]: (acc[s.group] || 0) + 1 }), {});
    filters.innerHTML = [['all', 'Все', shots.length], ...Object.entries(groups).map(([k, v]) => [k, v, counts[k]])]
      .map(([key, label, n], i) => `<button type="button" role="tab" aria-selected="${i === 0}" data-filter="${key}">${label}<small>${n}</small></button>`)
      .join('');

    const items = [...grid.children];
    filters.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      const key = btn.dataset.filter;
      filters.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      let n = 0;
      items.forEach((li) => {
        const show = key === 'all' || li.dataset.group === key;
        li.hidden = !show;
        if (show) {
          li.style.setProperty('--i', Math.min(n++, 12));
          li.style.animation = 'none';
          void li.offsetWidth;
          li.style.animation = '';
        }
      });
      visibleShots = key === 'all' ? shots : shots.filter((s) => s.group === key);
    });
  }

  /* ---------- Лайтбокс ---------- */
  const lb = document.querySelector('[data-lightbox]');
  if (lb && grid) {
    const img = lb.querySelector('[data-lb-img]');
    const phone = lb.querySelector('.lb-lightbox__phone');
    const cap = lb.querySelector('[data-lb-title]');
    const group = lb.querySelector('[data-lb-group]');
    const closeBtn = lb.querySelector('.lb-lightbox__close');
    let index = 0;
    let trigger = null;

    const show = (i, animate = true) => {
      index = (i + visibleShots.length) % visibleShots.length;
      const s = visibleShots[index];
      const apply = () => {
        img.src = s.src;
        img.alt = s.name;
        cap.textContent = s.name;
        group.textContent = groups[s.group];
        phone.classList.remove('is-switching');
      };
      if (animate && !reduceMotion) {
        phone.classList.add('is-switching');
        setTimeout(apply, 180);
      } else apply();
      [1, -1].forEach((d) => { new Image().src = visibleShots[(index + d + visibleShots.length) % visibleShots.length].src; });
    };

    const open = (shot, from) => {
      trigger = from;
      show(Math.max(0, visibleShots.indexOf(shot)), false);
      lb.hidden = false;
      document.body.classList.add('is-locked');
      requestAnimationFrame(() => lb.classList.add('is-open'));
      closeBtn.focus({ preventScroll: true });
    };

    const close = () => {
      lb.classList.remove('is-open');
      document.body.classList.remove('is-locked');
      setTimeout(() => { lb.hidden = true; }, reduceMotion ? 0 : 400);
      if (trigger) trigger.focus({ preventScroll: true });
    };

    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-shot]');
      if (btn) open(shots[Number(btn.dataset.shot)], btn);
    });
    lb.querySelectorAll('[data-lb-close]').forEach((b) => b.addEventListener('click', close));
    lb.querySelector('[data-lb-prev]').addEventListener('click', () => show(index - 1));
    lb.querySelector('[data-lb-next]').addEventListener('click', () => show(index + 1));

    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    });

    // Свайп на телефоне
    let sx = null;
    const fig = lb.querySelector('.lb-lightbox__figure');
    fig.addEventListener('pointerdown', (e) => { sx = e.clientX; });
    fig.addEventListener('pointerup', (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      sx = null;
      if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
    });
  }
})();
