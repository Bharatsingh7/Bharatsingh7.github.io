// Boot sequence, typing subtitle, nav, scroll reveals, counters, skill hexes, tilt cards, contact form
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = s => document.querySelector(s);

  // ---------- boot ----------
  const boot = $('#boot'), bootLog = $('#boot-log'), fill = $('#boot-fill');
  const lines = [
    '> BIOS v7.7 // CYBERWOLF SYSTEMS',
    '> loading kernel modules ......... <span class="ok">OK</span>',
    '> mounting /dev/skills ............ <span class="ok">OK</span>',
    '> calibrating sensor fusion ....... <span class="ok">OK</span>',
    '> waking ARIA personality core .... <span class="ok">OK</span>',
    '> launching drone escort .......... <span class="ok">OK</span>',
    '> ACCESS GRANTED. Welcome, visitor.',
  ];
  let booted = false;
  function finishBoot() {
    if (booted) return;
    booted = true;
    boot.classList.add('done');
    setTimeout(() => window.ARIA && ARIA.greet(), 500);
  }
  if (reduce || location.hash || sessionStorageGet('booted')) {
    finishBoot();
  } else {
    let i = 0;
    const tick = () => {
      if (booted) return;
      bootLog.innerHTML += lines[i] + '\n';
      fill.style.width = `${((i + 1) / lines.length) * 100}%`;
      i++;
      if (i < lines.length) setTimeout(tick, 170 + Math.random() * 120);
      else setTimeout(finishBoot, 450);
    };
    tick();
    boot.addEventListener('click', finishBoot);
    addEventListener('keydown', finishBoot, { once: true });
    sessionStorageSet('booted', '1');
  }
  function sessionStorageGet(k) { try { return sessionStorage.getItem(k); } catch { return null; } }
  function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, v); } catch {} }

  // ---------- typer ----------
  const roles = ['Software Developer', 'Machine Vision & IoT', 'On-Device AI Engineer', 'Embedded Systems Tinkerer', 'IEEE Hackathon Winner'];
  const typer = $('#typer');
  let ri = 0, ci = 0, del = false;
  (function type() {
    const word = roles[ri];
    ci += del ? -1 : 1;
    typer.textContent = word.slice(0, ci);
    let wait = del ? 35 : 75;
    if (!del && ci === word.length) { del = true; wait = 1600; }
    else if (del && ci === 0) { del = false; ri = (ri + 1) % roles.length; wait = 300; }
    setTimeout(type, wait);
  })();

  // ---------- nav ----------
  const nav = $('.nav'), links = $('#nav-links'), burger = $('#burger');
  addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 40), { passive: true });
  burger.onclick = () => { burger.classList.toggle('open'); links.classList.toggle('open'); };
  links.addEventListener('click', e => { if (e.target.tagName === 'A') { burger.classList.remove('open'); links.classList.remove('open'); } });

  const navMap = new Map([...links.querySelectorAll('a')].map(a => [a.getAttribute('href').slice(1), a]));
  const secObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      navMap.forEach(a => a.classList.remove('active'));
      navMap.get(e.target.id)?.classList.add('active');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main section[id]').forEach(s => secObs.observe(s));

  // ---------- skills hex grid ----------
  const SKILLS = [
    ['Python', '🐍', 'lang', 'PRIMARY'], ['C++', '⚙️', 'lang', 'FIRMWARE'], ['Java', '☕', 'lang', 'CORE'], ['SQL', '🗄', 'lang', 'DATA'],
    ['PyTorch', '🔥', 'ai', 'TRAINING'], ['OpenCV', '👁', 'ai', 'VISION'], ['Whisper', '🎙', 'ai', 'SPEECH'], ['YOLO', '🎯', 'ai', 'DETECTION'],
    ['Ollama', '🦙', 'ai', 'LOCAL LLM'], ['NumPy', '🔢', 'ai', 'NUMERIC'], ['Pandas', '🐼', 'ai', 'DATA'],
    ['Raspberry Pi', '🍓', 'iot', 'EDGE'], ['Arduino', '🔌', 'iot', 'MCU'], ['ESP32', '📶', 'iot', 'WIRELESS'], ['MQTT', '📡', 'iot', 'PUB/SUB'],
    ['Sensor Fusion', '🧭', 'iot', 'MULTI-INPUT'], ['Linux', '🐧', 'sys', 'ARCH · DEBIAN'], ['Docker', '🐳', 'sys', 'CONTAINERS'],
    ['Git', '🌿', 'sys', 'VCS'], ['Bash', '💻', 'sys', 'SHELL'], ['CI/CD', '🔁', 'sys', 'PIPELINES'],
    ['Flask', '🧪', 'web', 'BACKEND'], ['REST APIs', '🔗', 'web', 'INTERFACES'], ['DSA · OOP', '🧩', 'web', 'FUNDAMENTALS'],
  ];
  const hexGrid = $('#hex-grid');
  hexGrid.innerHTML = SKILLS.map(([n, ic, cat, lv], i) =>
    `<div class="hex reveal" data-cat="${cat}" style="transition-delay:${(i % 8) * 40}ms"><div><span class="ic">${ic}</span><span class="nm">${n}</span><br><span class="lv">${lv}</span></div></div>`
  ).join('');
  $('#skill-tabs').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    document.querySelectorAll('#skill-tabs button').forEach(x => x.classList.toggle('on', x === b));
    hexGrid.querySelectorAll('.hex').forEach(h => h.classList.toggle('off', b.dataset.cat !== 'all' && h.dataset.cat !== b.dataset.cat));
  });

  // ---------- reveal + counters ----------
  const revObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      e.target.querySelectorAll('[data-count]').forEach(countUp);
      revObs.unobserve(e.target);
    });
  }, { threshold: .15 });
  document.querySelectorAll('.reveal').forEach(el => revObs.observe(el));

  function countUp(el) {
    const end = +el.dataset.count, dur = 1400, t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------- 3D tilt cards ----------
  if (!reduce && matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.tilt').forEach(card => {
      const shine = document.createElement('div');
      shine.className = 'shine';
      card.appendChild(shine);
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.transform = `rotateY(${(x - .5) * 18}deg) rotateX(${(.5 - y) * 18}deg) translateY(-4px)`;
        card.style.setProperty('--mx', `${x * 100}%`);
        card.style.setProperty('--my', `${y * 100}%`);
      });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
  }

  // ---------- contact (mailto) ----------
  $('#mail-form').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    const body = `${f.msg.value}\n\n— ${f.name.value}`;
    location.href = `mailto:bsbharatsingh52@gmail.com?subject=${encodeURIComponent(f.subject.value)}&body=${encodeURIComponent(body)}`;
  });

  $('#yr').textContent = new Date().getFullYear();
})();
