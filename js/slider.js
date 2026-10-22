// Project carousel with generative art per slide (wave / orb / radar / arm)
(() => {
  const slider = document.getElementById('slider');
  const track = document.getElementById('slides');
  const slides = [...track.children];
  const dotsEl = document.getElementById('dots');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // wrap track in a clipping viewport
  const vp = document.createElement('div');
  vp.className = 'slider-viewport';
  track.parentNode.insertBefore(vp, track);
  vp.appendChild(track);

  let cur = 0, timer;
  slides.forEach((_, i) => {
    const b = document.createElement('button');
    b.setAttribute('aria-label', `Slide ${i + 1}`);
    b.onclick = () => go(i, true);
    dotsEl.appendChild(b);
  });

  function go(i, user) {
    cur = (i + slides.length) % slides.length;
    track.style.transform = `translateX(${-cur * 100}%)`;
    [...dotsEl.children].forEach((d, k) => d.classList.toggle('on', k === cur));
    if (user) restart();
  }
  function restart() { clearInterval(timer); if (!reduce) timer = setInterval(() => go(cur + 1), 7000); }
  document.getElementById('prev').onclick = () => go(cur - 1, true);
  document.getElementById('next').onclick = () => go(cur + 1, true);

  // drag / swipe
  let sx = null, dx = 0;
  vp.addEventListener('pointerdown', e => { sx = e.clientX; dx = 0; track.style.transition = 'none'; });
  addEventListener('pointermove', e => {
    if (sx === null) return;
    dx = e.clientX - sx;
    track.style.transform = `translateX(calc(${-cur * 100}% + ${dx}px))`;
  });
  addEventListener('pointerup', () => {
    if (sx === null) return;
    track.style.transition = '';
    if (Math.abs(dx) > 60) go(cur + (dx < 0 ? 1 : -1), true); else go(cur);
    sx = null;
  });
  slider.addEventListener('mouseenter', () => clearInterval(timer));
  slider.addEventListener('mouseleave', restart);
  go(0); restart();

  // ---------- generative art ----------
  const ARTS = {
    wave(ctx, w, h, t) {
      const bars = 64, bw = w / bars;
      for (let i = 0; i < bars; i++) {
        const v = (Math.sin(i * .35 + t * 3) * .5 + .5) * (Math.sin(i * .11 - t * 1.7) * .5 + .5) * (Math.sin(t * 5 + i) * .15 + .85);
        const bh = v * h * .55;
        const g = ctx.createLinearGradient(0, h / 2 - bh / 2, 0, h / 2 + bh / 2);
        g.addColorStop(0, '#ff2bd6'); g.addColorStop(.5, '#22f0ff'); g.addColorStop(1, '#ff2bd6');
        ctx.fillStyle = g;
        ctx.fillRect(i * bw + 1, h / 2 - bh / 2, bw - 2, bh);
      }
      // waveform line
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const y = h / 2 + Math.sin(x * .03 + t * 4) * 22 * Math.sin(x * .006 + t);
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      // wake-word detector ring
      const p = (t * .5) % 1;
      ctx.strokeStyle = `rgba(34,240,255,${1 - p})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(w / 2, h / 2, 30 + p * Math.min(w, h) * .45, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#22f0ff'; ctx.font = '600 12px JetBrains Mono';
      ctx.fillText(`WAKE_CONF ${(95 + Math.sin(t) * 3).toFixed(1)}%`, 16, h - 18);
    },
    orb(ctx, w, h, t) {
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .3, N = 90;
      const aq = (Math.sin(t * .4) * .5 + .5);
      const hue = 185 - aq * 150; // cyan → red as air worsens
      const pts = [];
      for (let i = 0; i < N; i++) {
        const phi = Math.acos(1 - 2 * (i + .5) / N), th = Math.PI * (1 + Math.sqrt(5)) * i + t * .4;
        const x = Math.sin(phi) * Math.cos(th), y = Math.cos(phi), z = Math.sin(phi) * Math.sin(th);
        pts.push({ x: cx + x * R, y: cy + y * R * .95, z });
      }
      ctx.lineWidth = .6;
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const a = pts[i], b = pts[j], dd = Math.hypot(a.x - b.x, a.y - b.y);
        if (dd < R * .42) {
          ctx.strokeStyle = `hsla(${hue},100%,60%,${(1 - dd / (R * .42)) * .5 * ((a.z + b.z) / 4 + .5)})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      for (const p of pts) {
        ctx.fillStyle = `hsla(${hue},100%,${60 + p.z * 20}%,${.4 + (p.z + 1) * .3})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.5 + (p.z + 1), 0, Math.PI * 2); ctx.fill();
      }
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
      g.addColorStop(0, `hsla(${hue},100%,60%,.35)`); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = `hsl(${hue},100%,65%)`; ctx.font = '600 12px JetBrains Mono';
      ctx.fillText(`AQI ${Math.round(30 + aq * 170)}  CO ${(aq * 9).toFixed(1)}ppm  PM2.5 ${Math.round(8 + aq * 90)}`, 16, h - 18);
    },
    radar(ctx, w, h, t) {
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * .4;
      ctx.strokeStyle = 'rgba(77,255,154,.3)'; ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(cx, cy, R * i / 4, 0, Math.PI * 2); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      const a = t * 1.4;
      for (let k = 0; k < 40; k++) {
        ctx.strokeStyle = `rgba(77,255,154,${.5 * (1 - k / 40)})`;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a - k * .02) * R, cy + Math.sin(a - k * .02) * R); ctx.stroke();
      }
      const hosts = [[.3, .8], [.6, 2.1], [.85, 3.4], [.45, 4.4], [.7, 5.5], [.25, 2.9]];
      ctx.font = '600 10px JetBrains Mono';
      hosts.forEach(([r, ang], i) => {
        let diff = ((a - ang) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const glow = Math.max(0, 1 - diff / 2.5);
        const x = cx + Math.cos(ang) * R * r, y = cy + Math.sin(ang) * R * r;
        const bad = i % 3 === 1;
        ctx.fillStyle = bad ? `rgba(255,59,92,${.25 + glow})` : `rgba(77,255,154,${.25 + glow})`;
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
        if (glow > .3) ctx.fillText(bad ? 'MAC_FILTER ✗' : `192.168.0.${10 + i * 17}`, x + 8, y - 6);
      });
      ctx.fillStyle = '#4dff9a'; ctx.font = '600 12px JetBrains Mono';
      ctx.fillText('NETDISCOVER // 6 HOSTS · 2 WEAK', 16, h - 18);
    },
    arm(ctx, w, h, t) {
      const bx = w / 2, by = h * .82;
      ctx.strokeStyle = 'rgba(34,240,255,.15)';
      for (let x = 0; x < w; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      const L1 = h * .3, L2 = h * .24, L3 = h * .1;
      const a1 = -Math.PI / 2 + Math.sin(t * .8) * .6;
      const a2 = a1 + .9 + Math.sin(t * 1.1) * .5;
      const a3 = a2 + .6 + Math.sin(t * 1.7) * .4;
      const j1 = [bx + Math.cos(a1) * L1, by + Math.sin(a1) * L1];
      const j2 = [j1[0] + Math.cos(a2) * L2, j1[1] + Math.sin(a2) * L2];
      const j3 = [j2[0] + Math.cos(a3) * L3, j2[1] + Math.sin(a3) * L3];
      ctx.lineCap = 'round';
      [[[bx, by], j1, 14], [j1, j2, 10], [j2, j3, 6]].forEach(([p, q, lw]) => {
        ctx.strokeStyle = '#2a3358'; ctx.lineWidth = lw + 4;
        ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke();
        ctx.strokeStyle = '#22f0ff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke();
      });
      [[bx, by], j1, j2].forEach(([x, y]) => {
        ctx.fillStyle = '#0b1026'; ctx.strokeStyle = '#ff2bd6'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
      // gripper + trace
      ctx.fillStyle = '#ff2bd6'; ctx.shadowColor = '#ff2bd6'; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(j3[0], j3[1], 4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#1b2348'; ctx.fillRect(bx - 40, by + 6, 80, 12);
      ctx.fillStyle = '#22f0ff'; ctx.font = '600 12px JetBrains Mono';
      ctx.fillText(`θ1 ${(a1 * 57.3).toFixed(0)}°  θ2 ${(a2 * 57.3).toFixed(0)}°  θ3 ${(a3 * 57.3).toFixed(0)}°`, 16, h - 18);
    },
  };

  const canvases = slides.map(s => {
    const cv = s.querySelector('canvas');
    return { cv, ctx: cv.getContext('2d'), art: ARTS[s.dataset.art], slide: s };
  });
  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvases.forEach(c => {
      const r = c.cv.getBoundingClientRect();
      c.w = r.width; c.h = r.height;
      c.cv.width = r.width * dpr; c.cv.height = r.height * dpr;
      c.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
  }
  addEventListener('resize', size);
  size();

  let onScreen = false;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(slider);
  let t = 0;
  (function loop() {
    if (onScreen && !document.hidden) {
      t += 1 / 60;
      // draw current + neighbours so slides are alive mid-transition
      [cur - 1, cur, cur + 1].forEach(i => {
        const c = canvases[(i + canvases.length) % canvases.length];
        if (!c.w) return;
        c.ctx.clearRect(0, 0, c.w, c.h);
        c.art(c.ctx, c.w, c.h, t);
      });
    }
    if (!reduce) requestAnimationFrame(loop);
  })();
  if (reduce) canvases.forEach(c => c.w && c.art(c.ctx, c.w, c.h, 1));
})();
