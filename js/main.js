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
  // each art draws one frame: (ctx, w, h, t, hue). content.js picks a different one per project.
  const T = 'rgba(234,241,236,.55)';
  const hsl = (h, s = 85, l = 66, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
  const label = (ctx, w, h, top, bottom) => {
    ctx.fillStyle = T; ctx.font = '500 11px JetBrains Mono';
    if (top) ctx.fillText(top, 16, 24);
    if (bottom) ctx.fillText(bottom, 16, h - 16);
  };
  const seeded = n => { let x = n; return () => (x = (x * 16807) % 2147483647) / 2147483647; };
  const ARTS = {
    wave(ctx, w, h, t, hue) {
      const n = Math.max(24, Math.round(w / 9)), bw = w / n;
      for (let i = 0; i < n; i++) {
        const env = Math.exp(-Math.pow((i - n / 2) / (n / 4.5), 2));
        const v = env * (Math.sin(i * .5 + t * 3.2) * .35 + .65) * (Math.sin(t * 1.3 + i * .15) * .25 + .75);
        const bh = Math.max(3, v * h * .62);
        const g = ctx.createLinearGradient(0, h / 2 - bh / 2, 0, h / 2 + bh / 2);
        g.addColorStop(0, hsl(hue)); g.addColorStop(1, hsl(hue + 60, 80, 72));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(i * bw + bw * .22, h / 2 - bh / 2, bw * .56, bh, bw * .28);
        ctx.fill();
      }
      label(ctx, w, h, 'listening for the wake word', `confidence ${(95.4 + Math.sin(t) * 1.8).toFixed(1)}%`);
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
      ctx.fillStyle = T; ctx.font = '500 11px JetBrains Mono';
      ctx.fillText(`AQI ${Math.round(30 + aq * 160)} · CO ${(aq * 8).toFixed(1)} ppm · PM2.5 ${Math.round(8 + aq * 80)}`, 16, h - 16);
    },
    radar(ctx, w, h, t, hue) {
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .4;
      ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(cx, cy, R * i / 3, 0, 7); ctx.stroke(); }
      const a = t * 1.1;
      const g = ctx.createConicGradient(a - .9, cx, cy);
      g.addColorStop(0, hsl(hue, 70, 70, 0)); g.addColorStop(.143, hsl(hue, 70, 70, .28)); g.addColorStop(.1431, hsl(hue, 70, 70, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
      const hosts = [[.35, .8], [.7, 2.1], [.9, 3.4], [.5, 4.4], [.75, 5.5], [.25, 2.9]];
      ctx.font = '500 10px JetBrains Mono';
      hosts.forEach(([r, ang], i) => {
        const diff = ((a - ang) % 6.283 + 6.283) % 6.283;
        const glow = Math.max(0, 1 - diff / 3);
        const x = cx + Math.cos(ang) * R * r, y = cy + Math.sin(ang) * R * r, weak = i % 3 === 1;
        ctx.fillStyle = weak ? `rgba(255,158,100,${.3 + glow * .7})` : hsl(hue, 70, 70, .3 + glow * .7);
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill();
        if (glow > .4) { ctx.fillStyle = T; ctx.fillText(weak ? 'weak MAC filter' : `192.168.0.${10 + i * 17}`, x + 8, y - 6); }
      });
      label(ctx, w, h, '', '6 hosts · 2 weak');
    },
    // signals travelling along circuit traces
    circuit(ctx, w, h, t, hue) {
      const rows = 6, cols = 10, gx = w / (cols + 1), gy = h / (rows + 1);
      ctx.lineWidth = 1.5;
      for (let r = 1; r <= rows; r++) {
        ctx.strokeStyle = 'rgba(255,255,255,.07)';
        ctx.beginPath(); ctx.moveTo(gx * .5, r * gy); ctx.lineTo(w - gx * .5, r * gy); ctx.stroke();
        const p = ((t * (.18 + r * .03) + r * .37) % 1);
        const x = gx * .5 + p * (w - gx);
        const g = ctx.createLinearGradient(x - 80, 0, x, 0);
        g.addColorStop(0, hsl(hue, 85, 66, 0)); g.addColorStop(1, r % 2 ? hsl(hue) : hsl(hue + 70));
        ctx.strokeStyle = g;
        ctx.beginPath(); ctx.moveTo(Math.max(gx * .5, x - 80), r * gy); ctx.lineTo(x, r * gy); ctx.stroke();
      }
      for (let r = 1; r <= rows; r++) for (let c = 1; c <= cols; c++) {
        if ((r * 7 + c * 3) % 5) continue;
        ctx.fillStyle = Math.sin(t * 2 + r + c) > .3 ? hsl(hue + 30, 70, 70) : 'rgba(255,255,255,.12)';
        ctx.fillRect(c * gx - 5, r * gy - 5, 10, 10);
      }
    },
    // a branching plant that grows, holds, then starts again
    growth(ctx, w, h, t, hue) {
      const cyc = (t % 10) / 10, grow = Math.min(1, cyc / .7), fade = cyc > .9 ? 1 - (cyc - .9) / .1 : 1;
      const rnd = seeded(42);
      ctx.globalAlpha = fade;
      const branch = (x, y, a, len, d) => {
        const p = Math.min(1, Math.max(0, grow * 7 - d));
        if (p <= 0 || d > 6) return;
        const x2 = x + Math.cos(a) * len * p, y2 = y + Math.sin(a) * len * p;
        ctx.strokeStyle = hsl(110 + d * 8, 45, 30 + d * 6); ctx.lineWidth = Math.max(1, 6 - d);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
        if (p < 1) return;
        if (d >= 4) {
          ctx.fillStyle = hsl(hue, 70, 55 + rnd() * 15, .9);
          ctx.beginPath(); ctx.ellipse(x2, y2, 6, 3.5, a + Math.sin(t * 2 + x2) * .2, 0, 7); ctx.fill();
        }
        const sway = Math.sin(t * 1.3 + d) * .04;
        branch(x2, y2, a - .45 - rnd() * .2 + sway, len * .74, d + 1);
        branch(x2, y2, a + .4 + rnd() * .2 + sway, len * .7, d + 1);
      };
      branch(w / 2, h - 18, -Math.PI / 2, h * .26, 0);
      ctx.globalAlpha = 1;
      label(ctx, w, h, '', `soil 61% · growth ${Math.round(grow * 100)}%`);
    },
    // wireframe landscape scrolling toward you
    terrain(ctx, w, h, t, hue) {
      const rows = 22, cols = 28, hz = h * .32;
      const height = (x, z) => Math.sin(x * .45 + z * .3) * .6 + Math.sin(x * .17 - z * .21) * 1.1 + Math.cos(z * .5) * .3;
      ctx.lineWidth = 1;
      for (let r = rows; r >= 1; r--) {
        const zf = r - (t * 2.2) % 1, depth = zf / rows;
        const persp = 1 / (depth * 3 + .35);
        ctx.strokeStyle = hsl(hue, 80, 65, Math.min(1, 1.2 - depth));
        ctx.beginPath();
        for (let c = 0; c <= cols; c++) {
          const xw = (c / cols - .5) * 18;
          const x = w / 2 + xw * persp * w * .04, y = hz + persp * h * .18 - height(xw, zf + Math.floor(t * 2.2)) * persp * h * .05;
          c ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      label(ctx, w, h, 'mapping · lidar sweep', '');
    },
    // network graph with packets hopping between nodes
    packets(ctx, w, h, t, hue) {
      const rnd = seeded(7), N = 9;
      const nodes = Array.from({ length: N }, () => ({ x: (.12 + rnd() * .76) * w, y: (.18 + rnd() * .64) * h }));
      const edges = [];
      nodes.forEach((a, i) => nodes.forEach((b, j) => { if (j > i && Math.hypot(a.x - b.x, a.y - b.y) < Math.min(w, h) * .55) edges.push([i, j]); }));
      ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1;
      edges.forEach(([i, j]) => { ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke(); });
      edges.forEach(([i, j], k) => {
        const u = (t * (.3 + (k % 4) * .08) + k * .37) % 1, a = nodes[i], b = nodes[j];
        ctx.fillStyle = hsl(hue + (k % 3) * 40);
        ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, 2.6, 0, 7); ctx.fill();
      });
      nodes.forEach((n, i) => {
        const pulse = .5 + .5 * Math.sin(t * 3 + i);
        ctx.fillStyle = hsl(hue, 60, 22); ctx.strokeStyle = hsl(hue, 80, 66, .5 + pulse * .5); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(n.x, n.y, 7 + pulse * 2, 0, 7); ctx.fill(); ctx.stroke();
      });
      label(ctx, w, h, '', `${edges.length} links · ${Math.round(40 + Math.sin(t) * 6)} req/s`);
    },
    // interlocking gears
    gears(ctx, w, h, t, hue) {
      const gear = (x, y, r, teeth, a, col) => {
        ctx.fillStyle = col; ctx.beginPath();
        for (let i = 0; i < teeth * 2; i++) {
          const ang = a + i / (teeth * 2) * Math.PI * 2, rr = i % 2 ? r : r * 1.16;
          const da = Math.PI / teeth * .45;
          ctx.lineTo(x + Math.cos(ang - da) * rr, y + Math.sin(ang - da) * rr);
          ctx.lineTo(x + Math.cos(ang + da) * rr, y + Math.sin(ang + da) * rr);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#0d1512'; ctx.beginPath(); ctx.arc(x, y, r * .32, 0, 7); ctx.fill();
      };
      const R = Math.min(w, h) * .26, cx = w * .42, cy = h * .52;
      gear(cx, cy, R, 12, t * .6, hsl(hue, 55, 55));
      gear(cx + R * 1.95, cy - R * .55, R * .6, 8, -t * .6 * 12 / 8 + .2, hsl(hue + 40, 60, 62));
      gear(cx - R * 1.5, cy + R * .9, R * .5, 7, -t * .6 * 12 / 7, hsl(hue - 40, 50, 48));
      label(ctx, w, h, '', `servo ${Math.round(90 + Math.sin(t) * 60)}° · torque ok`);
    },
    // heartbeat trace with a glowing head
    pulse(ctx, w, h, t, hue) {
      const beat = u => { const k = u % 1; return k < .1 ? Math.sin(k / .1 * Math.PI) * .12 : k < .16 ? -.2 * Math.sin((k - .1) / .06 * Math.PI) : k < .22 ? Math.sin((k - .16) / .06 * Math.PI) : k < .3 ? -.3 * Math.sin((k - .22) / .08 * Math.PI) : k < .45 ? Math.sin((k - .3) / .15 * Math.PI) * .18 : 0; };
      const head = (t * .35) % 1;
      ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
      for (let i = 1; i < w; i += 2) {
        const u = i / w, age = (head - u + 1) % 1;
        ctx.strokeStyle = hsl(hue, 85, 66, Math.max(0, 1 - age * 1.4));
        ctx.beginPath();
        ctx.moveTo(i - 2, h / 2 - beat((i - 2) / w * 3) * h * .32);
        ctx.lineTo(i, h / 2 - beat(u * 3) * h * .32);
        ctx.stroke();
      }
      ctx.fillStyle = hsl(hue, 90, 80); ctx.beginPath(); ctx.arc(head * w, h / 2 - beat(head * 3) * h * .32, 4, 0, 7); ctx.fill();
      label(ctx, w, h, '', `${Math.round(72 + Math.sin(t * .5) * 4)} bpm`);
    },
    // live bar chart
    bars(ctx, w, h, t, hue) {
      const n = Math.max(10, Math.round(w / 26)), bw = (w - 32) / n;
      for (let i = 0; i < n; i++) {
        const v = .25 + .6 * Math.abs(Math.sin(i * .7 + t * .9) * Math.cos(i * .23 - t * .4));
        const bh = v * (h - 70);
        ctx.fillStyle = hsl(hue + i * 4, 70, 45 + v * 25);
        ctx.beginPath(); ctx.roundRect(16 + i * bw + bw * .15, h - 34 - bh, bw * .7, bh, 4); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.moveTo(16, h - 33); ctx.lineTo(w - 16, h - 33); ctx.stroke();
      label(ctx, w, h, `accuracy ${(93 + Math.sin(t * .3) * 2).toFixed(1)}%`, '');
    },
    // satellites on elliptical orbits
    orbit(ctx, w, h, t, hue) {
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .4;
      const g = ctx.createRadialGradient(cx - R * .1, cy - R * .1, 0, cx, cy, R * .28);
      g.addColorStop(0, hsl(hue, 60, 60)); g.addColorStop(1, hsl(hue, 60, 22));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * .26, 0, 7); ctx.fill();
      [[1, .38, .4, 1], [.8, .6, -.6, 1.6], [.62, .9, 1.1, 2.3]].forEach(([rx, ry, rot, sp], i) => {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
        ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, 0, R * rx, R * rx * ry, 0, 0, 7); ctx.stroke();
        for (let k = 0; k < 14; k++) {
          const a = t * sp * .5 - k * .05;
          ctx.fillStyle = hsl(hue + 60 * i, 85, 70, (1 - k / 14) * .9);
          ctx.beginPath(); ctx.arc(Math.cos(a) * R * rx, Math.sin(a) * R * rx * ry, 3.2 - k * .18, 0, 7); ctx.fill();
        }
        ctx.restore();
      });
      label(ctx, w, h, '', `${3} sats locked · fix 3D`);
    },
    // particles following a flow field, with trails (draws over its own last frame)
    flow(ctx, w, h, t, hue, a) {
      if (!a.parts) a.parts = Array.from({ length: Math.round(w * h / 900) }, () => ({ x: Math.random() * w, y: Math.random() * h }));
      ctx.fillStyle = 'rgba(11,19,16,.14)'; ctx.fillRect(0, 0, w, h);
      for (const p of a.parts) {
        const ang = Math.sin(p.x * .012 + t * .3) * 2 + Math.cos(p.y * .014 - t * .2) * 2;
        p.x += Math.cos(ang) * 1.3; p.y += Math.sin(ang) * 1.3;
        if (p.x < 0 || p.x > w || p.y < 0 || p.y > h) { p.x = Math.random() * w; p.y = Math.random() * h; }
        ctx.fillStyle = hsl(hue + (p.y / h) * 60, 85, 66, .8);
        ctx.fillRect(p.x, p.y, 1.6, 1.6);
      }
      ctx.fillStyle = 'rgba(11,19,16,.9)'; ctx.fillRect(10, h - 30, 160, 20);
      label(ctx, w, h, '', `detections ${Math.round(12 + Math.sin(t) * 4)} · 30 fps`);
    },
  };
  ARTS.flow.trails = true;

  let arts = [];
  function sizeArts() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    arts.forEach(a => {
      const r = a.cv.getBoundingClientRect();
      a.w = r.width; a.h = r.height;
      a.cv.width = r.width * dpr; a.cv.height = r.height * dpr;
      a.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      a.parts = null;
    });
  }
  addEventListener('resize', sizeArts);
  const artObs = new IntersectionObserver(es => es.forEach(e => {
    const a = arts.find(x => x.cv === e.target);
    if (a) a.on = e.isIntersecting;
  }));

  // tilt cards toward the pointer (mouse only)
  function tilt(card) {
    const inner = card.querySelector('.tilt');
    card.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      inner.style.setProperty('--ry', `${(x - .5) * 8}deg`); inner.style.setProperty('--rx', `${(.5 - y) * 6}deg`);
      inner.style.setProperty('--mx', `${x * 100}%`); inner.style.setProperty('--my', `${y * 100}%`);
    });
    card.addEventListener('pointerleave', () => { inner.style.setProperty('--rx', '0deg'); inner.style.setProperty('--ry', '0deg'); });
  }

  addEventListener('resume:ready', () => {
    arts = [...document.querySelectorAll('.art canvas')].map(cv => ({ cv, ctx: cv.getContext('2d'), fn: ARTS[cv.dataset.art] || ARTS.circuit, hue: +cv.dataset.hue || 150, on: false }));
    arts.forEach(a => artObs.observe(a.cv));
    document.querySelectorAll('.project').forEach(tilt);
    sizeArts();
    revealVisible();
    if (reduce) arts.forEach(a => a.w && a.fn(a.ctx, a.w, a.h, 1, a.hue, a));
  });

  // 30 fps is plenty for the card art; on low-end devices (as judged by the 3D room) 15
  let t = 0, lastArt = 0;
  (function loop(now) {
    if (!reduce) requestAnimationFrame(loop);
    const gap = document.documentElement.dataset.quality === 'low' ? 66 : 33;
    if (now - lastArt < gap) return;
    t += Math.min(.1, (now - lastArt) / 1000 || 1 / 30);
    lastArt = now;
    arts.forEach(a => {
      if (!a.on || !a.w) return;
      if (!a.fn.trails) a.ctx.clearRect(0, 0, a.w, a.h);
      a.fn(a.ctx, a.w, a.h, t, a.hue, a);
    });
  })(0);

  $('#yr').textContent = new Date().getFullYear();
})();
