// ARIA — SVG robot: head/eye tracking, blinking, talking mouth, and a local keyword-matching chat
(() => {
  const svg = document.getElementById('aria');
  const head = document.getElementById('aria-head');
  const pupils = svg.querySelectorAll('.pupil');
  const eyes = svg.querySelectorAll('.eye');
  const mouth = svg.querySelectorAll('.mb');
  const log = document.getElementById('chat-log');
  const status = document.getElementById('chat-status');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-text');
  const RESUME = 'assets/Bharat_Singh_Bhati_Resume.pdf';

  // ---------- look at cursor ----------
  addEventListener('mousemove', e => {
    const r = svg.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height * .3;
    const dx = (e.clientX - cx) / innerWidth, dy = (e.clientY - cy) / innerHeight;
    head.style.transform = `rotate(${dx * 14}deg) translate(${dx * 10}px, ${dy * 6}px)`;
    const px = Math.max(-6, Math.min(6, dx * 22)), py = Math.max(-6, Math.min(6, dy * 22));
    pupils.forEach(p => p.style.transform = `translate(${px}px, ${py}px)`);
  });

  (function blink() {
    eyes.forEach(e => { e.classList.remove('blink'); void e.getBBox(); e.classList.add('blink'); });
    setTimeout(blink, 2200 + Math.random() * 3000);
  })();

  // ---------- knowledge base ----------
  const bar = (name, pct) => `<div class="bar">${name}<i style="--w:${pct}%"></i></div>`;
  const KB = {
    hello: {
      text: "Hi! I'm ARIA, Bharat's on-board AI. I can brief you on his skills, missions, experience or awards — tap a chip below or just ask me anything.",
    },
    skills: {
      text: "Scanning skill matrix… Bharat's primary language is Python, backed by C++. He works across AI/ML, embedded systems and Linux tooling:",
      html: `<div class="bars">${bar('Python', 94)}${bar('PyTorch / OpenCV', 86)}${bar('Embedded C++ · Arduino · ESP32', 82)}${bar('Whisper · Local LLMs · YOLO', 84)}${bar('Linux · Docker · Git · Bash', 85)}${bar('MQTT · Sensor Fusion', 80)}</div>`,
    },
    projects: {
      text: "Three headline missions: 🐺 CyberWolf — a fully offline voice assistant with a wake-word model he trained from scratch (>95% accuracy), local Whisper + Llama 3.2 and face verification. 💡 LumiSense — air-quality-reactive lighting on Arduino with MQTT. 🛰 Network Security Auditor — a Python recon tool that maps networks and finds MAC-filtering weaknesses.",
      html: `<a href="#projects">Open mission logs →</a>`,
    },
    experience: {
      text: "Senior Software Developer at RAIOT Labs, Amity University Jaipur (2022–2026). He built 5+ IoT prototypes — including a programmable robotic arm and an air-quality monitor on Raspberry Pi — mentored 12+ junior devs, and presented 4 prototypes at technical exhibitions.",
    },
    achievements: {
      text: "🥇 1st Place — IEEE Hackathon 2024. 🥈 2nd Place — IEEE Hackathon 2023. Lead Organizer of the Sun Bulls Future Energies event at Amity, and CTF + TechZibition participant at IIT Roorkee Cognizance 2025.",
    },
    education: {
      text: "B.Tech in Computer Science & Engineering, Amity University Rajasthan (2022–2026), CGPA 7.7/10. Certifications: Prompt Engineering for Developers (DeepLearning.AI, 2024) and the Robotron Robotics Course (2023).",
    },
    contact: {
      text: "Opening comm channels…",
      html: `✉ <a href="mailto:bsbharatsingh52@gmail.com">bsbharatsingh52@gmail.com</a><br>in <a href="https://linkedin.com/in/bharat-bhati1" target="_blank" rel="noopener">linkedin.com/in/bharat-bhati1</a><br>⌥ <a href="https://github.com/Bharatsingh7" target="_blank" rel="noopener">github.com/Bharatsingh7</a>`,
    },
    resume: {
      text: "Here's the full dossier — two pages, PDF.",
      html: `<a href="${RESUME}" download>⇩ Download Bharat_Singh_Bhati_Resume.pdf</a>`,
    },
    hire: {
      text: "Short version: he ships working hardware + AI that runs offline, he can teach it to others, and he wins hackathons. He's open to software, ML and IoT roles — the fastest route is email.",
      html: `<a href="mailto:bsbharatsingh52@gmail.com">Send a transmission →</a>`,
    },
    who: {
      text: "I'm ARIA — Autonomous Résumé Interface Assistant. A few hundred lines of JavaScript with very nice eyes. Everything I say runs locally in your browser.",
    },
    fallback: {
      text: "Hmm, that's outside my data banks. Try asking about skills, projects, experience, awards, education, contact — or grab the resume.",
    },
  };

  // single-skill lookups give a precise yes/no answer
  const TECH = {
    python: 'Python is his primary language — used across every project, from PyTorch training to IoT prototypes.',
    'c\\+\\+|cpp': 'Yes — C++ for embedded firmware, e.g. LumiSense runs custom C++ on Arduino.',
    java: 'Yes, Java is in his toolkit alongside Python, C++ and SQL.',
    sql: 'Yes — SQL and DBMS fundamentals.',
    pytorch: 'Yes — he trained a custom wake-word + voice-signature model from scratch in PyTorch (>95% accuracy).',
    opencv: 'Yes — OpenCV face recognition for multi-factor identity verification in CyberWolf.',
    'whisper|speech|stt': 'Yes — faster-whisper running locally for speech-to-text in CyberWolf.',
    'llm|llama|ollama|lm studio|gpt': 'Yes — Llama 3.2 via LM Studio for on-device inference, plus Ollama.',
    yolo: 'Yes, YOLO is part of his computer-vision toolkit.',
    'raspberry|pi\\b': 'Yes — edge deployments on Raspberry Pi at RAIOT Labs, including an air-quality monitor.',
    'arduino|esp32|embedded|firmware': 'Yes — Arduino and ESP32 with custom C++ firmware and multi-sensor integration.',
    mqtt: 'Yes — MQTT publishing for remote monitoring in LumiSense.',
    docker: 'Yes — Docker is part of his everyday tooling.',
    'linux|arch|debian|bash': 'Yes — daily driver is Linux (Arch & Debian), comfortable in Bash.',
    'flask|rest|api|web': 'Yes — Flask and REST APIs for the web side.',
    'security|network|ctf|hack(?!athon)': 'Yes — he built a Network Security Auditor and competed in the CTF at IIT Roorkee Cognizance 2025.',
    'robot|arm': 'Yes — he built a programmable robotic arm at RAIOT Labs and completed the Robotron Robotics Course.',
  };

  const ROUTES = [
    [/^(hi|hey|hello|yo|namaste|sup)\b/, 'hello'],
    [/(who|what).*(you|aria)|are you (a )?bot/, 'who'],
    [/hackathon|award|achiev|win|won|prize|trophy|ieee/, 'achievements'],
    [/hire|why (should|him)|strength|good fit|available/, 'hire'],
    [/resume|cv|download|pdf/, 'resume'],
    [/contact|email|mail|reach|linkedin|github|phone|connect/, 'contact'],
    [/educat|degree|college|universit|cgpa|gpa|study|cert/, 'education'],
    [/experien|job|work|intern|raiot|lab|mentor/, 'experience'],
    [/project|built|build|mission|cyberwolf|lumisense|portfolio/, 'projects'],
    [/skill|stack|tech|know|language|tools?/, 'skills'],
  ];

  function answer(q) {
    const s = q.toLowerCase();
    for (const [re, key] of ROUTES.slice(0, 3)) if (re.test(s)) return KB[key];
    for (const k in TECH) if (new RegExp(k).test(s)) return { text: TECH[k] };
    for (const [re, key] of ROUTES.slice(3)) if (re.test(s)) return KB[key];
    return KB.fallback;
  }

  // ---------- chat rendering ----------
  let busy = false, queue = [];
  function addUser(text) {
    const el = document.createElement('div');
    el.className = 'msg user';
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function talk(on) {
    svg.classList.toggle('talking', on);
    status.textContent = on ? 'TRANSMITTING' : 'IDLE';
    status.classList.toggle('busy', on);
  }

  function say(entry) {
    if (busy) { queue.push(entry); return; }
    busy = true;
    talk(true);
    const el = document.createElement('div');
    el.className = 'msg bot';
    el.innerHTML = '<span class="who">ARIA ▸</span><span class="tx"></span>';
    log.appendChild(el);
    const tx = el.querySelector('.tx');
    let i = 0;
    const text = entry.text;
    const step = () => {
      i += 2;
      tx.textContent = text.slice(0, i);
      mouth.forEach((m, k) => m.style.transform = `scaleY(${1 + Math.random() * (k === 2 ? 3.5 : 2.4)})`);
      log.scrollTop = log.scrollHeight;
      if (i < text.length) setTimeout(step, 16);
      else {
        mouth.forEach(m => m.style.transform = '');
        if (entry.html) {
          const extra = document.createElement('div');
          extra.style.marginTop = '.45rem';
          extra.innerHTML = entry.html;
          el.appendChild(extra);
        }
        log.scrollTop = log.scrollHeight;
        talk(false);
        busy = false;
        if (queue.length) say(queue.shift());
      }
    };
    step();
  }

  document.getElementById('chips').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    addUser(b.textContent.trim());
    say(KB[b.dataset.q]);
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;
    addUser(q);
    input.value = '';
    setTimeout(() => say(answer(q)), 250);
  });

  // poke the robot
  svg.addEventListener('click', () => {
    const quips = [
      { text: "Ow — careful, that's my antenna. Ask me something instead 🙂" },
      { text: 'Fun fact: Bharat taught a computer to recognise his voice before teaching it to say hello.' },
      { text: "Psst — the drone following your cursor is my little sibling. It's harmless. Mostly." },
    ];
    say(quips[Math.floor(Math.random() * quips.length)]);
  });

  window.ARIA = { greet: () => say(KB.hello) };
})();
