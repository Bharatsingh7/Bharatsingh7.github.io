// The room around the desk: walls with a real window, sunlight and god rays, day/night sky,
// RGB cove lighting and the neon signs. World units are metres; the back wall sits at z = BACK.
import * as THREE from 'three';
import { C, U, mat, mesh, rbox, canvasTexture, ledStrip } from './helpers.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const BACK = -.85, LEFT = -3.3, RIGHT = 3.6, CEIL = 3.1;
export const WIN = { x0: 1.75, x1: 2.85, y0: 1.25, y1: 2.55 };
const SUN_DIR = new THREE.Vector3(-1.15, -1.1, 1).normalize();   // direction the light travels

function noiseTexture(size, base, spread, repeat) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - .5) * spread;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  return t;
}

function planks() {
  const t = canvasTexture(512, 512, (ctx, w, h) => {
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      const shift = (r * 137) % 512;
      for (let k = -1; k < 3; k++) {
        const x = shift + k * 300;
        const l = 30 + ((r * 7 + k * 13) % 9) * 2;
        ctx.fillStyle = `hsl(26, 32%, ${l}%)`;
        ctx.fillRect(x, r * h / rows, 300, h / rows);
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x, r * h / rows, 2, h / rows);
      }
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, r * h / rows, w, 2);
      ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 1;
      for (let g = 0; g < 6; g++) { const y = r * h / rows + 6 + g * 10; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(w * .3, y + 3, w * .6, y - 3, w, y); ctx.stroke(); }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4);
  return t;
}

function drawSky(ctx, w, h, night) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  if (night) { g.addColorStop(0, '#060a1c'); g.addColorStop(.7, '#16234a'); g.addColorStop(1, '#2b2f55'); }
  else { g.addColorStop(0, '#6fb2e8'); g.addColorStop(.6, '#bfe3f2'); g.addColorStop(1, '#f6e7c4'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  if (night) {
    for (let i = 0; i < 90; i++) { ctx.fillStyle = `rgba(255,255,255,${.3 + Math.random() * .7})`; ctx.fillRect(Math.random() * w, Math.random() * h * .65, 1.5, 1.5); }
    ctx.fillStyle = '#f4f0d8'; ctx.shadowColor = '#f4f0d8'; ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.arc(w * .3, h * .22, 26, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#16234a'; ctx.beginPath(); ctx.arc(w * .3 + 11, h * .22 - 6, 23, 0, 7); ctx.fill();
  } else {
    const sun = ctx.createRadialGradient(w * .78, h * .16, 0, w * .78, h * .16, w * .35);
    sun.addColorStop(0, 'rgba(255,250,225,1)'); sun.addColorStop(.12, 'rgba(255,240,200,.9)'); sun.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    [[.2, .2, 1], [.55, .32, .8], [.85, .42, .6]].forEach(([x, y, s]) => {
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(w * x + (k - 2) * 26 * s, h * y + Math.abs(k - 2) * 6, 34 * s, 18 * s, 0, 0, 7); ctx.fill(); }
    });
  }
  // rolling hills and trees, because the outside should be green too
  [[.62, night ? '#1d3a3a' : '#7fb98a'], [.72, night ? '#15302c' : '#4f9a64'], [.84, night ? '#0e221e' : '#2f7449']].forEach(([y, c], i) => {
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h * y + Math.sin(x * .012 + i * 2) * 18 + Math.sin(x * .031 + i) * 8);
    ctx.lineTo(w, h); ctx.fill();
    for (let k = 0; k < 7; k++) {
      const x = ((k * 97 + i * 53) % 100) / 100 * w, yy = h * y + Math.sin(x * .012 + i * 2) * 18 - 6;
      ctx.beginPath(); ctx.arc(x, yy, 14 + i * 5, 0, 7); ctx.arc(x + 12 + i * 3, yy + 4, 11 + i * 4, 0, 7); ctx.fill();
    }
  });
  if (night) {
    ctx.fillStyle = 'rgba(255,214,140,.9)';
    [[.12, .8], [.47, .76], [.66, .88], [.9, .79]].forEach(([x, y]) => ctx.fillRect(w * x, h * y, 4, 4));
  }
}

