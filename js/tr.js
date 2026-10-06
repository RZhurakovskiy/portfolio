(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const wide = window.matchMedia('(min-width: 1101px)');
  const IMG = 'images/tochniy-raschet/';

  const NUM = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
  const NUM1 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
  const NUM2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (n) => `${NUM.format(Math.round(n))} ₽`;
  const ease = (k) => 1 - Math.pow(1 - k, 3);
  const plural = (n, one, few, many) => {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b > 1 && b < 5) return few;
    return many;
  };

  // Один раз, когда элемент показался на экране.
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
  // Каждый раз, когда элемент входит на экран или уходит с него.
  const watch = (el, cb, rootMargin = '0px') => {
    if (!el) return;
    if (!('IntersectionObserver' in window)) return cb(true);
    new IntersectionObserver(([entry]) => cb(entry.isIntersecting), { rootMargin }).observe(el);
  };
  // Плавный счёт числа к новому значению; возвращает функцию остановки.
  const countTo = (from, to, ms, paint) => {
    if (reduceMotion || from === to) { paint(to); return () => {}; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      paint(from + (to - from) * ease(k));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  };
  // Заливка дорожки ползунка слева от ручки.
  const fillOf = (input) => {
    const min = Number(input.min);
    const max = Number(input.max);
    input.style.setProperty('--fill', `${((Number(input.value) - min) / (max - min)) * 100}%`);
  };
  // Обработчик прокрутки не чаще одного раза за кадр.
  const onScroll = (fn) => {
    let ticking = false;
    const run = () => { ticking = false; fn(); };
    const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } };
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    fn();
  };

  /* ---------- Числа в полосе фактов ---------- */
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    if (reduceMotion || !target) return;
    el.textContent = '0';
    onVisible(el, () => countTo(0, target, 1100, (v) => { el.textContent = String(Math.round(v)); }), 0.6);
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
    watch(document.querySelector('.tr-foot'), (on) => dock.classList.toggle('is-away', on));
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
    onScroll(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (ring) ring.style.setProperty('--p', String(max > 0 ? window.scrollY / max : 0));
    });

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
      document.addEventListener('click', (e) => { if (!dock.contains(e.target)) closeDock(); });
    }
  }

  /* ---------- Первый экран ---------- */
  // Заголовок по буквам: буквы поднимаются лесенкой.
  const title = document.querySelector('[data-title]');
  if (title && !reduceMotion) {
    let i = 0;
    title.querySelectorAll(':scope > span').forEach((part) => {
      part.setAttribute('aria-hidden', 'true');
      part.innerHTML = [...part.textContent].map((c) => `<span class="ch" style="--i:${i++}">${c}</span>`).join('');
    });
  }

  // Стена экранов: каждая колонка повторена дважды, чтобы бесконечная прокрутка шла без шва.
  const hero = document.querySelector('[data-hero]');
  const plane = document.querySelector('[data-wall]');
  if (hero && plane) {
    plane.querySelectorAll('.tr-wall__col').forEach((col) => {
      [...col.children].forEach((tile) => col.appendChild(tile.cloneNode(true)));
    });
    // За пределами экрана стена стоит: анимация не тратит батарею.
    watch(hero, (on) => hero.classList.toggle('is-paused', !on));
    if (finePointer && !reduceMotion) {
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        plane.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
        plane.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
      });
      hero.addEventListener('pointerleave', () => {
        plane.style.setProperty('--mx', '0');
        plane.style.setProperty('--my', '0');
      });
    }
  }

  // Карточка с настоящими результатами: три расчёта сайта по очереди.
  const ticker = document.querySelector('[data-ticker]');
  if (ticker) {
    const RESULTS = [
      { label: 'Выплаты при увольнении', val: 398334, sub: 'стаж 3 г. 7 мес., зарплата 80 000 ₽, сокращение' },
      { label: 'Досрочное погашение ипотеки', val: 4089700, sub: 'экономия на процентах: долг 5 млн под 18%, доплата 500 000 ₽' },
      { label: 'НДФЛ и зарплата на руки', val: 130500, sub: 'на руки с оклада 150 000 ₽ до вычета налога' },
    ];
    const labelEl = ticker.querySelector('[data-t-label]');
    const valEl = ticker.querySelector('[data-t-val]');
    const subEl = ticker.querySelector('[data-t-sub]');
    const dots = [...ticker.querySelectorAll('[data-t-dots] i')];
    let at = 0;
    let timer = 0;
    let stop = () => {};
    let heroOn = true;

    const show = (i) => {
      at = i;
      const r = RESULTS[i];
      labelEl.style.opacity = '0';
      subEl.style.opacity = '0';
      setTimeout(() => {
        labelEl.textContent = r.label;
        subEl.textContent = r.sub;
        labelEl.style.opacity = '';
        subEl.style.opacity = '';
      }, reduceMotion ? 0 : 250);
      stop();
      stop = countTo(0, r.val, 900, (v) => { valEl.textContent = money(v); });
      dots.forEach((d, k) => d.classList.toggle('is-on', k === i));
    };
    const schedule = () => {
      clearInterval(timer);
      if (heroOn && !document.hidden) timer = setInterval(() => show((at + 1) % RESULTS.length), 5000);
    };
    watch(ticker, (on) => { heroOn = on; schedule(); });
    document.addEventListener('visibilitychange', schedule);
  }

  /* ---------- Бегущие ленты и пульс меток стоят за пределами экрана ---------- */
  document.querySelectorAll('[data-pausable], [data-anno]').forEach((el) => {
    watch(el, (on) => el.classList.toggle('is-paused', !on), '100px');
  });

  /* ---------- 01 Листок печатается: формулы взяты из проекта ---------- */
  // lib/calculators/kompensaciya-otpuska.ts, vykhodnoe-posobie.ts, date-utils.ts и сценарий
  // components/calculators/UvolnenieScenarioForm.tsx. Здесь они повторены один в один:
  // 28/12 дня отпуска за полный месяц, средний месяц 29,3 дня, НДФЛ 13% с компенсации,
  // пособие без НДФЛ.
  const DAY = 86400000;
  const MAX_DAYS = 3650;
  const AVG_MONTH_DAYS = 29.3;
  const LEAVE_DAYS_PER_MONTH = 28 / 12;
  const NDFL_RATE = 0.13;

  const longDate = (d) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/\s*г\.$/, '');
  const shortDate = (d) => d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const parseDate = (value) => {
    const [y, m, d] = String(value || '2023-01-15').split('-').map(Number);
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
    return [y ? `${y} г.` : '', m ? `${m} мес.` : ''].filter(Boolean).join(' ');
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
    const totalRow = $('[data-total-row]');
    const totalEl = $('[data-total]');
    const miniEl = $('[data-mini-total]');
    const tl = $('[data-tl]');
    const track = tl.querySelector('.tr-tl__track');
    const ticksEl = $('[data-ticks]');
    const stepsBtn = $('[data-steps-toggle]');
    const reasonBtns = [...demo.querySelectorAll('[data-reason]')];
    const steps = [...demo.querySelectorAll('.tr-story__step')];
    const playZone = $('[data-play-zone]');
    // Какие строки листка относятся к шагу истории: от следующей после прошлого шага до своей.
    const RANGES = steps.map((s, i) => [i ? Number(steps[i - 1].dataset.reveal) + 1 : 1, Number(s.dataset.reveal)]);
    const ALL = 8;

    let reason = 'cut';
    let level = 0; // сколько строк уже напечатано, 8 вместе с итогом
    let focus = null; // строки текущего шага, их отмечает полоска слева
    let total = 0;
    let shown = 0; // что сейчас написано в итоге, от него идёт плавный переход
    let stopTotal = () => {};

    const paintTotal = (v) => {
      shown = v;
      totalEl.textContent = money(v);
      miniEl.textContent = money(v);
    };
    const tweenTotal = (from, ms = 380) => {
      stopTotal();
      stopTotal = countTo(from, total, ms, paintTotal);
    };

    const renderTicks = () => {
      const hire = parseDate(hireEl.value);
      const w = track.clientWidth || 300;
      const every = w < 420 ? 2 : 1;
      ticksEl.innerHTML = '';
      let idx = 0;
      for (let y = hire.getFullYear() + 1; ; y++) {
        const days = Math.round((new Date(y, 0, 1) - hire) / DAY);
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

    const row = (i, label, value, how, opts = {}) => {
      const cls = ['tr-row'];
      if (opts.minus) cls.push('tr-row--minus');
      if (opts.strong) cls.push('tr-row--strong');
      if (opts.sep) cls.push('tr-row--sep');
      if (i > level) cls.push('is-hidden');
      if (focus && i >= focus[0] && i <= focus[1]) cls.push('is-focus');
      return `
      <div class="${cls.join(' ')}" data-i="${i}">
        <div class="tr-row__line"><span class="tr-row__label">${label}</span><i class="tr-row__dots"></i><b class="tr-row__val">${value}</b></div>
        ${how ? `<p class="tr-row__how">${how}</p>` : ''}
      </div>`;
    };
    const law = (text, href) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

    // Новые строки «печатаются»: появляются слева направо одна за другой.
    const applyLevel = (next, nextFocus) => {
      level = next;
      focus = nextFocus;
      let k = 0;
      rowsEl.querySelectorAll('.tr-row').forEach((r) => {
        const i = Number(r.dataset.i);
        const show = i <= level;
        if (show && r.classList.contains('is-hidden') && !reduceMotion) {
          r.classList.remove('is-new');
          r.style.animationDelay = `${k * 0.14}s`;
          void r.offsetWidth;
          r.classList.add('is-new');
          k += 1;
        }
        r.classList.toggle('is-hidden', !show);
        r.classList.toggle('is-focus', Boolean(focus) && i >= focus[0] && i <= focus[1]);
      });
      const showTotal = level >= ALL;
      if (showTotal && totalRow.classList.contains('is-hidden')) {
        totalRow.classList.remove('is-hidden', 'is-stamp');
        if (!reduceMotion) {
          void totalRow.offsetWidth;
          totalRow.classList.add('is-stamp');
        }
        tweenTotal(0, 800);
      }
      totalRow.classList.toggle('is-hidden', !showTotal);
    };

    const render = () => {
      const hire = parseDate(hireEl.value);
      const offset = Number(termEl.value);
      const term = addDays(hire, offset);
      const salary = Number(salaryEl.value);
      const months = fullMonthsBetween(hire, term);
      const earned = LEAVE_DAYS_PER_MONTH * months;

      // Использованные дни не могут быть больше накопленных: верхняя граница ползунка двигается.
      usedEl.max = String(Math.max(1, Math.floor(earned)));
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
      total = net + severance;

      // Подписи и ползунки
      track.style.setProperty('--p', String(offset / MAX_DAYS));
      tl.querySelector('[data-term-label]').textContent = longDate(term);
      tl.querySelector('[data-span]').textContent = tenure(months);
      $('[data-salary-out]').textContent = money(salary);
      $('[data-used-out]').textContent = `${used} дн.`;
      $('[data-slip-period]').textContent = `${shortDate(hire)} → ${shortDate(term)}`;
      [salaryEl, usedEl].forEach(fillOf);
      checks.hidden = reason !== 'cut';

      const rows = [
        row(1, 'Отработано полных месяцев', `${months} мес.`, `с ${shortDate(hire)} по ${shortDate(term)}, остаток от 15 дней считается за месяц`),
        row(2, 'Дней отпуска к компенсации', `${NUM2.format(days)} дн.`, `28 ÷ 12 × ${months} мес. − ${used} использовано · ${law('ст. 127 ТК РФ', 'https://pravo.ppt.ru/kodeks/tk/st-127')}`),
        row(3, 'Средний дневной заработок', money(sdz), `${money(salary)} ÷ 29,3`),
        row(4, 'Компенсация до налога', money(gross), `${money(sdz)} × ${NUM2.format(days)} дн.`),
        row(5, 'НДФЛ 13%', `− ${money(ndfl)}`, `${money(gross)} × 13% · ${law('ст. 224 НК РФ', 'https://pravo.ppt.ru/kodeks/nk/st-224')}`, { minus: true }),
        row(6, 'Компенсация на руки', money(net), `${money(gross)} − ${money(ndfl)}`, { strong: true }),
      ];
      if (reason === 'cut') {
        rows.push(row(7, `Выходное пособие за ${sevMonths} мес.`, money(severance), `${money(salary)} × ${sevMonths} · ${law('ст. 178 ТК РФ', 'https://pravo.ppt.ru/kodeks/tk/st-178')}. НДФЛ не удерживается в пределах трёхкратного заработка (ст. 217 НК РФ)`, { strong: true, sep: true }));
      }
      rowsEl.innerHTML = rows.join('');
      // Итог виден только вместе с последней строкой: тогда и ставится печать.
      if (level < ALL) totalRow.classList.add('is-hidden');
      if (level >= ALL) tweenTotal(shown);
      else { stopTotal(); paintTotal(total); }
      miniEl.textContent = money(total);
    };

    // На ПК листок печатается вслед за прокруткой истории слева.
    const followStory = () => {
      if (!wide.matches) return;
      const line = window.innerHeight * 0.6;
      let idx = -1;
      steps.forEach((s, i) => {
        const r = s.getBoundingClientRect();
        if (r.top + r.height / 2 < line) idx = i;
      });
      const inPlay = playZone.getBoundingClientRect().top < line;
      steps.forEach((s, i) => s.classList.toggle('is-active', i === idx && !inPlay));
      if (inPlay) applyLevel(ALL, null);
      else if (idx < 0) applyLevel(0, null);
      else applyLevel(Number(steps[idx].dataset.reveal), RANGES[idx]);
    };
    // На планшете и телефоне история идёт списком, а листок печатается целиком, когда его видно.
    let printed = false;
    const printAll = () => {
      if (printed || wide.matches) return;
      printed = true;
      if (reduceMotion) return applyLevel(ALL, null);
      let n = level;
      const step = () => {
        if (wide.matches) return;
        n += 1;
        applyLevel(n, null);
        if (n < ALL) setTimeout(step, 230);
      };
      step();
    };
    watch(slip, (on) => { if (on) printAll(); }, '0px 0px -20% 0px');
    wide.addEventListener('change', () => {
      if (wide.matches) followStory();
      else { printed = true; applyLevel(ALL, null); }
    });

    // События
    [hireEl, termEl, salaryEl, usedEl, m2El, m3El].forEach((el) => el.addEventListener('input', () => {
      if (el === hireEl) renderTicks();
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
      stepsBtn.textContent = on ? 'Скрыть формулы' : 'Показать формулы по шагам';
    });
    new ResizeObserver(renderTicks).observe(track);

    renderTicks();
    render();
    onScroll(followStory);
  }

  /* ---------- 02 Ипотека: формулы из lib/calculators/ipoteka.ts ---------- */
  // Аннуитет A = P × r / (1 − (1 + r)^−n); при сокращении срока платёж прежний, а месяцы
  // находятся обращением той же формулы. Переплата считается так же, как на сайте.
  const annuity = (p, r, n) => (r === 0 ? p / n : (p * r) / (1 - Math.pow(1 + r, -n)));
  const monthsToPayOff = (p, r, pay) => {
    if (p <= 0) return 0;
    if (r === 0) return Math.ceil(p / pay);
    const ratio = 1 - (p * r) / pay;
    if (ratio <= 0) return Infinity;
    return Math.ceil(-Math.log(ratio) / Math.log(1 + r));
  };

  const wi = document.querySelector('[data-whatif]');
  if (wi) {
    const inputs = {};
    wi.querySelectorAll('[data-wi]').forEach((el) => { inputs[el.dataset.wi] = el; });
    const out = (key) => wi.querySelector(`[data-wi-out="${key}"]`);
    const savedEl = wi.querySelector('[data-wi-saved]');
    const meter = wi.querySelector('[data-wi-meter]');
    const bar = wi.querySelector('[data-wi-bar]');
    const stratBtns = [...wi.querySelectorAll('[data-strategy]')];
    let strategy = 'term';
    let shownSaved = 4089700;
    let stopSaved = () => {};

    const render = () => {
      const balance = Number(inputs.balance.value);
      const rate = Number(inputs.rate.value);
      const years = Number(inputs.years.value);
      const extra = Number(inputs.extra.value);
      const months = years * 12;
      const r = rate / 12 / 100;
      const pay0 = annuity(balance, r, months);
      const int0 = pay0 * months - balance;
      const rest = Math.max(balance - extra, 0);

      let saved;
      let intNew;
      let note;
      let payText;
      let termText;
      if (rest === 0) {
        saved = int0;
        intNew = 0;
        note = 'Доплата закрывает долг целиком';
        payText = `${money(pay0)} → 0 ₽`;
        termText = `${months} → 0 мес.`;
      } else if (strategy === 'term') {
        const n = monthsToPayOff(rest, r, pay0);
        intNew = pay0 * n - rest;
        saved = int0 - intNew;
        const cut = months - n;
        note = extra ? `Срок сократится на ${cut} мес.${cut >= 12 ? ` (${tenure(cut)})` : ''}` : 'Сдвиньте ползунок доплаты';
        payText = money(pay0);
        termText = `${months} → ${n} мес.`;
      } else {
        const pay1 = annuity(rest, r, months);
        intNew = pay1 * months - rest;
        saved = int0 - intNew;
        note = extra ? `Платёж станет меньше на ${money(pay0 - pay1)}` : 'Сдвиньте ползунок доплаты';
        payText = `${money(pay0)} → ${money(pay1)}`;
        termText = `${months} мес.`;
      }

      stopSaved();
      stopSaved = countTo(shownSaved, saved, 360, (v) => { shownSaved = v; savedEl.textContent = money(v); });
      meter.style.setProperty('--m', String(int0 > 0 ? saved / int0 : 0));
      bar.style.setProperty('--w', String(int0 > 0 ? intNew / int0 : 0));
      wi.querySelector('[data-wi-note]').textContent = note;
      wi.querySelector('[data-wi-before]').textContent = money(int0);
      wi.querySelector('[data-wi-after]').textContent = money(intNew);
      wi.querySelector('[data-wi-pay]').textContent = payText;
      wi.querySelector('[data-wi-term]').textContent = termText;

      out('extra').textContent = money(extra);
      out('balance').textContent = money(balance);
      out('rate').textContent = `${NUM1.format(rate)} %`;
      out('years').textContent = `${years} ${plural(years, 'год', 'года', 'лет')}`;
      Object.values(inputs).forEach(fillOf);
    };

    Object.values(inputs).forEach((el) => el.addEventListener('input', render));
    stratBtns.forEach((b) => b.addEventListener('click', () => {
      strategy = b.dataset.strategy;
      stratBtns.forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      placeAll();
      render();
    }));
    render();
  }

  /* ---------- 03 Каталог и просмотр ---------- */
  const cats = document.querySelector('[data-cats]');
  const grid = document.querySelector('[data-grid]');
  if (cats && grid) {
    const cards = [...grid.querySelectorAll('.tr-card')];
    cats.addEventListener('click', (e) => {
      const b = e.target.closest('[data-c]');
      if (!b) return;
      const c = b.dataset.c;
      cats.querySelectorAll('[data-c]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      let k = 0;
      cards.forEach((card) => {
        const on = c === 'all' || card.dataset.cat === c;
        card.classList.toggle('is-out', !on);
        if (!on) return;
        card.classList.add('is-visible');
        if (!reduceMotion && card.animate) {
          card.animate([{ opacity: 0, transform: 'translateY(16px) scale(0.98)' }, { opacity: 1, transform: 'none' }], { duration: 450, delay: Math.min(k, 8) * 45, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'backwards' });
        }
        k += 1;
      });
    });

    const lb = document.querySelector('[data-lb]');
    if (lb) {
      const img = lb.querySelector('[data-lb-img]');
      const catEl = lb.querySelector('[data-lb-cat]');
      const titleEl = lb.querySelector('[data-lb-title]');
      const countEl = lb.querySelector('[data-lb-count]');
      const prev = lb.querySelector('[data-lb-prev]');
      const next = lb.querySelector('[data-lb-next]');
      const closeBtn = lb.querySelector('.tr-lb__close');
      let list = [];
      let at = 0;
      let opener = null;

      const show = () => {
        const card = list[at];
        img.src = card.dataset.full;
        img.alt = card.querySelector('img').alt;
        catEl.textContent = card.dataset.catTitle;
        titleEl.textContent = card.dataset.title;
        countEl.textContent = `${at + 1} / ${list.length}`;
        prev.hidden = next.hidden = list.length < 2;
      };
      const open = (card) => {
        list = cards.filter((c) => !c.classList.contains('is-out'));
        at = Math.max(0, list.indexOf(card));
        opener = card;
        show();
        lb.hidden = false;
        document.body.classList.add('is-locked');
        closeBtn.focus();
      };
      const close = () => {
        lb.hidden = true;
        document.body.classList.remove('is-locked');
        if (opener) opener.focus();
      };
      const go = (d) => { at = (at + d + list.length) % list.length; show(); };

      grid.addEventListener('click', (e) => { const card = e.target.closest('.tr-card'); if (card) open(card); });
      lb.querySelectorAll('[data-lb-close]').forEach((b) => b.addEventListener('click', close));
      prev.addEventListener('click', () => go(-1));
      next.addEventListener('click', () => go(1));
      document.addEventListener('keydown', (e) => {
        if (lb.hidden) return;
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowLeft') go(-1);
        else if (e.key === 'ArrowRight') go(1);
        else if (e.key === 'Tab') {
          // Фокус не уходит со страницы под окном.
          const items = [closeBtn, prev, next].filter((b) => !b.hidden);
          const i = items.indexOf(document.activeElement);
          e.preventDefault();
          items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
        }
      });
      // Свайп по картинке листает на телефоне.
      let x0 = null;
      img.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
      img.addEventListener('pointerup', (e) => {
        if (x0 === null) return;
        const dx = e.clientX - x0;
        x0 = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      });
    }
  }

  /* ---------- 04 Метки на скриншоте ---------- */
  const anno = document.querySelector('[data-anno]');
  if (anno) {
    const pins = [...anno.querySelectorAll('.tr-pin')];
    const items = [...anno.querySelectorAll('.tr-anno__legend li')];
    let auto = 0;
    let idx = 0;
    let touched = false;
    pins.forEach((p, i) => p.style.setProperty('--d', `${i * 0.45}s`));

    const set = (n) => {
      pins.forEach((p) => p.classList.toggle('is-on', p.dataset.pin === n));
      items.forEach((li) => li.classList.toggle('is-on', li.dataset.pin === n));
    };
    const take = (n) => {
      touched = true;
      clearInterval(auto);
      set(n);
    };
    [...pins, ...items].forEach((el) => {
      el.addEventListener('pointerenter', () => take(el.dataset.pin));
      el.addEventListener('focus', () => take(el.dataset.pin));
      el.addEventListener('click', () => take(el.dataset.pin));
    });
    // Пока посетитель не трогал метки, они подсвечиваются по очереди сами.
    watch(anno, (on) => {
      clearInterval(auto);
      if (!on || touched || reduceMotion) return;
      set(pins[idx].dataset.pin);
      auto = setInterval(() => {
        idx = (idx + 1) % pins.length;
        set(pins[idx].dataset.pin);
      }, 2600);
    });
  }

  /* ---------- 05 Тёмная и светлая: шторка ---------- */
  const cmp = document.querySelector('[data-cmp]');
  if (cmp) {
    const range = cmp.querySelector('.tr-cmp__range');
    const btns = [...document.querySelectorAll('[data-theme-btns] button')];
    let timer = 0;
    let touched = false;

    const setPos = (v, anim) => {
      if (anim) {
        cmp.classList.add('is-anim');
        clearTimeout(timer);
        timer = setTimeout(() => cmp.classList.remove('is-anim'), 850);
      } else cmp.classList.remove('is-anim');
      cmp.style.setProperty('--pos', `${v}%`);
      range.value = String(v);
      btns.forEach((b) => b.setAttribute('aria-pressed', String((Number(b.dataset.to) === 100) === (v >= 50))));
    };
    range.addEventListener('input', () => { touched = true; setPos(Number(range.value), false); });
    btns.forEach((b) => b.addEventListener('click', () => { touched = true; setPos(Number(b.dataset.to), true); }));
    // При первом показе шторка проходит туда и обратно: видно, что тем две.
    if (!reduceMotion) {
      onVisible(cmp, () => {
        [[88, 0], [18, 950], [42, 1900]].forEach(([v, t]) => setTimeout(() => { if (!touched) setPos(v, true); }, t));
      }, 0.5);
    }
  }

  /* ---------- 06 Сцена устройств выезжает при прокрутке ---------- */
  const stage = document.querySelector('[data-stage]');
  if (stage && !reduceMotion) {
    onScroll(() => {
      const r = stage.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
      const p = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (r.height + window.innerHeight * 0.25)));
      stage.style.setProperty('--p', p.toFixed(3));
    });
  }

  /* ---------- 06 Экраны: страница и размер ---------- */
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
})();
