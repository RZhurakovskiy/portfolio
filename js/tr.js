(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const IMG = 'images/tochniy-raschet/';

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

  /* ---------- Таблетка под выбранной кнопкой переключателя ---------- */
  const placePill = (seg) => {
    const pill = seg.querySelector('.tr-seg__pill');
    const on = seg.querySelector('[aria-selected="true"]');
    if (!pill || !on || !on.offsetWidth) return;
    pill.style.setProperty('--x', `${on.offsetLeft}px`);
    pill.style.setProperty('--w', `${on.offsetWidth}px`);
  };
  const placeAll = () => document.querySelectorAll('.tr-seg').forEach(placePill);
  placeAll();
  window.addEventListener('resize', placeAll);
  window.addEventListener('load', placeAll);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeAll);

  /* ---------- Нижний док ---------- */
  const dock = document.querySelector('[data-dock]');
  if (dock) {
    const links = [...dock.querySelectorAll('.tr-dock__links a')];
    const pill = dock.querySelector('.tr-dock__pill');
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
    const foot = document.querySelector('.tr-foot');
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
      dock.addEventListener('click', (e) => { if (e.target.closest('.tr-dock__links a')) closeDock(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDock(); });
    }
  }

  /* ---------- Живой расчёт: формулы взяты из проекта ---------- */
  // lib/calculators/kompensaciya-otpuska.ts, vykhodnoe-posobie.ts, date-utils.ts и сценарий
  // components/calculators/UvolnenieScenarioForm.tsx. Здесь они повторены один в один:
  // 2,33 дня отпуска за полный месяц, средний месяц 29,3 дня, НДФЛ 13% с компенсации,
  // пособие без НДФЛ.
  const DAY = 86400000;
  const MAX_DAYS = 3650;
  const AVG_MONTH_DAYS = 29.3;
  const LEAVE_DAYS_PER_MONTH = 28 / 12;
  const NDFL_RATE = 0.13;

  const NUM = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
  const NUM2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (n) => `${NUM.format(Math.round(n))} ₽`;
  const longDate = (d) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const shortDate = (d) => d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const parseDate = (value) => {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

  // Полные месяцы между датами, остаток от 15 дней считается за месяц.
  const fullMonthsBetween = (start, end) => {
    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    let mark = new Date(start.getFullYear(), start.getMonth() + months, start.getDate());
    if (mark > end) {
      months -= 1;
      mark = new Date(start.getFullYear(), start.getMonth() + months, start.getDate());
    }
    const rest = Math.round((end.getTime() - mark.getTime()) / DAY);
    if (rest >= 15) months += 1;
    return Math.max(months, 0);
  };
  const tenure = (months) => {
    const y = Math.floor(months / 12);
    const m = months % 12;
    if (!y && !m) return 'меньше месяца';
    return [y ? `${y} г.` : '', m ? `${m} мес.` : ''].filter(Boolean).join(' ');
  };

  const demo = document.querySelector('[data-demo]');
  if (demo) {
    const $ = (sel) => demo.querySelector(sel);
    const hireEl = $('[data-hire]');
    const termEl = $('[data-term]');
    const salaryEl = $('[data-salary]');
    const usedEl = $('[data-used]');
    const m2El = $('[data-m2]');
    const m3El = $('[data-m3]');
    const checks = $('[data-checks]');
    const slip = $('[data-slip]');
    const rowsEl = $('[data-rows]');
    const totalEl = $('[data-total]');
    const miniEl = $('[data-mini-total]');
    const tl = $('[data-tl]');
    const track = tl.querySelector('.tr-tl__track');
    const ticksEl = $('[data-ticks]');
    const stepsBtn = $('[data-steps-toggle]');
    const reasonBtns = [...demo.querySelectorAll('[data-reason]')];
    let reason = 'cut';
    let shown = null; // что сейчас показано в итоге, нужно для плавного перехода числа
    let raf = 0;

    const fillOf = (input) => {
      const min = Number(input.min);
      const max = Number(input.max);
      input.style.setProperty('--fill', `${((Number(input.value) - min) / (max - min)) * 100}%`);
    };

    const renderTicks = (hire) => {
      const w = track.clientWidth || 300;
      const every = w < 420 ? 2 : 1;
      ticksEl.innerHTML = '';
      let idx = 0;
      for (let y = hire.getFullYear() + 1; ; y++) {
        const at = new Date(y, 0, 1);
        const days = Math.round((at - hire) / DAY);
        if (days > MAX_DAYS) break;
        if (days <= 0) continue;
        const tick = document.createElement('span');
        tick.className = 'tr-tick';
        tick.style.left = `${(days / MAX_DAYS) * 100}%`;
        if (idx % every === 0) tick.innerHTML = `<span>${y}</span>`;
        ticksEl.appendChild(tick);
        idx += 1;
      }
    };

    const tween = (to) => {
      cancelAnimationFrame(raf);
      const from = shown === null ? to : shown;
      shown = to;
      if (reduceMotion || from === to) {
        totalEl.textContent = money(to);
        miniEl.textContent = money(to);
        return;
      }
      const t0 = performance.now();
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / 380);
        const v = from + (to - from) * (1 - Math.pow(1 - k, 3));
        totalEl.textContent = money(v);
        miniEl.textContent = money(v);
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const row = (label, value, how, opts = {}) => `
      <div class="tr-row${opts.minus ? ' tr-row--minus' : ''}${opts.strong ? ' tr-row--strong' : ''}${opts.sep ? ' tr-row--sep' : ''}">
        <div class="tr-row__line"><span class="tr-row__label">${label}</span><i class="tr-row__dots"></i><b class="tr-row__val">${value}</b></div>
        ${how ? `<p class="tr-row__how">${how}</p>` : ''}
      </div>`;
    const law = (text, href) => (href ? `<a href="${href}" target="_blank" rel="noopener">${text}</a>` : text);

    const render = () => {
      const hire = parseDate(hireEl.value || '2023-01-15');
      const offset = Number(termEl.value);
      const term = addDays(hire, offset);
      const salary = Number(salaryEl.value);
      const months = fullMonthsBetween(hire, term);
      const earned = LEAVE_DAYS_PER_MONTH * months;

      // Использованные дни не могут быть больше накопленных: верхняя граница ползунка двигается.
      usedEl.max = String(Math.max(0, Math.floor(earned)));
      if (Number(usedEl.value) > Number(usedEl.max)) usedEl.value = usedEl.max;
      const used = Number(usedEl.value);

      m3El.disabled = !m2El.checked;
      if (!m2El.checked) m3El.checked = false;

      const days = Math.max(earned - used, 0);
      const sdz = salary / AVG_MONTH_DAYS;
      const gross = sdz * days;
      const ndfl = gross * NDFL_RATE;
      const net = gross - ndfl;
      let severance = 0;
      let sevMonths = 0;
      if (reason === 'cut') {
        sevMonths = 1 + (m2El.checked ? 1 : 0) + (m2El.checked && m3El.checked ? 1 : 0);
        severance = salary * sevMonths;
      }
      const total = net + severance;

      // Подписи и ползунки
      const p = offset / MAX_DAYS;
      track.style.setProperty('--p', String(p));
      tl.querySelector('[data-term-label]').textContent = longDate(term);
      tl.querySelector('[data-span]').textContent = tenure(months);
      $('[data-salary-out]').textContent = money(salary);
      $('[data-used-out]').textContent = `${used} дн.`;
      $('[data-slip-period]').textContent = `${shortDate(hire)} → ${shortDate(term)}`;
      [salaryEl, usedEl].forEach(fillOf);
      checks.hidden = reason !== 'cut';

      const rows = [
        row('Отработано полных месяцев', `${months} мес.`, `с ${shortDate(hire)} по ${shortDate(term)}, остаток от 15 дней считается за месяц`),
        row('Дней отпуска к компенсации', `${NUM2.format(days)} дн.`, `2,33 × ${months} мес. − ${used} использовано · ${law('ст. 127 ТК РФ', 'https://pravo.ppt.ru/kodeks/tk/st-127')}`),
        row('Средний дневной заработок', money(sdz), `${money(salary)} ÷ 29,3`),
        row('Компенсация до налога', money(gross), `${money(sdz)} × ${NUM2.format(days)} дн.`),
        row('НДФЛ 13%', `− ${money(ndfl)}`, `${money(gross)} × 13% · ${law('ст. 224 НК РФ', 'https://pravo.ppt.ru/kodeks/nk/st-224')}`, { minus: true }),
        row('Компенсация на руки', money(net), `${money(gross)} − ${money(ndfl)}`, { strong: true }),
      ];
      if (reason === 'cut') {
        rows.push(row(`Выходное пособие за ${sevMonths} мес.`, money(severance), `${money(salary)} × ${sevMonths} · ${law('ст. 178 ТК РФ', 'https://pravo.ppt.ru/kodeks/tk/st-178')}. НДФЛ не удерживается в пределах трёхкратного заработка (ст. 217 НК РФ)`, { strong: true, sep: true }));
      }
      rowsEl.innerHTML = rows.join('');
      tween(total);
    };

    // События
    [hireEl, termEl, salaryEl, usedEl, m2El, m3El].forEach((el) => el.addEventListener('input', () => {
      if (el === hireEl) renderTicks(parseDate(hireEl.value || '2023-01-15'));
      render();
    }));
    reasonBtns.forEach((b) => b.addEventListener('click', () => {
      reason = b.dataset.reason;
      reasonBtns.forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      placeAll();
      render();
    }));
    stepsBtn.addEventListener('click', () => {
      const on = !slip.classList.contains('is-steps');
      slip.classList.toggle('is-steps', on);
      stepsBtn.setAttribute('aria-pressed', String(on));
      stepsBtn.textContent = on ? 'Скрыть расчёт по шагам' : 'Показать расчёт по шагам';
    });
    new ResizeObserver(() => renderTicks(parseDate(hireEl.value || '2023-01-15'))).observe(track);

    renderTicks(parseDate(hireEl.value));
    render();
  }

  /* ---------- Карта калькуляторов: подсветка ---------- */
  const filter = document.querySelector('[data-filter]');
  const map = document.querySelector('[data-map]');
  if (filter && map) {
    filter.addEventListener('click', (e) => {
      const b = e.target.closest('[data-f]');
      if (!b) return;
      filter.querySelectorAll('[data-f]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      map.dataset.active = b.dataset.f;
    });
  }

  /* ---------- Экраны: страница и размер ---------- */
  const SIZES = {
    home: { desktop: [1440, 2716], tablet: [820, 2950], mobile: [780, 8278], title: 'Главная' },
    uvolnenie: { desktop: [1440, 5213], tablet: [820, 5473], mobile: [780, 16358], title: 'Выплаты при увольнении' },
    ipoteka: { desktop: [1440, 5210], tablet: [820, 5442], mobile: [780, 15752], title: 'Досрочное погашение ипотеки' },
  };
  const scr = document.querySelector('[data-screens]');
  if (scr) {
    const frame = scr.querySelector('[data-frame]');
    const img = scr.querySelector('[data-frame-img]');
    const view = scr.querySelector('[data-view]');
    const urlEl = scr.querySelector('[data-frame-url]');
    const pageSeg = scr.querySelector('[data-seg-page]');
    const devSeg = scr.querySelector('[data-seg-device]');
    const btn = scr.querySelector('[data-play]');
    const label = btn.querySelector('span');
    const icon = btn.querySelector('use');
    let page = 'home';
    let device = window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1100 ? 'tablet' : 'desktop';
    let raf = 0;

    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      btn.setAttribute('aria-pressed', 'false');
      label.textContent = 'Пролистать';
      icon.setAttribute('href', '#i-play');
    };
    const apply = () => {
      stop();
      const [w, h] = SIZES[page][device];
      img.src = `${IMG}${page}-${device}-full.webp`;
      img.width = w;
      img.height = h;
      img.alt = `${SIZES[page].title}: страница целиком (${device === 'desktop' ? 'ПК' : device === 'tablet' ? 'планшет' : 'телефон'})`;
      frame.classList.remove('is-desktop', 'is-tablet', 'is-mobile');
      frame.classList.add(`is-${device}`);
      urlEl.textContent = `ТочныйРасчёт · ${SIZES[page].title}`;
      view.scrollTop = 0;
      pageSeg.querySelectorAll('[data-page]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.page === page)));
      devSeg.querySelectorAll('[data-device]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.device === device)));
      placeAll();
    };
    pageSeg.addEventListener('click', (e) => { const b = e.target.closest('[data-page]'); if (b) { page = b.dataset.page; apply(); } });
    devSeg.addEventListener('click', (e) => { const b = e.target.closest('[data-device]'); if (b) { device = b.dataset.device; apply(); } });

    btn.addEventListener('click', () => {
      if (raf) return stop();
      btn.setAttribute('aria-pressed', 'true');
      label.textContent = 'Остановить';
      icon.setAttribute('href', '#i-pause');
      if (view.scrollTop + view.clientHeight >= view.scrollHeight - 2) view.scrollTop = 0;
      // Длинные страницы листаются быстрее, чтобы весь показ укладывался примерно в минуту.
      const speed = Math.max(0.085, (view.scrollHeight - view.clientHeight) / 60000);
      let last = performance.now();
      let pos = view.scrollTop;
      const tick = (now) => {
        pos += (now - last) * speed;
        last = now;
        view.scrollTop = pos;
        if (view.scrollTop + view.clientHeight >= view.scrollHeight - 2) return stop();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((ev) => view.addEventListener(ev, () => raf && stop(), { passive: true }));
    apply();
  }

  /* ---------- Год в подвале ---------- */
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
