// Renders the page from data/resume.json (written from the resume PDF) plus data/extras.json (hand-edited bits)
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const url = s => /^https?:\/\//.test(s) ? s : `https://${s}`;

  // project art: explicit in extras, otherwise guessed from the project's words
  function artFor(p) {
    const t = `${p.name} ${p.bullets.join(' ')} ${p.stack.join(' ')}`.toLowerCase();
    if (/voice|speech|whisper|audio|wake/.test(t)) return 'wave';
    if (/sensor|iot|mqtt|arduino|esp32|air/.test(t)) return 'orb';
    if (/network|security|scan|ctf|vulnerab/.test(t)) return 'radar';
    return 'circuit';
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

    document.querySelectorAll('.cv-link').forEach(a => { a.href = d.source; a.setAttribute('download', d.source.split('/').pop()); });

    // projects
    const projects = d.projects.map(p => {
      const key = Object.keys(x.projects || {}).find(k => p.name.toLowerCase().includes(k.toLowerCase()));
      const extra = key ? x.projects[key] : {};
      const tagline = extra.tagline || '';
      const bullets = tagline ? p.bullets : p.bullets.slice(1);
      return `
      <article class="project reveal">
        <div class="tab"><span>${esc(slug(p.name))}</span><span class="muted">${esc(p.dates || p.stack.slice(0, 2).join(' · ').toLowerCase())}</span></div>
        <div class="project-body">
          <h3>${esc(p.name)}</h3>
          <p class="tagline">${esc(tagline || p.bullets[0] || '')}</p>
          <div class="art"><canvas data-art="${esc(extra.art || artFor(p))}"></canvas></div>
          <div class="readme">
            ${bullets.length ? `<p class="h">## Highlights</p><ul>${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
            ${p.stack.length ? `<p class="deps"><span class="k">"stack"</span>: [${p.stack.map(s => `<span>"${esc(s)}"</span>`).join(', ')}]</p>` : ''}
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
      `<a href="${esc(d.source)}" download>CV (PDF) ↓</a>`,
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
