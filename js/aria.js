// ARIA's chat: every answer is built from the parsed resume, and each one tells the 3D robot which emote fits
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const list = a => a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
  const url = s => /^https?:\/\//.test(s) ? s : `https://${s}`;
  const STOP = new Set('a an and are about can do does did for from has have he her his how i in is it know knows me of on or she the their them they to use used uses what when where which who why with work worked you your ever any experience'.split(' '));

  let KB = null, D = null, first = 'Bharat';

  function build(d) {
    D = d;
    first = d.name.split(/\s+/)[0] || d.name;
    const allSkills = d.skills.flatMap(g => g.items);
    KB = {
      hello: { topic: 'hello', text: `Hi, I'm ARIA, the robot on ${first}'s desk. Ask me about skills, projects or experience, or tap a topic below.` },
      skills: {
        topic: 'skills',
        text: allSkills.length ? `${first} works mostly with ${list(allSkills.slice(0, 4))}. The full toolkit:` : `I couldn't find a skills section in the resume.`,
        html: d.skills.map(g => `<div class="kv"><span>${esc(g.label)}</span>${g.items.map(esc).join(', ')}</div>`).join(''),
      },
      projects: {
        topic: 'projects',
        text: d.projects.length
          ? `${d.projects.length === 1 ? 'One project' : `${d.projects.length} projects`}. ` + d.projects.map(p => `${p.name}: ${(p.bullets[0] || '').replace(/\.$/, '')}.`).join(' ')
          : 'No projects are listed in the resume yet.',
        html: d.projects.length ? '<a href="#projects">Read the write-ups</a>' : '',
      },
      experience: {
        topic: 'experience',
        text: d.experience.length
          ? d.experience.map(e => `${e.title}${e.subtitle ? ` at ${e.subtitle}` : ''}${e.dates ? ` (${e.dates})` : ''}. ${e.bullets[0] || ''}`).join(' ')
          : 'No work experience is listed in the resume.',
      },
      awards: {
        topic: 'awards',
        text: d.awards.length ? d.awards.map(a => a.text.replace(/\.$/, '')).join('. ') + '.' : 'No awards are listed in the resume.',
      },
      education: {
        topic: 'education',
        text: [
          ...d.education.map(e => `${e.degree}${e.school ? `, ${e.school}` : ''}${e.dates ? ` (${e.dates})` : ''}${e.score ? `, ${e.score}` : ''}.`),
          d.certifications.length ? `Certifications: ${list(d.certifications.map(c => c.title))}.` : '',
        ].join(' ').trim() || 'No education details in the resume.',
      },
      contact: {
        topic: 'contact',
        text: d.email ? 'Email works best. Bolt is bringing you the address.' : 'Here are the links.',
        html: [d.email && `<a href="mailto:${esc(d.email)}">${esc(d.email)}</a>`,
          d.linkedin && `<a href="${esc(url(d.linkedin))}" target="_blank" rel="noopener">LinkedIn</a>`,
          d.github && `<a href="${esc(url(d.github))}" target="_blank" rel="noopener">GitHub</a>`].filter(Boolean).join(' · '),
      },
      resume: { topic: 'resume', text: 'Bolt is fetching it. Fresh from the printer.', html: `<a href="${esc(d.source)}" download>Download my resume (PDF)</a>` },
      hire: {
        topic: 'hire',
        text: `${d.summary ? d.summary.split(/(?<=\.)\s/)[0] : `${first} builds things that work.`} Open to roles, and email is the fastest way to reach ${first}.`,
        html: d.email ? `<a href="mailto:${esc(d.email)}">Send an email</a>` : '',
      },
      who: { topic: 'who', text: `I'm ARIA, a few hundred lines of JavaScript with a three.js body. Everything I know comes from ${first}'s resume, and I run in your browser, with no AI service involved.` },
      fallback: { topic: 'unknown', text: "Hmm, that's not in my notes. Try skills, projects, experience, awards, education or contact." },
    };
  }

  const ROUTES = [
    [/^(hi|hey|hello|yo|namaste|sup|hii+)\b/, 'hello'],
    [/(who|what).*(you|aria)|are you (a )?(bot|robot|ai)/, 'who'],
    [/hackathon|award|achiev|\bwin|\bwon|prize|trophy|honou?r/, 'awards'],
    [/hire|why (should|him|her|them)|strength|good fit|available/, 'hire'],
    [/resume|\bcv\b|download|pdf/, 'resume'],
    [/contact|email|mail|reach|linkedin|github|phone|connect/, 'contact'],
    [/educat|degree|college|universit|cgpa|gpa|study|studied|cert|course/, 'education'],
    [/experien|job|work|intern|company|employ|mentor/, 'experience'],
    [/project|built|build|made/, 'projects'],
    [/skill|stack|tech|language|tools?\b/, 'skills'],
  ];

  // "does X know Y" → look for Y in skills first, then in every bullet of the resume
  function lookup(q) {
    const s = q.toLowerCase();
    for (const g of D.skills) for (const item of g.items) {
      const name = item.replace(/\s*\(.*\)/, '').toLowerCase();
      if (name.length > 1 && new RegExp(`(^|[^a-z0-9+#])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9+#])`).test(s)) {
        const where = [...D.projects.filter(p => p.bullets.join(' ').toLowerCase().includes(name) || p.stack.some(x => x.toLowerCase() === name)).map(p => p.name)];
        return { topic: 'yes', text: `Yes, ${item} is in ${first}'s ${g.label.toLowerCase()} toolkit.${where.length ? ` It shows up in ${list(where)}.` : ''}` };
      }
    }
    const words = s.replace(/[^a-z0-9+#.\s-]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w) && w.toLowerCase() !== first.toLowerCase());
    const sources = [
      ...D.projects.flatMap(p => p.bullets.map(b => [b, p.name])),
      ...D.experience.flatMap(e => e.bullets.map(b => [b, e.subtitle || e.title])),
      ...(D.summary ? [[D.summary, 'the summary']] : []),
    ];
    for (const w of words) {
      const hit = sources.find(([b]) => b.toLowerCase().includes(w));
      if (hit) return { topic: 'yes', text: `Yes. From ${hit[1]}: “${hit[0]}”` };
    }
    if (/\b(know|knows|use|used|uses|worked|experience with|familiar)\b/.test(s) && words.length) {
      return { topic: 'unknown', text: `I can't find ${words[words.length - 1]} anywhere in ${first}'s resume.` };
    }
    return null;
  }

  function answer(q) {
    const s = q.toLowerCase();
    for (const [re, key] of ROUTES.slice(0, 5)) if (re.test(s)) return KB[key];
    const hit = lookup(q);
    if (hit && hit.topic === 'yes') return hit;
    for (const [re, key] of ROUTES.slice(5)) if (re.test(s)) return KB[key];
    return hit || KB.fallback;
  }

  // ---------- chat log ----------
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
    dispatchEvent(new CustomEvent('aria:talk', { detail: { on: true, q, text: entry.text, topic: entry.topic } }));
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
        extra.className = 'extra';
        extra.innerHTML = entry.html;
        el.appendChild(extra);
        log.scrollTop = log.scrollHeight;
      }
      dispatchEvent(new CustomEvent('aria:talk', { detail: { on: false, topic: entry.topic } }));
      busy = false;
      if (queue.length) say(...queue.shift());
    };
    step();
  }

  function ask(q, entry) {
    if (!KB) return;
    addUser(q);
    setTimeout(() => say(entry || answer(q), q.toLowerCase()), 200);
  }

  $('#chips').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b && KB) ask(b.textContent.trim(), KB[b.dataset.q]);
  });
  $('#aria-form').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('#aria-text');
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    ask(q);
  });

  // the 3D room reports clicks on the robot and props; ARIA comments on some of them
  addEventListener('aria:say', e => say({ text: e.detail.text, topic: e.detail.topic || 'quip' }));

  addEventListener('resume:ready', e => {
    build(e.detail);
    setTimeout(() => say(KB.hello), 700);
  });
})();
