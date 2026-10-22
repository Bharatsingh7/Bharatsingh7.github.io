// Page behaviour: nav, scroll reveals, ARIA chat (talks to the 3D robot via events), project art canvases
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = s => document.querySelector(s);
  const CV = 'assets/Bharat_Singh_Bhati_Resume.pdf';

  // ---------- nav ----------
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('solid', scrollY > 40);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const navLinks = new Map([...document.querySelectorAll('.links a')].map(a => [a.hash.slice(1), a]));
  const secObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      navLinks.forEach(a => a.classList.remove('active'));
      navLinks.get(e.target.id)?.classList.add('active');
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  document.querySelectorAll('.column section[id]').forEach(s => secObs.observe(s));

  // ---------- reveal ----------
  // also catches elements skipped over by anchor jumps, which an IntersectionObserver can miss
  let revealQueued = false;
  function revealVisible() {
    revealQueued = false;
    document.querySelectorAll('.reveal:not(.in)').forEach(el => {
      if (el.getBoundingClientRect().top < innerHeight * .92) el.classList.add('in');
    });
  }
  addEventListener('scroll', () => { if (!revealQueued) { revealQueued = true; requestAnimationFrame(revealVisible); } }, { passive: true });
  revealVisible();

  // ---------- ARIA ----------
  const meter = rows => `<div class="meter">${rows.map(([n, w]) => `<div>${n}<i style="--w:${w}%"></i></div>`).join('')}</div>`;
  const KB = {
    hello: { text: "Hi, I'm ARIA, the robot on Bharat's desk. Ask me about his skills, projects or experience, or tap one of the topics below." },
    skills: {
      text: 'Python is his main language, with C++ for firmware. Most of his work sits where models meet hardware:',
      html: meter([['Python', 94], ['PyTorch, OpenCV', 86], ['Whisper, local LLMs', 84], ['Linux, Docker, Git', 85], ['C++, Arduino, ESP32', 82], ['MQTT, sensor fusion', 80]]),
    },
    projects: {
      text: 'Three main ones. CyberWolf is an offline voice assistant with a wake-word model he trained himself (over 95% accuracy). LumiSense is air-quality lighting on Arduino with MQTT. The Network Security Auditor maps networks and finds weak MAC filtering.',
      html: '<a href="#projects">Read the write-ups</a>',
    },
    experience: { text: 'Senior Software Developer at RAIOT Labs, Amity University Jaipur, from 2022 to 2026. He built 5+ IoT prototypes, including a robotic arm and a Raspberry Pi air-quality monitor, mentored 12+ junior developers and demoed 4 prototypes at exhibitions.' },
    awards: { text: '1st place at the IEEE Hackathon 2024 and 2nd place in 2023. He also competed in the CTF at IIT Roorkee Cognizance 2025 and led the Sun Bulls Future Energies event at Amity.' },
    education: { text: 'B.Tech in Computer Science and Engineering at Amity University Rajasthan (2022 to 2026), CGPA 7.7. Certified in Prompt Engineering for Developers (DeepLearning.AI) and the Robotron Robotics Course.' },
    contact: {
      text: 'Email works best.',
      html: '<a href="mailto:bsbharatsingh52@gmail.com">bsbharatsingh52@gmail.com</a> · <a href="https://linkedin.com/in/bharat-bhati1" target="_blank" rel="noopener">LinkedIn</a> · <a href="https://github.com/Bharatsingh7" target="_blank" rel="noopener">GitHub</a>',
    },
    resume: { text: 'Here you go, two pages.', html: `<a href="${CV}" download>Download the CV (PDF)</a>` },
    hire: {
      text: "He ships hardware and AI that run offline, he can teach it to others, and he wins hackathons. He's open to software, ML and IoT roles.",
      html: '<a href="mailto:bsbharatsingh52@gmail.com">Email him</a>',
    },
    who: { text: "I'm a few hundred lines of JavaScript with a three.js body. Everything I say runs in your browser, so no AI service is involved." },
    fallback: { text: "I don't have that one. Try skills, projects, experience, awards, education or contact." },
  };
  const TECH = {
    python: 'Yes. Python is his main language and shows up in every project.',
    'c\\+\\+|cpp': 'Yes. LumiSense runs on custom C++ firmware he wrote for Arduino.',
    java: 'Yes, Java is in the toolkit, along with Python, C++ and SQL.',
    sql: 'Yes, SQL and DBMS fundamentals.',
    pytorch: 'Yes. He trained a wake-word and voice-signature model from scratch in PyTorch, with over 95% accuracy.',
    opencv: 'Yes. CyberWolf uses OpenCV face recognition as a second identity check.',
    'whisper|speech|stt': 'Yes. CyberWolf uses faster-whisper for local speech-to-text.',
    'llm|llama|ollama|lm studio|gpt': 'Yes. He runs Llama 3.2 locally through LM Studio, and uses Ollama.',
    yolo: 'Yes, YOLO is part of his computer vision toolkit.',
    'raspberry|\\bpi\\b': 'Yes. He deployed an air-quality monitor on Raspberry Pi at RAIOT Labs.',
    'arduino|esp32|embedded|firmware': 'Yes. Arduino and ESP32, with custom C++ firmware and multiple sensors.',
    mqtt: 'Yes. LumiSense publishes its readings over MQTT.',
    docker: 'Yes, Docker is part of his everyday tooling.',
    'linux|arch|debian|bash': 'Yes. He uses Arch and Debian daily and is comfortable in Bash.',
    'flask|rest|api|web': 'Yes, Flask and REST APIs.',
    'security|network|ctf|hack(?!athon)': 'Yes. He built the Network Security Auditor and played the CTF at IIT Roorkee Cognizance 2025.',
    'robot|arm': 'Yes. He built a programmable robotic arm at RAIOT Labs.',
  };
  const ROUTES = [
    [/^(hi|hey|hello|yo|namaste|sup)\b/, 'hello'],
    [/(who|what).*(you|aria)|are you (a )?(bot|robot|ai)/, 'who'],
    [/hackathon|award|achiev|\bwin|\bwon|prize|trophy|ieee/, 'awards'],
    [/hire|why (should|him)|strength|good fit|available/, 'hire'],
    [/resume|\bcv\b|download|pdf/, 'resume'],
    [/contact|email|mail|reach|linkedin|github|phone|connect/, 'contact'],
    [/educat|degree|college|universit|cgpa|gpa|study|cert/, 'education'],
    [/experien|job|work|intern|raiot|lab|mentor/, 'experience'],
    [/project|built|build|cyberwolf|lumisense|auditor/, 'projects'],
    [/skill|stack|tech|know|language|tools?/, 'skills'],
  ];
  function answer(q) {
    const s = q.toLowerCase();
    for (const [re, key] of ROUTES.slice(0, 4)) if (re.test(s)) return KB[key];
    for (const k in TECH) if (new RegExp(k).test(s)) return { text: TECH[k] };
    for (const [re, key] of ROUTES.slice(4)) if (re.test(s)) return KB[key];
    return KB.fallback;
  }

  const log = $('#aria-log');
  let busy = false;
  const queue = [];

  function addUser(text) {
    const el = document.createElement('div');
    el.className = 'msg user';
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function say(entry, q = '') {
    if (busy) { queue.push([entry, q]); return; }
    busy = true;
    dispatchEvent(new CustomEvent('aria:talk', { detail: { on: true, q, text: entry.text } }));
    const el = document.createElement('div');
    el.className = 'msg bot';
    log.appendChild(el);
    let i = 0;
    const step = () => {
      i = reduce ? entry.text.length : i + 2;
      el.textContent = entry.text.slice(0, i);
      log.scrollTop = log.scrollHeight;
      if (i < entry.text.length) return setTimeout(step, 18);
      if (entry.html) {
        const extra = document.createElement('div');
        extra.innerHTML = entry.html;
        el.appendChild(extra);
        log.scrollTop = log.scrollHeight;
      }
      dispatchEvent(new CustomEvent('aria:talk', { detail: { on: false } }));
      busy = false;
      if (queue.length) say(...queue.shift());
    };
    step();
  }

  $('#chips').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    addUser(b.textContent.trim());
    say(KB[b.dataset.q], b.textContent.trim().toLowerCase());
  });
  $('#aria-form').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('#aria-text');
    const q = input.value.trim();
    if (!q) return;
    addUser(q);
    input.value = '';
    setTimeout(() => say(answer(q), q), 200);
  });
  const quips = [
    "That tickles. I'm more useful if you ask me something.",
    'The drone following your cursor is my little sibling. It means well.',
    'Bharat taught a computer to recognise his voice before he built me. I try not to take it personally.',
  ];
  let quip = 0;
  addEventListener('aria:poke', () => say({ text: quips[quip++ % quips.length] }));
  setTimeout(() => say(KB.hello), 900);

  // ---------- project art ----------
  const C = { a: '#ff9e64', b: '#b69cff', m: '#7ee0c3', t: 'rgba(236,233,244,.55)' };
  const ARTS = {
    wave(ctx, w, h, t) {
      const n = 56, bw = w / n;
      for (let i = 0; i < n; i++) {
        const env = Math.exp(-Math.pow((i - n / 2) / (n / 4.5), 2));
        const v = env * (Math.sin(i * .5 + t * 3.2) * .35 + .65) * (Math.sin(t * 1.3 + i * .15) * .25 + .75);
        const bh = Math.max(3, v * h * .62);
        const g = ctx.createLinearGradient(0, h / 2 - bh / 2, 0, h / 2 + bh / 2);
        g.addColorStop(0, C.a); g.addColorStop(1, C.b);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(i * bw + bw * .22, h / 2 - bh / 2, bw * .56, bh, bw * .28);
        ctx.fill();
      }
      ctx.fillStyle = C.t; ctx.font = '500 11px JetBrains Mono';
      ctx.fillText('wake word: "wolf"', 16, 24);
      ctx.fillText(`confidence ${(95.4 + Math.sin(t) * 1.8).toFixed(1)}%`, 16, h - 16);
    },
    orb(ctx, w, h, t) {
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .34, N = 80;
      const aq = Math.sin(t * .35) * .5 + .5;
      const hue = 165 - aq * 140;
      const pts = [];
      for (let i = 0; i < N; i++) {
        const phi = Math.acos(1 - 2 * (i + .5) / N), th = 2.39996 * i + t * .35;
        pts.push({ x: cx + Math.sin(phi) * Math.cos(th) * R, y: cy + Math.cos(phi) * R, z: Math.sin(phi) * Math.sin(th) });
      }
      ctx.lineWidth = .7;
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d > R * .45) continue;
        ctx.strokeStyle = `hsla(${hue},80%,70%,${(1 - d / (R * .45)) * .35 * ((pts[i].z + pts[j].z) / 4 + .5)})`;
        ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
      }
      for (const p of pts) {
        ctx.fillStyle = `hsla(${hue},85%,72%,${.35 + (p.z + 1) * .3})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.4 + (p.z + 1) * .9, 0, 7); ctx.fill();
      }
      ctx.fillStyle = C.t; ctx.font = '500 11px JetBrains Mono';
      ctx.fillText(`AQI ${Math.round(30 + aq * 160)} · CO ${(aq * 8).toFixed(1)} ppm · PM2.5 ${Math.round(8 + aq * 80)}`, 16, h - 16);
    },
    radar(ctx, w, h, t) {
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .4;
      ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(cx, cy, R * i / 3, 0, 7); ctx.stroke(); }
      const a = t * 1.1;
      const g = ctx.createConicGradient(a - .9, cx, cy);
      g.addColorStop(0, 'rgba(126,224,195,0)'); g.addColorStop(.143, 'rgba(126,224,195,.28)'); g.addColorStop(.1431, 'rgba(126,224,195,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
      const hosts = [[.35, .8], [.7, 2.1], [.9, 3.4], [.5, 4.4], [.75, 5.5], [.25, 2.9]];
      ctx.font = '500 10px JetBrains Mono';
      hosts.forEach(([r, ang], i) => {
        const diff = ((a - ang) % 6.283 + 6.283) % 6.283;
        const glow = Math.max(0, 1 - diff / 3);
        const x = cx + Math.cos(ang) * R * r, y = cy + Math.sin(ang) * R * r, weak = i % 3 === 1;
        ctx.fillStyle = weak ? `rgba(255,158,100,${.3 + glow * .7})` : `rgba(126,224,195,${.3 + glow * .7})`;
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill();
        if (glow > .4) { ctx.fillStyle = C.t; ctx.fillText(weak ? 'weak MAC filter' : `192.168.0.${10 + i * 17}`, x + 8, y - 6); }
      });
      ctx.fillStyle = C.t; ctx.font = '500 11px JetBrains Mono';
      ctx.fillText('6 hosts · 2 weak', 16, h - 16);
    },
  };

  const arts = [...document.querySelectorAll('.art canvas')].map(cv => ({ cv, ctx: cv.getContext('2d'), fn: ARTS[cv.dataset.art], on: false }));
  function sizeArts() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    arts.forEach(a => {
      const r = a.cv.getBoundingClientRect();
      a.w = r.width; a.h = r.height;
      a.cv.width = r.width * dpr; a.cv.height = r.height * dpr;
      a.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
  }
  addEventListener('resize', sizeArts);
  sizeArts();
  const artObs = new IntersectionObserver(es => es.forEach(e => {
    const a = arts.find(x => x.cv === e.target);
    a.on = e.isIntersecting;
  }));
  arts.forEach(a => artObs.observe(a.cv));
  let t = 0;
  (function loop() {
    t += 1 / 60;
    arts.forEach(a => {
      if (!a.on || !a.w) return;
      a.ctx.clearRect(0, 0, a.w, a.h);
      a.fn(a.ctx, a.w, a.h, t);
    });
    if (!reduce) requestAnimationFrame(loop);
  })();
  if (reduce) arts.forEach(a => a.w && a.fn(a.ctx, a.w, a.h, 1));

  $('#yr').textContent = new Date().getFullYear();
})();
