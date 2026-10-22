// Starfield + nebula + perspective grid floor + shooting stars
(() => {
  const cv = document.getElementById('bg');
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H, DPR, stars = [], shooters = [], t = 0, running = true;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

  function resize() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const n = Math.round((W * H) / 2600);
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      z: Math.random() * .9 + .1,
      tw: Math.random() * Math.PI * 2,
      hue: Math.random() < .12 ? (Math.random() < .5 ? 185 : 315) : 220,
    }));
  }

  function nebula(x, y, r, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function grid(scrollY) {
    const horizon = H * .62;
    const fade = Math.max(0, 1 - scrollY / (H * 1.2));
    if (fade <= 0) return;
    ctx.save();
    ctx.globalAlpha = fade * .55;
    const g = ctx.createLinearGradient(0, horizon, 0, H);
    g.addColorStop(0, 'rgba(255,43,214,0)');
    g.addColorStop(1, 'rgba(255,43,214,.9)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 1;
    const vx = W / 2 + mouse.x * 40;
    for (let i = -24; i <= 24; i++) {
      ctx.beginPath();
      ctx.moveTo(vx + i * 8, horizon);
      ctx.lineTo(W / 2 + i * (W / 12), H);
      ctx.stroke();
    }
    const off = (t * 0.6) % 1;
    for (let i = 0; i < 16; i++) {
      const p = (i + off) / 16;
      const y = horizon + Math.pow(p, 2.4) * (H - horizon);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    // horizon glow
    const hg = ctx.createLinearGradient(0, horizon - 40, 0, horizon + 10);
    hg.addColorStop(0, 'rgba(34,240,255,0)');
    hg.addColorStop(1, 'rgba(34,240,255,.25)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, horizon - 40, W, 50);
    ctx.restore();
  }

  function frame() {
    if (!running) return;
    t += 1 / 60;
    mouse.x += (mouse.tx - mouse.x) * .05;
    mouse.y += (mouse.ty - mouse.y) * .05;
    const sy = scrollY;

    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = 'lighter';
    nebula(W * .18 - mouse.x * 30, H * .25 - sy * .05, W * .45, 'rgba(255,43,214,.10)');
    nebula(W * .85 - mouse.x * 50, H * .55 - sy * .08, W * .5, 'rgba(34,240,255,.09)');
    nebula(W * .5 + Math.sin(t * .2) * 80, H * .9 - sy * .03, W * .4, 'rgba(90,60,255,.10)');
    ctx.globalCompositeOperation = 'source-over';

    for (const s of stars) {
      const px = (s.x - mouse.x * 40 * s.z + W) % W;
      const py = ((s.y - sy * s.z * .25 - mouse.y * 30 * s.z) % H + H) % H;
      const a = .35 + Math.sin(t * 2 + s.tw) * .3 * s.z + s.z * .4;
      ctx.fillStyle = `hsla(${s.hue},100%,${s.hue === 220 ? 92 : 70}%,${a})`;
      const r = s.z * 1.5;
      ctx.fillRect(px, py, r, r);
    }

    if (!reduce && Math.random() < .006) {
      shooters.push({ x: Math.random() * W, y: Math.random() * H * .4, vx: -8 - Math.random() * 6, vy: 3 + Math.random() * 3, life: 1 });
    }
    shooters = shooters.filter(s => s.life > 0);
    for (const s of shooters) {
      const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 10, s.y - s.vy * 10);
      g.addColorStop(0, `rgba(255,255,255,${s.life})`);
      g.addColorStop(1, 'rgba(34,240,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 10, s.y - s.vy * 10); ctx.stroke();
      s.x += s.vx; s.y += s.vy; s.life -= .02;
    }

    grid(sy);
    if (!reduce) requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  addEventListener('mousemove', e => {
    mouse.tx = e.clientX / W - .5;
    mouse.ty = e.clientY / H - .5;
  });
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running && !reduce) requestAnimationFrame(frame);
  });
  resize();
  frame();
  if (reduce) addEventListener('scroll', () => requestAnimationFrame(frame), { passive: true });
})();
