// Renders the page from data/resume.json (written from the resume PDF) plus data/extras.json (hand-edited bits)
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const url = s => /^https?:\/\//.test(s) ? s : `https://${s}`;

  // project art: explicit in extras, else the first keyword match not already used by another project,
  // else the next unused art in an order seeded by the project's name. New projects get their own animation.
  const ART_RULES = [
    ['wave', /voice|speech|whisper|audio|wake|music|sound/],
    ['growth', /plant|agri|farm|soil|crop|garden|nature|tree/],
    ['flow', /vision|camera|image|yolo|opencv|detect|neural|deep learning/],
    ['orb', /sensor|iot|mqtt|arduino|esp32|air|weather|smart home/],
    ['radar', /network|security|scan|ctf|vulnerab|wi-?fi|recon/],
    ['gears', /robot|servo|motor|mechan|automation|actuator/],
    ['packets', /web|api|server|backend|cloud|chat|socket|app\b|distributed/],
    ['pulse', /health|heart|medical|ecg|fitness|\bbio/],
    ['bars', /data|analytic|dashboard|finance|stock|predict|model/],
    ['orbit', /satellite|gps|space|drone|navigation|tracking/],
    ['terrain', /map|terrain|game|world|lidar|slam|3d/],
    ['circuit', /embedded|firmware|pcb|hardware|fpga|microcontroller/],
  ];
  const ART_POOL = ART_RULES.map(r => r[0]);
  const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  function artFor(p, used, forced) {
    if (forced) return forced;
    const t = `${p.name} ${p.bullets.join(' ')} ${p.stack.join(' ')}`.toLowerCase();
    const hit = ART_RULES.find(([art, re]) => !used.has(art) && re.test(t));
    if (hit) return hit[0];
    const start = hash(p.name) % ART_POOL.length;
    for (let i = 0; i < ART_POOL.length; i++) { const art = ART_POOL[(start + i) % ART_POOL.length]; if (!used.has(art)) return art; }
    return ART_POOL[start];
  }
  // bento layout: blocks of [feature + two small], [two halves], [three thirds], repeating; short last blocks stretch
  function sizes(n) {
    const out = [], blocks = [['xl', 's', 's'], ['m', 'm'], ['t', 't', 't']];
    for (let i = 0, b = 0; i < n; b++) {
      const block = blocks[b % 3], k = Math.min(block.length, n - i);
      if (k === block.length) out.push(...block);
      else if (k === 1) out.push('full');
      else out.push('m', 'm');
      i += k;
    }
    return out;
  }
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'project';
  const firstSentence = s => (s.match(/^.*?[.!?](\s|$)/) || [s])[0].trim();

  function render(d, x) {
    const first = d.name.split(/\s+/)[0] || d.name;
    document.title = d.name;
    $('#h-name').textContent = d.name;
    $('#f-name').textContent = d.name;
    $('#mark').textContent = d.name.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();
    $('#h-eyebrow').outerHTML = `<span id="h-eyebrow">${esc([d.titleParts[0], d.location.split(',')[0]].filter(Boolean).join(' · '))}</span>`;
    if (x.lede) $('#h-lede').textContent = x.lede;
    $('#h-sub').textContent = d.summary
      ? (d.summary.length > 240 ? d.summary.split(/(?<=[.!?])\s+/).reduce((a, s) => (a + s).length < 240 ? `${a}${s} ` : a, '').trim() || firstSentence(d.summary) : d.summary)
      : d.titleParts.join(', ');
    $('#aria-text').placeholder = `Ask anything, e.g. does ${first} know Python?`;

    document.querySelectorAll('.resume-link').forEach(a => { a.href = d.source; a.setAttribute('download', d.source.split('/').pop()); });

    // projects
    const used = new Set(), size = sizes(d.projects.length);
    const projects = d.projects.map((p, i) => {
      const key = Object.keys(x.projects || {}).find(k => p.name.toLowerCase().includes(k.toLowerCase()));
      const extra = key ? x.projects[key] : {};
      const art = artFor(p, used, extra.art);
      used.add(art);
      const hue = Math.round((150 + i * 137.5) % 360);
      const tagline = extra.tagline || '';
      const bullets = tagline ? p.bullets : p.bullets.slice(1);
      return `
      <article class="project reveal size-${size[i]} enter-${i % 4}" style="--h:${hue};transition-delay:${(i % 3) * 90}ms">
        <div class="tilt">
          <div class="art"><canvas data-art="${esc(art)}" data-hue="${hue}"></canvas><span class="file">${esc(slug(p.name))}.${art}</span></div>
          <div class="project-body">
            <p class="when">${esc(p.dates || p.stack.slice(0, 2).join(' · '))}</p>
            <h3>${esc(p.name)}</h3>
            <p class="tagline">${esc(tagline || p.bullets[0] || '')}</p>
            ${p.stack.length ? `<p class="stack">${p.stack.slice(0, 6).map(s => `<span>${esc(s)}</span>`).join('')}</p>` : ''}
            ${bullets.length ? `<details><summary>Highlights</summary><ul>${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul></details>` : ''}
          </div>
        </div>
      </article>`;
    }).join('');
    $('#project-list').innerHTML = projects;
    $('#projects').hidden = !d.projects.length;

    // experience + education
    const jobs = d.experience.map(e => `
      <article class="job card reveal">
        <h3>${esc(e.subtitle || e.title)}</h3>
        ${e.subtitle ? `<p class="role">${esc(e.title)}</p>` : ''}
        ${e.dates ? `<p class="when">${esc(e.dates.replace('–', ' to '))}</p>` : ''}
        ${e.bullets.length ? `<ul class="bars">${e.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
      </article>`);
    const edu = d.education.map(e => `
      <article class="job card reveal">
        <h3>${esc(e.school || e.degree)}</h3>
        ${e.school ? `<p class="role">${esc(e.degree)}</p>` : ''}
        <p class="when">${esc([e.dates.replace('–', ' to '), e.score].filter(Boolean).join(' · '))}</p>
      </article>`);
    $('#exp-list').innerHTML = jobs.concat(edu).join('');
    $('#experience').hidden = !jobs.length && !edu.length;

    // skills
    $('#skill-list').innerHTML = d.skills.map(g => `
      <div class="row"><span>${esc(g.label)}</span><p>${g.items.map(i => `<b>${esc(i)}</b>`).join('')}</p></div>`).join('');
    $('#skills').hidden = !d.skills.length;

    // awards + certifications
    $('#award-list').innerHTML = d.awards.map(a => `
      <div class="card award reveal"><span class="when">${esc(a.year || 'Award')}</span><h3>${esc(a.title)}</h3>${a.org ? `<p>${esc(a.org.replace(a.year, '').trim())}</p>` : ''}</div>`).join('');
    const certs = $('#cert-list');
    certs.hidden = !d.certifications.length;
    certs.innerHTML = `<p class="when">Certifications</p>` + d.certifications.map(c =>
      `<p>${esc(c.title)}${c.org ? ` <span class="muted">· ${esc(c.org)}</span>` : ''}</p>`).join('');
    $('#awards').hidden = !d.awards.length && !d.certifications.length;

    // contact
    const mail = $('#contact-email');
    mail.textContent = d.email;
    mail.href = `mailto:${d.email}`;
    mail.hidden = !d.email;
    const links = [
      d.github && `<a href="${esc(url(d.github))}" target="_blank" rel="noopener">GitHub ↗</a>`,
      d.linkedin && `<a href="${esc(url(d.linkedin))}" target="_blank" rel="noopener">LinkedIn ↗</a>`,
      d.website && `<a href="${esc(url(d.website))}" target="_blank" rel="noopener">Website ↗</a>`,
      x.showPhone && d.phone && `<a href="tel:${esc(d.phone.replace(/[^\d+]/g, ''))}">${esc(d.phone)}</a>`,
      `<a href="${esc(d.source)}" download>Resume (PDF) ↓</a>`,
    ].filter(Boolean);
    $('#contact-links').innerHTML = links.join('');

    // hide nav links for sections that ended up empty
    document.querySelectorAll('.links a').forEach(a => { a.hidden = !!document.querySelector(a.hash)?.hidden; });
    const updated = new Date(d.generated);
    if (!isNaN(updated)) $('#f-updated').textContent = `Content read from my resume · updated ${updated.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
  }

  const get = p => fetch(p, { cache: 'no-cache' }).then(r => r.ok ? r.json() : Promise.reject(new Error(`${p}: ${r.status}`)));
  window.resumeReady = Promise.all([get('data/resume.json'), get('data/extras.json').catch(() => ({}))])
    .then(([d, x]) => {
      d.extras = x;
      render(d, x);
      dispatchEvent(new CustomEvent('resume:ready', { detail: d }));
      return d;
    })
    .catch(err => {
      console.error('Could not load resume data', err);
      document.querySelectorAll('.sk').forEach(el => el.remove());
    });
})();
