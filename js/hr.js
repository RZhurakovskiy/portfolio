(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const IMG = 'images/hr-automotive/';

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

  /* ---------- Числа в полосе фактов ---------- */
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    if (reduceMotion || !target) return;
    el.textContent = '0';
    onVisible(el, () => {
      const t0 = performance.now();
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / 1100);
        el.textContent = String(Math.round(target * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, 0.6);
  });

  /* ---------- Нижний док ---------- */
  const dock = document.querySelector('[data-dock]');
  if (dock) {
    const links = [...dock.querySelectorAll('.hr-dock__links a')];
    const pill = dock.querySelector('.hr-dock__pill');
    const ring = dock.querySelector('[data-dock-ring]');
    const label = dock.querySelector('[data-dock-label]');
    const toggle = dock.querySelector('[data-dock-toggle]');
    const sections = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);

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

    // У подвала док прячется, чтобы не лежать поверх контактов.
    const foot = document.querySelector('.hr-foot');
    if (foot && 'IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => dock.classList.toggle('is-away', entry.isIntersecting), { threshold: 0.2 }).observe(foot);
    }
    new ResizeObserver(() => movePill(links.find((a) => a.classList.contains('is-active')))).observe(dock);

    if ('IntersectionObserver' in window) {
      const visible = new Set();
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => (entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target)));
        const current = sections.filter((s) => visible.has(s)).at(-1);
        if (current) setActive(links.find((a) => a.getAttribute('href') === `#${current.id}`));
      }, { rootMargin: '-40% 0px -45% 0px' });
      sections.forEach((s) => io.observe(s));
    }

    // Кольцо вокруг «наверх» показывает, сколько страницы прочитано.
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
      dock.addEventListener('click', (e) => { if (e.target.closest('.hr-dock__links a')) closeDock(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDock(); });
    }
  }

  /* ---------- Таблетка под выбранной кнопкой переключателя ---------- */
  const placePill = (seg) => {
    const pill = seg.querySelector('.hr-seg__pill');
    const on = seg.querySelector('[aria-selected="true"]');
    if (!pill || !on || !on.offsetWidth) return;
    pill.style.setProperty('--x', `${on.offsetLeft}px`);
    pill.style.setProperty('--w', `${on.offsetWidth}px`);
  };
  const segs = [...document.querySelectorAll('.hr-seg')];
  const placeAll = () => segs.forEach(placePill);
  placeAll();
  window.addEventListener('resize', placeAll);
  window.addEventListener('load', placeAll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeAll);

  /* ---------- Выбор устройства: ПК, планшет, телефон ---------- */
  const roots = [...document.querySelectorAll('[data-device-root]')];
  const setDevice = (root, device) => {
    root.dataset.device = device;
    root.querySelectorAll('[data-device]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.device === device)));
    root.querySelectorAll('[data-device-pane]').forEach((p) => p.classList.toggle('is-active', p.dataset.devicePane === device));
    root.querySelectorAll('.hr-seg').forEach(placePill);
    root.dispatchEvent(new CustomEvent('hr:device', { detail: { device } }));
  };
  // На узком экране сразу показываем подходящий размер: ПК в рамке шириной с телефон нечитаем.
  const startDevice = window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1100 ? 'tablet' : 'desktop';
  roots.forEach((root) => {
    root.querySelectorAll('[data-device]').forEach((b) => b.addEventListener('click', () => setDevice(root, b.dataset.device)));
    setDevice(root, startDevice);
  });

  /* ---------- Шов: слева сайт, справа админка ---------- */
  const seam = document.querySelector('[data-seam]');
  if (seam) {
    const range = seam.querySelector('.hr-seam__range');
    let touched = false;
    const setPos = (v) => {
      seam.style.setProperty('--pos', `${v}%`);
      range.value = String(v);
    };
    range.addEventListener('input', () => {
      touched = true;
      seam.style.setProperty('--pos', `${range.value}%`);
    });
    // Подсказка: шов сам качнётся один раз, пока человек его не тронул.
    onVisible(seam, () => {
      if (reduceMotion) return;
      const t0 = performance.now();
      const DUR = 2800;
      const tick = (now) => {
        if (touched) return;
        const k = Math.min(1, (now - t0) / DUR);
        setPos((50 + Math.sin(k * Math.PI * 2) * 24 * (1 - k)).toFixed(1));
        if (k < 1) requestAnimationFrame(tick);
      };
      setTimeout(() => requestAnimationFrame(tick), 500);
    }, 0.5);
  }

  /* ---------- Страница целиком: ручная прокрутка и автопрокрутка ---------- */
  document.querySelectorAll('[data-scroll-demo]').forEach((root) => {
    const btn = root.querySelector('[data-play]');
    const label = btn && btn.querySelector('span');
    const icon = btn && btn.querySelector('use');
    let raf = 0;
    let view = null;

    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (!btn) return;
      btn.setAttribute('aria-pressed', 'false');
      if (label) label.textContent = 'Пролистать автоматически';
      if (icon) icon.setAttribute('href', '#i-play');
    };
    const activeView = () => root.querySelector('.hr-frame.is-active [data-view]');

    const start = () => {
      view = activeView();
      if (!view) return;
      btn.setAttribute('aria-pressed', 'true');
      if (label) label.textContent = 'Остановить';
      if (icon) icon.setAttribute('href', '#i-pause');
      if (view.scrollTop + view.clientHeight >= view.scrollHeight - 2) view.scrollTop = 0;
      let last = performance.now();
      let pos = view.scrollTop;
      const tick = (now) => {
        const dt = now - last;
        last = now;
        pos += dt * 0.085;
        view.scrollTop = pos;
        if (view.scrollTop + view.clientHeight >= view.scrollHeight - 2) return stop();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    if (btn) btn.addEventListener('click', () => (raf ? stop() : start()));
    // Любое действие человека останавливает показ: дальше он смотрит сам.
    root.querySelectorAll('[data-view]').forEach((v) => {
      ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((ev) => v.addEventListener(ev, () => raf && stop(), { passive: true }));
    });
    root.addEventListener('hr:device', stop);
  });

  /* ---------- Админка: вкладки и экраны ---------- */
  const PARTS = { vacancies: { desktop: 1, tablet: 1, mobile: 1 }, days: { desktop: 1, tablet: 1, mobile: 1 }, recent: { desktop: 2, tablet: 2, mobile: 3 } };
  const ADMIN = {
    vacancies: {
      url: 'hr-automotive.aigrus.ru/admin/vacancies',
      title: 'Вакансии',
      text: 'Список вакансий в том порядке, в каком они на сайте. У каждой переключатель публикации, кнопки порядка, редактирование и отправка в корзину. Справа сразу открыт редактор.',
      list: ['публикация одним переключателем', 'порядок на сайте кнопками «Выше» и «Ниже»', 'удаление мягкое: через корзину, со счётчиком'],
      files: (d) => [`admin-vacancies-${d}-full`],
    },
    editor: {
      url: 'hr-automotive.aigrus.ru/admin/vacancies',
      title: 'Редактор вакансии',
      text: 'Название, зарплата, график и три списка: обязанности, требования и условия. Пункты добавляются и убираются по одному. Кнопка «Заполнить из вакансии» берёт готовую за шаблон. На экране открыта первая вакансия, ничего не сохранено.',
      list: ['пункты списков по одному, с удалением', '«Заполнить из вакансии» как шаблон', 'сохранить или очистить форму'],
      files: (d) => [`admin-vacancy-editor-${d}-full`],
    },
    trash: {
      url: 'hr-automotive.aigrus.ru/admin/vacancies',
      title: 'Корзина',
      text: 'Удалённые вакансии с датой и временем удаления. Любую можно восстановить, удалить навсегда или очистить корзину целиком. Ошибочное удаление не стоит заказчику вакансии.',
      list: ['восстановление одной кнопкой', 'удаление навсегда только осознанно', 'очистка корзины целиком'],
      files: (d) => [`admin-trash-${d}-full`],
    },
    contacts: {
      url: 'hr-automotive.aigrus.ru/admin/contacts',
      title: 'Контакты',
      text: 'Телефоны (их может быть несколько), почта, VK, Telegram, WhatsApp и карта. Метку двигают мышью или кликом по карте, ссылка на Яндекс.Карты обновляется сама.',
      list: ['несколько телефонов с добавлением и удалением', 'соцсети и мессенджеры', 'метка на карте вместо ручных координат'],
      files: (d) => [`admin-contacts-${d}-full`],
    },
    users: {
      url: 'hr-automotive.aigrus.ru/admin/users',
      title: 'Пользователи и роли',
      text: 'Учётные записи админки: логин, пароль, роль и переключатель «разрешить вход». У каждой записи видно, разрешён ли доступ, и метки «главный» и «системный пользователь». Логины на экране заменены.',
      list: ['роли: HR / главный администратор, администратор', 'вход можно запретить, не удаляя запись', 'главный и системный пользователь отмечены'],
      files: (d) => [`admin-users-${d}`],
    },
    metrics: {
      url: 'hr-automotive.aigrus.ru/admin/metrics',
      title: 'Метрики',
      text: 'Сводка по просмотрам вакансий и отдельный учёт посещений главной: в метрики попадает тот, кто пробыл на странице не меньше 30 секунд видимого времени. IP посетителей на экране заменены.',
      list: ['всего, за сегодня, уникальных', 'по вакансиям, по дням, последние просмотры', 'какие карточки читают чаще всего'],
      sub: [['vacancies', 'По вакансиям'], ['days', 'По дням'], ['recent', 'Последние просмотры']],
      files: (d, sub) => {
        const n = PARTS[sub][d];
        return Array.from({ length: n }, (_, i) => `admin-metrics-${sub}-${d}${n > 1 ? `-part${i + 1}` : ''}`);
      },
    },
  };

  const adm = document.querySelector('[data-admin]');
  if (adm) {
    // Разделы, для которых скриншоты ещё не готовы: на них IP посетителей, логины и названия снятых
    // вакансий, их сначала маскируют. Пока имя здесь, вкладка скрыта; когда замаскированные картинки
    // лягут в images/hr-automotive, убрать имя из списка.
    const PENDING = new Set(['trash', 'users', 'metrics']);
    const keys = Object.keys(ADMIN).filter((k) => !PENDING.has(k));
    const tabs = [...adm.querySelectorAll('[data-tab]')];
    tabs.forEach((t) => { if (PENDING.has(t.dataset.tab)) t.hidden = true; });
    // Номера у видимых вкладок идут подряд, без дыр от скрытых.
    tabs.filter((t) => !t.hidden).forEach((t, n) => { const b = t.querySelector('b'); if (b) b.textContent = String(n + 1).padStart(2, '0'); });
    const numEl = adm.querySelector('[data-note-num]');
    const titleEl = adm.querySelector('[data-note-title]');
    const textEl = adm.querySelector('[data-note-text]');
    const listEl = adm.querySelector('[data-note-list]');
    const subEl = adm.querySelector('[data-subtabs]');
    const urlEls = [...adm.querySelectorAll('[data-adm-url]')];
    let current = 'vacancies';
    let sub = 'vacancies';

    const fill = () => {
      const def = ADMIN[current];
      ['desktop', 'tablet', 'mobile'].forEach((device) => {
        const view = adm.querySelector(`[data-device-pane="${device}"] [data-view]`);
        if (!view) return;
        view.replaceChildren(
          ...def.files(device, sub).map((name) => {
            const img = new Image();
            img.className = 'is-on';
            img.decoding = 'async';
            img.loading = 'lazy';
            img.alt = `${def.title}: экран админки (${device === 'desktop' ? 'ПК' : device === 'tablet' ? 'планшет' : 'телефон'})`;
            img.src = `${IMG}${name}.webp`;
            return img;
          }),
        );
        view.scrollTop = 0;
      });
    };

    const show = (key) => {
      current = key;
      const def = ADMIN[key];
      tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === key)));
      numEl.textContent = String(keys.indexOf(key) + 1).padStart(2, '0');
      titleEl.textContent = def.title;
      textEl.textContent = def.text;
      listEl.innerHTML = def.list.map((l) => `<li>${l}</li>`).join('');
      urlEls.forEach((u) => (u.textContent = def.url));
      if (def.sub) {
        sub = def.sub[0][0];
        subEl.hidden = false;
        subEl.innerHTML = def.sub.map(([k, l]) => `<button type="button" role="tab" aria-selected="${k === sub}" data-sub="${k}">${l}</button>`).join('');
      } else {
        subEl.hidden = true;
        subEl.innerHTML = '';
      }
      fill();
    };

    subEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sub]');
      if (!b) return;
      sub = b.dataset.sub;
      subEl.querySelectorAll('[data-sub]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      fill();
    });
    tabs.filter((t) => !t.hidden).forEach((t) => t.addEventListener('click', () => show(t.dataset.tab)));
    // Стрелки переключают разделы, как вкладки в приложении.
    adm.querySelector('[role="tablist"]').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const i = keys.indexOf(current) + (e.key === 'ArrowRight' ? 1 : -1);
      const next = keys[(i + keys.length) % keys.length];
      show(next);
      tabs.find((t) => t.dataset.tab === next).focus();
    });
    show('vacancies');
  }

  /* ---------- Сравнение: метка на карте ---------- */
  document.querySelectorAll('[data-compare]').forEach((box) => {
    const range = box.querySelector('.hr-compare__range');
    range.addEventListener('input', () => box.style.setProperty('--pos', `${range.value}%`));
  });

  /* ---------- Год в подвале ---------- */
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