// neon tube look: wide coloured glow, tighter glow, then a near-white core. path(ctx, W, H) strokes the shape.
function neonTexture(w, h, sign) {
  return canvasTexture(w, h, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = ctx.lineCap = 'round';
    const pass = (blur, lw, style, alpha) => {
      ctx.globalAlpha = alpha * sign.on;
      ctx.shadowColor = sign.color; ctx.shadowBlur = blur;
      ctx.strokeStyle = style; ctx.lineWidth = lw;
      sign.path(ctx, W, H);
    };
    pass(H * .2, H * .05, sign.color, .9);
    pass(H * .08, H * .035, sign.color, 1);
    pass(0, H * .014, '#fff6fb', .95);
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  });
}
const textPath = (font, get) => (ctx, W, H) => {
  ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.strokeText(get(), W / 2, H / 2 + H * .04);
};
function leafPath(ctx, W, H) {
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-.5); ctx.scale(W / 256, H / 256);
  ctx.beginPath();
  ctx.moveTo(0, 95); ctx.bezierCurveTo(-85, 40, -70, -60, 0, -100); ctx.bezierCurveTo(70, -60, 85, 40, 0, 95);
  ctx.moveTo(0, 120); ctx.lineTo(0, -70);
  [-40, -5, 30].forEach(y => { ctx.moveTo(0, y + 20); ctx.lineTo(-38, y - 8); ctx.moveTo(0, y + 20); ctx.lineTo(38, y - 8); });
  ctx.restore();
  ctx.stroke();
}

