// Quadcopter drone that chases the cursor, banks into its motion and leaves a thruster trail
(() => {
  const fine = matchMedia('(pointer: fine)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.getElementById('drone');
  if (!fine || reduce) { cv.remove(); return; }
  document.body.classList.add('has-drone');

  const ctx = cv.getContext('2d');
  let W, H, DPR;
  const target = { x: innerWidth / 2, y: innerHeight / 2 };
  const d = { x: innerWidth / 2, y: innerHeight / 2 - 80, vx: 0, vy: 0, tilt: 0, rot: 0 };
  let parts = [], t = 0, idle = 0, clickPulse = 0, visible = true;

  function resize() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function rotor(x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    // motion blur disc
    ctx.fillStyle = 'rgba(34,240,255,.12)';
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * .32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(34,240,255,.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // blades (foreshortened rotation)
    ctx.strokeStyle = 'rgba(220,250,255,.85)';
    ctx.lineWidth = 2;
    const a = d.rot;
    ctx.beginPath();
    ctx.moveTo(-Math.cos(a) * r, -Math.sin(a) * r * .32);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * .32);
    ctx.stroke();
    ctx.restore();
  }

  function drawDrone() {
    const { x, y, tilt } = d;
    const bob = Math.sin(t * 3) * 3;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.rotate(tilt);

    // under-glow
    const g = ctx.createRadialGradient(0, 14, 0, 0, 14, 46);
    g.addColorStop(0, 'rgba(34,240,255,.35)');
    g.addColorStop(1, 'rgba(34,240,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-46, -32, 92, 92);

    // arms
    ctx.strokeStyle = '#3b4a86';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-26, -6); ctx.lineTo(26, -6);
    ctx.stroke();
    // motor posts
    ctx.fillStyle = '#1b2348';
    [-26, 26].forEach(px => { ctx.fillRect(px - 3, -12, 6, 8); });

    rotor(-26, -13, 17);
    rotor(26, -13, 17);

    // body
    ctx.fillStyle = '#141a38';
    ctx.strokeStyle = '#22f0ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-15, -8); ctx.lineTo(15, -8); ctx.lineTo(11, 6); ctx.lineTo(-11, 6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // visor / eye
    const eyeDx = Math.max(-5, Math.min(5, (target.x - x) * .03));
    ctx.fillStyle = '#ff2bd6';
    ctx.shadowColor = '#ff2bd6'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(eyeDx, -1, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // landing legs
    ctx.strokeStyle = '#3b4a86'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, 6); ctx.lineTo(-11, 13); ctx.moveTo(8, 6); ctx.lineTo(11, 13);
    ctx.stroke();
    // nav lights
    const on = Math.sin(t * 8) > 0;
    ctx.fillStyle = on ? '#4dff9a' : '#0b3';
    ctx.beginPath(); ctx.arc(-26, -6, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = !on ? '#ff3b5c' : '#601';
    ctx.beginPath(); ctx.arc(26, -6, 2, 0, Math.PI * 2); ctx.fill();

    ctx.restore();

    // targeting laser to cursor when close & idle
    const dist = Math.hypot(target.x - x, target.y - y);
    if (idle > 40 && dist < 220) {
      ctx.save();
      ctx.strokeStyle = `rgba(255,43,214,${Math.min(.5, (idle - 40) / 80)})`;
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(x, y + bob + 6); ctx.lineTo(target.x, target.y); ctx.stroke();
      ctx.restore();
    }
  }

  function reticle() {
    const { x, y } = target;
    const r = 12 + Math.sin(t * 4) * 2 + clickPulse * 18;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * .8);
    ctx.strokeStyle = 'rgba(34,240,255,.85)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath(); ctx.arc(0, 0, r, -.4, .4); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#22f0ff';
    ctx.fillRect(x - 1, y - 1, 2, 2);
    clickPulse *= .88;
  }

  function frame() {
    if (!visible) return;
    t += 1 / 60;
    d.rot += .9;

    // hover offset: hang above-left of the cursor
    const tx = target.x - 46, ty = target.y - 56;
    const ax = (tx - d.x) * .012, ay = (ty - d.y) * .012;
    d.vx = (d.vx + ax) * .9;
    d.vy = (d.vy + ay) * .9;
    d.x += d.vx; d.y += d.vy;
    d.tilt += ((d.vx * .045) - d.tilt) * .15;
    idle = Math.hypot(d.vx, d.vy) < .4 ? idle + 1 : 0;

    // thruster particles
    const speed = Math.hypot(d.vx, d.vy);
    const n = 1 + Math.min(4, speed * .4);
    for (let i = 0; i < n; i++) {
      parts.push({
        x: d.x + (Math.random() - .5) * 10, y: d.y + 10,
        vx: -d.vx * .25 + (Math.random() - .5) * .6, vy: 1.2 + Math.random() * 1.2 - d.vy * .2,
        life: 1, r: 1 + Math.random() * 2,
      });
    }

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.life -= .03;
      ctx.fillStyle = `rgba(${p.life > .6 ? '200,255,255' : '34,240,255'},${p.life * .7})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0, p.r * p.life), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    reticle();
    drawDrone();
    requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  addEventListener('mousemove', e => { target.x = e.clientX; target.y = e.clientY; });
  addEventListener('mousedown', () => {
    clickPulse = 1;
    // little burst
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 3;
      parts.push({ x: target.x, y: target.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, r: 1.5 });
    }
  });
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (visible) requestAnimationFrame(frame);
  });
  resize();
  frame();
})();
