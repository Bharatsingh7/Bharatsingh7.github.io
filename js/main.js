// Page behaviour: nav, scroll reveals, project art canvases (run once content.js has rendered the projects)
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = s => document.querySelector(s);

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
      ctx.fillText('listening for the wake word', 16, 24);
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
    // generic: signals travelling along circuit traces
    circuit(ctx, w, h, t) {
      const rows = 6, cols = 10, gx = w / (cols + 1), gy = h / (rows + 1);
      ctx.lineWidth = 1.5;
      for (let r = 1; r <= rows; r++) {
        ctx.strokeStyle = 'rgba(255,255,255,.07)';
        ctx.beginPath(); ctx.moveTo(gx * .5, r * gy); ctx.lineTo(w - gx * .5, r * gy); ctx.stroke();
        const p = ((t * (.18 + r * .03) + r * .37) % 1);
        const x = gx * .5 + p * (w - gx);
        const g = ctx.createLinearGradient(x - 80, 0, x, 0);
        g.addColorStop(0, 'rgba(255,158,100,0)'); g.addColorStop(1, r % 2 ? C.a : C.b);
        ctx.strokeStyle = g;
        ctx.beginPath(); ctx.moveTo(Math.max(gx * .5, x - 80), r * gy); ctx.lineTo(x, r * gy); ctx.stroke();
      }
      for (let r = 1; r <= rows; r++) for (let c = 1; c <= cols; c++) {
        if ((r * 7 + c * 3) % 5) continue;
        const on = Math.sin(t * 2 + r + c) > .3;
        ctx.fillStyle = on ? C.m : 'rgba(255,255,255,.12)';
        ctx.fillRect(c * gx - 5, r * gy - 5, 10, 10);
      }
    },
  };

  let arts = [];
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
  const artObs = new IntersectionObserver(es => es.forEach(e => {
    const a = arts.find(x => x.cv === e.target);
    if (a) a.on = e.isIntersecting;
  }));

  addEventListener('resume:ready', () => {
    arts = [...document.querySelectorAll('.art canvas')].map(cv => ({ cv, ctx: cv.getContext('2d'), fn: ARTS[cv.dataset.art] || ARTS.circuit, on: false }));
    arts.forEach(a => artObs.observe(a.cv));
    sizeArts();
    revealVisible();
    if (reduce) arts.forEach(a => a.w && a.fn(a.ctx, a.w, a.h, 1));
  });

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

  $('#yr').textContent = new Date().getFullYear();
})();