export function buildRoomShell(scene, q) {
  const group = new THREE.Group();
  scene.add(group);
  const live = [];   // things with an update(t, dt)

  // ---- floor, rug, walls
  const floor = mesh(new THREE.PlaneGeometry(RIGHT - LEFT + 2, 8), new THREE.MeshStandardMaterial({ map: planks(), roughness: .75 }), false);
  floor.rotation.x = -Math.PI / 2; floor.position.set((LEFT + RIGHT) / 2, 0, 3); floor.receiveShadow = true;
  group.add(floor);
  const rugTex = canvasTexture(256, 256, (ctx, w) => {
    const c = w / 2;
    ['#24463a', '#e7dcc4', '#2f5d49', '#c9805a', '#24463a'].forEach((col, i) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(c, c, c - i * 22, 0, 7); ctx.fill(); });
  });
  const rug = mesh(new THREE.CircleGeometry(1.25, 48), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }), false);
  rug.rotation.x = -Math.PI / 2; rug.position.set(.3, .004, .95); rug.receiveShadow = true; group.add(rug);

  const wallMat = new THREE.MeshStandardMaterial({ color: C.wall, roughness: .95, map: noiseTexture(128, '#d8d8d8', 18, [6, 3]) });
  const wallPanel = (x0, x1, y0, y1) => {
    const p = mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), wallMat);
    p.position.set((x0 + x1) / 2, (y0 + y1) / 2, BACK);
    group.add(p);
    return p;
  };
  // back wall, with a hole for the window
  wallPanel(LEFT, WIN.x0, 0, CEIL); wallPanel(WIN.x1, RIGHT, 0, CEIL);
  wallPanel(WIN.x0, WIN.x1, 0, WIN.y0); wallPanel(WIN.x0, WIN.x1, WIN.y1, CEIL);
  const side = mesh(new THREE.PlaneGeometry(6, CEIL), wallMat); side.rotation.y = Math.PI / 2; side.position.set(LEFT, CEIL / 2, 2.15); group.add(side);
  const side2 = mesh(new THREE.PlaneGeometry(6, CEIL), wallMat); side2.rotation.y = -Math.PI / 2; side2.position.set(RIGHT, CEIL / 2, 2.15); group.add(side2);
  const ceil = mesh(new THREE.PlaneGeometry(RIGHT - LEFT, 6), mat(0x22322a, 1)); ceil.rotation.x = Math.PI / 2; ceil.position.set((LEFT + RIGHT) / 2, CEIL, 2.15); group.add(ceil);
  // lower wall: wooden wainscot
  const wains = mesh(new THREE.BoxGeometry(RIGHT - LEFT, .9, .02), mat(C.wallDark, .8)); wains.position.set((LEFT + RIGHT) / 2, .45, BACK + .01); group.add(wains);
  const cap = mesh(new THREE.BoxGeometry(RIGHT - LEFT, .025, .04), mat(0x5a4330, .6)); cap.position.set((LEFT + RIGHT) / 2, .91, BACK + .02); group.add(cap);
  group.traverse(o => { if (o.isMesh && o !== floor && o !== rug) { o.castShadow = true; o.receiveShadow = true; } });

  // ---- window: frame, sill, sky outside
  const frameMat = mat(0xefe8da, .5);
  const fw = .05, cx = (WIN.x0 + WIN.x1) / 2, cy = (WIN.y0 + WIN.y1) / 2, ww = WIN.x1 - WIN.x0, wh = WIN.y1 - WIN.y0;
  [[cx, WIN.y1, ww + fw, fw], [cx, WIN.y0, ww + fw, fw], [cx, cy, ww, fw * .5]].forEach(([x, y, w, h]) => { const b = rbox(w, h, .08, .01, frameMat); b.position.set(x, y, BACK); group.add(b); });
  [[WIN.x0, wh], [WIN.x1, wh], [cx, wh]].forEach(([x, h], i) => { const b = rbox(i === 2 ? fw * .5 : fw, h, .08, .01, frameMat); b.position.set(x, cy, BACK); group.add(b); });
  const sill = rbox(ww + .16, .035, .2, .01, frameMat); sill.position.set(cx, WIN.y0 - .01, BACK + .08); group.add(sill);
  const skyTex = canvasTexture(512, 512, (ctx, w, h, night = false) => drawSky(ctx, w, h, night));
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(ww * 2.2, wh * 1.9), new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false }));
  sky.position.set(cx + .2, cy - .05, BACK - .9);
  group.add(sky);
  const windowHit = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ visible: false }));
  windowHit.position.set(cx, cy, BACK - .01);
  group.add(windowHit);

  // ---- sunlight: a warm key light that only gets in through the window (the wall casts the shadow)
  const sun = new THREE.DirectionalLight(0xffe2b0, 3.2);
  const sunTarget = new THREE.Vector3(1.0, .78, .1);
  sun.position.copy(sunTarget).addScaledVector(SUN_DIR, -7);
  sun.target.position.copy(sunTarget);
  if (q.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    Object.assign(sun.shadow.camera, { left: -2.6, right: 2.6, top: 2.4, bottom: -2.4, near: .5, far: 20 });
    sun.shadow.bias = -.0005; sun.shadow.normalBias = .03;
  }
  scene.add(sun, sun.target);

  // god rays: soft additive beams from the window panes along the light direction, merged into one mesh
  const rayW = new THREE.Vector3().crossVectors(SUN_DIR, new THREE.Vector3(0, 0, 1)).normalize();
  const beams = [];
  const R = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < 7; i++) {
    const o = new THREE.Vector3(R(WIN.x0 + .1, WIN.x1 - .1), R(WIN.y0 + .15, WIN.y1 - .1), BACK + .02);
    const len = R(2.2, 3.2), w = R(.12, .34);
    const g = new THREE.PlaneGeometry(w, len, 1, 1);
    const basis = new THREE.Matrix4().makeBasis(rayW, SUN_DIR.clone().negate(), new THREE.Vector3().crossVectors(rayW, SUN_DIR.clone().negate()));
    g.translate(0, -len / 2, 0).applyMatrix4(basis).translate(o.x, o.y, o.z);
    g.setAttribute('aPh', new THREE.BufferAttribute(new Float32Array(4).fill(Math.random() * 6), 1));
    beams.push(g);
  }
  const rays = new THREE.Mesh(mergeGeometries(beams), new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uDay: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `attribute float aPh; varying vec2 vUv; varying float vPh; void main() { vUv = uv; vPh = aPh; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uTime, uDay; varying vec2 vUv; varying float vPh;
      void main() {
        float edge = pow(sin(vUv.x * 3.14159), 2.);
        float fade = smoothstep(0., .25, vUv.y) * smoothstep(1., .55, 1. - vUv.y);
        float a = edge * fade * (.55 + .45 * sin(uTime * .6 + vPh)) * .13 * uDay;
        gl_FragColor = vec4(vec3(1., .86, .6) * a, 1.);
      }`,
  }));
  rays.renderOrder = 2;
  group.add(rays);

  // dust motes drifting in the sunbeams
  let dust = null;
  if (q.dust) {
    const N = 140, pos = new Float32Array(N * 3), ph = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const o = new THREE.Vector3(R(WIN.x0, WIN.x1), R(WIN.y0, WIN.y1), BACK).addScaledVector(SUN_DIR, R(.1, 2.4));
      pos.set([o.x, o.y, o.z], i * 3); ph[i] = Math.random() * 6.28;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
    dust = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uDay: rays.material.uniforms.uDay, uScale: { value: 1 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uTime, uScale; attribute float aPh; varying float vA;
        void main() {
          vec3 p = position + vec3(sin(uTime * .21 + aPh) * .06, sin(uTime * .13 + aPh * 2.) * .08, cos(uTime * .17 + aPh) * .05);
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          gl_PointSize = uScale * 7. / -mv.z;
          vA = .5 + .5 * sin(uTime * .9 + aPh * 3.);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform float uDay; varying float vA; void main() { float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vec3(1., .92, .75) * smoothstep(.5, 0., d) * vA * .8 * uDay, 1.); }`,
    }));
    dust.frustumCulled = false;
    group.add(dust);
  }

  // ---- RGB: cove strip under the ceiling, bias lighting behind the desk, a strip on the desk lip
  const strips = [
    [ledStrip(RIGHT - LEFT - .2, { spill: .5, u0: 0, u1: 2.2 }), (LEFT + RIGHT) / 2, CEIL - .14, BACK + .02],
    [ledStrip(2.6, { spill: .55, u0: .2, u1: 1.2 }), -.1, 1.02, BACK + .02],
  ];
  strips.forEach(([s, x, y, z]) => { s.position.set(x, y, z); group.add(s); });

  // ---- neon signs
  const neon = [];
  function sign(path, color, w, h, pos, size) {
    const s = { path, color, on: 1, flick: 0 };
    s.tex = neonTexture(w, h, s);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * h / w), new THREE.MeshBasicMaterial({ map: s.tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    m.position.copy(pos);
    const plate = mesh(new THREE.PlaneGeometry(size * .92, size * h / w * .8), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .018, roughness: .1 }), false);
    plate.position.copy(pos).add(new THREE.Vector3(0, 0, -.006));
    group.add(plate, m);
    s.mesh = m;
    neon.push(s);
    return s;
  }
  const sc = q.tex;
  let name = 'hello';
  const nameSign = sign(textPath(`400 ${Math.round(170 * sc)}px Yellowtail, "Brush Script MT", cursive`, () => name), '#ff5fae', 1024 * sc, 300 * sc, new THREE.Vector3(.18, 2.3, BACK + .03), 1.25);
  const leafSign = sign(leafPath, '#7dffa8', 256 * sc, 256 * sc, new THREE.Vector3(-.85, 2.28, BACK + .03), .34);
  const codeSign = sign(textPath(`700 ${Math.round(110 * sc)}px "JetBrains Mono", monospace`, () => '</>'), '#6fd3ff', 400 * sc, 220 * sc, new THREE.Vector3(1.32, 2.36, BACK + .03), .38);
  const NEON_COLORS = ['#ff5fae', '#7dffa8', '#6fd3ff', '#ffb35f', '#c59bff'];

  // ---- day/night
  let day = 1, dayTarget = 1;
  const api = {
    group, sun, sky, windowHit, neon, strips,
    get dust() { return dust; },
    signs: [nameSign.mesh, leafSign.mesh, codeSign.mesh],
    get day() { return day; },
    get isDay() { return dayTarget === 1; },
    setDay(on, instant = false) {
      dayTarget = on ? 1 : 0;
      if (instant) day = dayTarget;
      skyTex.redraw(!on);
    },
    setName(n) { name = n; redrawSign(nameSign); },
    poke(mesh) {
      const s = neon.find(n => n.mesh === mesh);
      if (!s) return;
      s.flick = 1.2;
      s.color = NEON_COLORS[(NEON_COLORS.indexOf(s.color) + 1) % NEON_COLORS.length];
    },
    redrawFonts() { neon.forEach(redrawSign); },
    update(t, dt) {
      day += Math.sign(dayTarget - day) * Math.min(Math.abs(dayTarget - day), dt / 1.5);
      rays.material.uniforms.uDay.value = day;
      if (dust) dust.material.uniforms.uScale.value = innerHeight / 900 * Math.min(devicePixelRatio, 2);
      for (const s of neon) {
        if (s.flick > 0) {
          s.flick -= dt;
          const on = s.flick <= 0 ? 1 : (Math.sin(s.flick * 60) > .2 || s.flick < .3 ? 1 : .15);
          if (on !== s.on) { s.on = on; redrawSign(s); }
        }
      }
      live.forEach(f => f(t, dt));
    },
  };
  function redrawSign(s) { s.tex.redraw(); }
  return api;
}
