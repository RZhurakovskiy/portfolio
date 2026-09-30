(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Мобильное меню ---------- */
  const burger = document.querySelector('[data-burger]');
  const menu = document.querySelector('[data-mobile-menu]');
  const header = document.querySelector('[data-header]');

  const setMenu = (open) => {
    if (!burger || !menu) return;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    menu.classList.toggle('is-open', open);
    menu.toggleAttribute('inert', !open);
    menu.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('is-locked', open);
    if (header) header.classList.toggle('is-menu-open', open);
    if (open) menu.focus({ preventScroll: true });
  };

  if (burger && menu) {
    burger.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu && menu.classList.contains('is-open')) {
      setMenu(false);
      burger.focus();
    }
  });
  window.matchMedia('(min-width: 1101px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  /* ---------- Заголовок героя по словам ---------- */
  const heroTitle = document.querySelector('.hero__title');
  if (heroTitle && !reduceMotion) {
    const words = heroTitle.textContent.trim().split(/\s+/);
    heroTitle.setAttribute('aria-label', heroTitle.textContent.trim());
    heroTitle.innerHTML = words
      .map((w, i) => `<span class="word" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`)
      .join(' ');
  }

  /* ---------- Появление при скролле ---------- */
  const reveals = document.querySelectorAll('.reveal');

  // Соседние элементы появляются лесенкой
  reveals.forEach((el) => {
    const siblings = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
    const index = siblings.indexOf(el);
    if (index > 0) el.style.setProperty('--delay', `${Math.min(index, 5) * 0.09}s`);
  });

  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------- Активный пункт навигации: перетекающая капсула ---------- */
  const nav = document.querySelector('[data-nav]');
  if (nav) {
    const pill = nav.querySelector('.nav__pill');
    const navLinks = [...nav.querySelectorAll('a')];
    const sections = navLinks
      .map((a) => {
        const href = a.getAttribute('href');
        return href.startsWith('#') ? document.querySelector(href) : null;
      })
      .filter(Boolean);

    let activeLink = null;
    let hoverLink = null;

    const movePill = () => {
      const target = hoverLink || activeLink;
      if (!target) {
        pill.classList.remove('is-on');
        return;
      }
      pill.style.setProperty('--pill-x', `${target.offsetLeft}px`);
      pill.style.setProperty('--pill-w', `${target.offsetWidth}px`);
      pill.classList.add('is-on');
      pill.classList.toggle('is-hover', Boolean(hoverLink) && hoverLink !== activeLink);
    };

    const setActive = (link) => {
      activeLink = link;
      navLinks.forEach((a) => a.classList.toggle('is-active', a === link));
      movePill();
    };

    navLinks.forEach((a) => {
      a.addEventListener('pointerenter', () => { hoverLink = a; movePill(); });
      a.addEventListener('focus', () => { hoverLink = a; movePill(); });
      a.addEventListener('blur', () => { hoverLink = null; movePill(); });
    });
    nav.addEventListener('pointerleave', () => { hoverLink = null; movePill(); });

    if ('IntersectionObserver' in window) {
      const byPage = [...sections].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      const visible = new Set();
      const navIO = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        });
        const current = byPage.filter((s) => visible.has(s)).at(-1);
        setActive(current ? navLinks.find((a) => a.getAttribute('href') === `#${current.id}`) : null);
      }, { rootMargin: '-40% 0px -45% 0px' });
      byPage.forEach((s) => navIO.observe(s));
    }

    // Капсула пересчитывается, когда шапка меняет размер
    new ResizeObserver(movePill).observe(nav);
  }

  /* ---------- Скролл: шапка, прогресс, параллакс ---------- */
  const progress = document.querySelector('[data-progress]');
  const parallaxItems = [...document.querySelectorAll('[data-parallax]')].map((el) => ({
    el,
    speed: parseFloat(el.dataset.parallax) || 0,
    mouse: parseFloat(el.dataset.mouse) || 0,
  }));

  let mouseX = 0;
  let mouseY = 0;
  let ticking = false;

  const render = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;

    if (header) header.classList.toggle('is-scrolled', y > 40);

    if (progress) progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;

    if (!reduceMotion) {
      const vh = window.innerHeight;
      parallaxItems.forEach(({ el, speed, mouse }) => {
        const rect = el.parentElement.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) return;
        const offset = (rect.top + rect.height / 2 - vh / 2) * speed * -1;
        el.style.transform = `translate3d(${mouseX * mouse}px, ${offset + mouseY * mouse}px, 0)`;
      });
    }

    ticking = false;
  };

  const requestRender = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(render);
  };

  window.addEventListener('scroll', requestRender, { passive: true });
  window.addEventListener('resize', requestRender);
  render();

  /* ---------- Мышь: блобы, подсветка карточки, наклон телефона ---------- */
  const hero = document.querySelector('[data-hero]');
  if (hero && finePointer && !reduceMotion) {
    const manifest = document.querySelector('.manifest');
    const tilt = document.querySelector('[data-tilt]');

    hero.addEventListener('pointermove', (e) => {
      mouseX = e.clientX / window.innerWidth - 0.5;
      mouseY = e.clientY / window.innerHeight - 0.5;
      requestRender();

      if (tilt) {
        tilt.style.transform = `perspective(1000px) rotateY(${mouseX * 10}deg) rotateX(${mouseY * -8}deg)`;
      }
    });

    hero.addEventListener('pointerleave', () => {
      mouseX = 0;
      mouseY = 0;
      requestRender();
      if (tilt) tilt.style.transform = '';
    });

    if (manifest) {
      manifest.addEventListener('pointermove', (e) => {
        const r = manifest.getBoundingClientRect();
        manifest.style.setProperty('--mx', `${e.clientX - r.left}px`);
        manifest.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    }
  }

  /* ---------- Скриншоты в рамках телефонов ---------- */
  // Если картинка не загрузилась — убираем её, чтобы осталась заглушка
  document.querySelectorAll('.phone__screen img').forEach((img) => {
    img.addEventListener('error', () => img.remove(), { once: true });
  });

  /* ---------- Год в подвале ---------- */
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
