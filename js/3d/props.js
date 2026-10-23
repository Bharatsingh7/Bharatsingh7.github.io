// Everything on (and above) the desk. Each builder returns { group, update?(t, dt), onClick?() }.
// Builders work in desk-surface coordinates: y = 0 is the top of the desk.
import * as THREE from 'three';
import { C, mat, glow, mesh, rbox, rod, tube, canvasTexture, rgbAt, bake, ease, rand, pick } from './helpers.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const HAND = '600 34px Caveat, "Comic Sans MS", cursive';

// ---------------------------------------------------------------- monitor + terminal
export function buildMonitor() {
  const group = new THREE.Group();
  const shell = mat(0x1a1c25, .35, .4);
  const base = rbox(.32, .015, .2, .006, shell); base.position.y = .008; group.add(base);
  const neck = rbox(.06, .32, .03, .01, shell); neck.position.set(0, .17, -.06); group.add(neck);
  const body = rbox(1.08, .62, .035, .015, shell); body.position.set(0, .48, -.03); group.add(body);

  const term = {
    intro: [['$ ', 'whoami'], ['', '...'], ['$ ', 'aria --listen'], ['', 'ready.']],
    lines: [], typing: null, shown: 0, dirty: true, cursor: true,
  };
  let frame = 0;
  term.lines = term.intro.slice();
  const wrap = (text, max) => {
    const out = []; let line = '';
    for (const w of text.split(' ')) {
      if ((line + ' ' + w).trim().length > max) { out.push(line); line = w; } else line = (line + ' ' + w).trim();
    }
    if (line) out.push(line);
    return out;
  };
  const tex = canvasTexture(1024, 576, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#11152a'); g.addColorStop(1, '#0a0d1b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1a1f38'; ctx.fillRect(0, 0, W, 46);
    ['#ff6b6b', '#ffcf5c', '#7ee0c3'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(28 + i * 26, 23, 7, 0, 7); ctx.fill(); });
    ctx.fillStyle = '#8c90b0'; ctx.font = '500 20px "JetBrains Mono", monospace';
    ctx.fillText('aria — ~/resume', 120, 30);
    const rows = [];
    for (const [p, t] of term.lines) wrap(t, 60).forEach((l, i) => rows.push([i ? '' : p, l, p ? 'cmd' : 'out']));
    if (term.typing != null) {
      const vis = term.typing.slice(0, term.shown);
      const w = wrap(vis, 60);
      (w.length ? w : ['']).forEach(l => rows.push(['', l, 'out']));
    }
    const lh = 34, view = rows.slice(-Math.floor((H - 80) / lh));
    ctx.font = '400 24px "JetBrains Mono", monospace';
    view.forEach(([p, t, kind], i) => {
      const y = 92 + i * lh;
      let x = 36;
      if (p) { ctx.fillStyle = '#ff9e64'; ctx.fillText(p, x, y); x += ctx.measureText(p).width; }
      ctx.fillStyle = kind === 'cmd' ? '#ece9f4' : '#a9adc8';
      ctx.fillText(t, x, y);
      if (i === view.length - 1 && term.cursor) { ctx.fillStyle = '#ff9e64'; ctx.fillRect(x + ctx.measureText(t).width + 6, y - 20, 12, 26); }
    });
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.02, .574), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  screen.position.set(0, .48, -.011);
  group.add(screen);
  const glowLight = new THREE.PointLight(0x8fa8ff, .9, 1.8, 2);
  glowLight.position.set(0, .48, .35);
  group.add(glowLight);

  // sticky notes on the bezel
  [['TODO: sleep', 0xffe27a, .44, .2, -.12], ['git push\n--force?\nno.', 0xff9ec4, .36, .14, .08]].forEach(([text, color, x, y, rot]) => {
    const t = canvasTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(0,0,0,.06)'; ctx.fillRect(0, 0, w, 18);
      ctx.fillStyle = '#2a2a3a'; ctx.font = HAND; ctx.textAlign = 'center';
      text.split('\n').forEach((l, i, a) => ctx.fillText(l, w / 2, h / 2 + 10 + (i - (a.length - 1) / 2) * 30));
    });
    const note = mesh(new THREE.PlaneGeometry(.1, .1), new THREE.MeshStandardMaterial({ map: t, roughness: .9 }), false);
    note.position.set(x, y + .17, .0);
    note.rotation.z = rot;
    note.userData.tex = t;
    group.add(note);
  });

  return {
    group,
    say(q, text) {
      if (term.typing != null) term.lines.push(['', term.typing]);
      term.lines.push(['$ ', q ? `aria ask "${q.slice(0, 38)}"` : 'aria say']);
      term.typing = text; term.shown = 0; term.dirty = true;
      term.lines = term.lines.slice(-30);
    },
    setIntro(lines) { term.intro = lines; term.lines = lines.slice(); term.typing = null; term.dirty = true; },
    redrawFonts() { term.dirty = true; group.traverse(o => o.userData.tex?.redraw()); },
    update(t) {
      frame++;
      if (term.typing && term.shown < term.typing.length) { term.shown = Math.min(term.typing.length, term.shown + 2); term.dirty = true; }
      const cur = Math.floor(t * 2) % 2 === 0;
      if (cur !== term.cursor) { term.cursor = cur; term.dirty = true; }
      if (term.dirty && frame % 2 === 0) { tex.redraw(); term.dirty = false; }
      glowLight.intensity = .8 + Math.sin(t * 3) * .05;
    },
  };
}

// ---------------------------------------------------------------- keyboard + mouse, with per-key RGB
export function buildKeyboard() {
  const group = new THREE.Group();
  const kb = rbox(.5, .02, .16, .008, mat(0x23262f, .5, .2)); kb.position.y = .01; group.add(kb);
  const keys = new THREE.InstancedMesh(new THREE.BoxGeometry(.026, .012, .026), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .5 }), 56);
  keys.castShadow = true;
  const m4 = new THREE.Matrix4(), col = new THREE.Color(), base = new THREE.Color(0x2b2f3a);
  for (let r = 0, i = 0; r < 4; r++) for (let c = 0; c < 14; c++, i++) {
    m4.setPosition(-.218 + c * .0335, .026, -.05 + r * .034);
    keys.setMatrixAt(i, m4);
    keys.setColorAt(i, base);
  }
  group.add(keys);
  const mouse = rbox(.06, .025, .1, .012, mat(0x23262f, .45, .2)); mouse.position.set(.36, .012, .02); group.add(mouse);
  let frame = 0;
  return {
    group,
    update() {
      if (frame++ % 2) return;
      for (let r = 0, i = 0; r < 4; r++) for (let c = 0; c < 14; c++, i++) keys.setColorAt(i, col.copy(base).lerp(rgbAt(c / 14 * .6 + r * .05), .7));
      keys.instanceColor.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------- mug with a label and steam
export function buildMug() {
  const group = new THREE.Group();
  const label = canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#ece6dc'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2b2d3c'; ctx.font = '600 30px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText('it works on', w * .25, 56); ctx.fillText('my machine', w * .25, 92);
  });
  const white = mat(0xece6dc, .4);
  const cup = mesh(new THREE.CylinderGeometry(.045, .04, .11, 40, 1, true), new THREE.MeshStandardMaterial({ map: label, roughness: .4, side: THREE.DoubleSide }));
  cup.position.y = .055; cup.rotation.y = -2.9; group.add(cup);
  const bottom = mesh(new THREE.CircleGeometry(.04, 24), white); bottom.rotation.x = -Math.PI / 2; bottom.position.y = .002; group.add(bottom);
  const coffee = mesh(new THREE.CircleGeometry(.042, 24), mat(0x3b2418, .2)); coffee.rotation.x = -Math.PI / 2; coffee.position.y = .1; group.add(coffee);
  const handle = mesh(new THREE.TorusGeometry(.026, .008, 10, 20, Math.PI), white);
  handle.rotation.z = -Math.PI / 2; handle.position.set(.045, .057, 0); group.add(handle);
  const puffs = [0, 1, 2].map(i => {
    const p = mesh(new THREE.SphereGeometry(.02, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .1, depthWrite: false }), false);
    group.add(p); return p;
  });
  return {
    group,
    update(t) {
      puffs.forEach((p, i) => {
        const u = (t * .35 + i / 3) % 1;
        p.position.set(Math.sin(u * 6 + i) * .012, .11 + u * .16, 0);
        p.scale.setScalar(.5 + u * 1.4);
        p.material.opacity = Math.sin(u * Math.PI) * .12;
      });
    },
  };
}

// ---------------------------------------------------------------- rubber debugging duck
export function buildDuck(fx) {
  const group = new THREE.Group();
  const yellow = mat(0xffd84a, .35);
  const inner = new THREE.Group(); inner.userData.live = true; group.add(inner);
  const body = mesh(new THREE.SphereGeometry(.045, 24, 18), yellow); body.scale.set(1, .78, 1.2); body.position.y = .035; inner.add(body);
  const tail = mesh(new THREE.ConeGeometry(.02, .04, 12), yellow); tail.position.set(0, .05, -.055); tail.rotation.x = -1.1; inner.add(tail);
  const head = mesh(new THREE.SphereGeometry(.03, 20, 16), yellow); head.position.set(0, .085, .03); inner.add(head);
  const beak = mesh(new THREE.ConeGeometry(.013, .03, 12), mat(0xff8a3d, .4)); beak.rotation.x = Math.PI / 2; beak.scale.set(1.2, 1, .55); beak.position.set(0, .08, .064); inner.add(beak);
  [-1, 1].forEach(s => { const e = mesh(new THREE.SphereGeometry(.005, 8, 6), mat(0x111111, .2), false); e.position.set(s * .014, .092, .055); inner.add(e); });
  const lines = ['Quack.', 'Have you tried printing it?', 'Quack. Off by one?', "It's always DNS. Quack.", 'Explain it to me slowly.'];
  let hit = -10, n = 0;
  return {
    group,
    update(t) {
      const lt = t - hit;
      if (lt < 1) {
        inner.position.y = Math.abs(Math.sin(lt * Math.PI * 2)) * .05 * (1 - lt);
        inner.scale.set(1 + Math.sin(lt * 20) * .08 * (1 - lt), 1 - Math.sin(lt * 20) * .1 * (1 - lt), 1);
      } else { inner.position.y = 0; inner.scale.setScalar(1); }
      inner.rotation.y = Math.sin(t * .5) * .1;
      group.userData.t = t;
    },
    onClick() { hit = group.userData.t || 0; fx.say(group, lines[n++ % lines.length], { offset: [0, .15, 0] }); },
  };
}

// ---------------------------------------------------------------- sleeping cat
export function buildCat(fx) {
  const group = new THREE.Group();
  const fur = mat(0xe39b5a, .8), cream = mat(0xf3dcc0, .85), dark = mat(0x2a1a14, .6);
  const body = mesh(new THREE.SphereGeometry(.1, 28, 20), fur); body.scale.set(1.35, .62, 1.05); body.position.y = .055; body.userData.live = true; group.add(body);
  for (let i = 0; i < 3; i++) {
    const stripe = mesh(new THREE.TorusGeometry(.095, .006, 6, 24, 1.2), mat(0xc77a3e, .8), false);
    stripe.rotation.set(Math.PI / 2, 0, -.6 + i * .5); stripe.scale.set(1.36, 1.05, .6); stripe.position.y = .085; group.add(stripe);
  }
  const headPivot = new THREE.Group(); headPivot.position.set(.1, .05, .06); headPivot.userData.live = true; group.add(headPivot);
  const head = mesh(new THREE.SphereGeometry(.055, 24, 18), fur); head.scale.set(1, .88, .95); head.position.set(.03, .015, .02); headPivot.add(head);
  const muzzle = mesh(new THREE.SphereGeometry(.025, 16, 12), cream); muzzle.scale.set(1, .7, .8); muzzle.position.set(.06, .0, .05); headPivot.add(muzzle);
  const nose = mesh(new THREE.SphereGeometry(.006, 8, 6), mat(0xe87a8a, .5), false); nose.position.set(.074, .01, .068); headPivot.add(nose);
  const ears = [-1, 1].map(s => {
    const ear = mesh(new THREE.ConeGeometry(.02, .04, 4), fur);
    ear.position.set(.03 + s * .028, .06, .01 + s * -.01); ear.rotation.z = -s * .25;
    headPivot.add(ear); return ear;
  });
  const eyes = [-1, 1].map(s => {
    const e = mesh(new THREE.SphereGeometry(.008, 10, 8), dark, false);
    e.position.set(.05 + s * .022, .028, .055 - s * .005); e.scale.y = .2;
    headPivot.add(e); return e;
  });
  // tail as a chain of beads so it can swish (one instanced mesh, cream tip)
  const N = 9, beads = new THREE.InstancedMesh(new THREE.SphereGeometry(.018, 12, 10), mat(0xffffff, .8), N);
  beads.castShadow = true; beads.userData.live = true;
  const furCol = new THREE.Color(0xe39b5a), creamCol = new THREE.Color(0xf3dcc0);
  for (let i = 0; i < N; i++) beads.setColorAt(i, i > 6 ? creamCol : furCol);
  beads.frustumCulled = false;
  group.add(beads);
  const bm = new THREE.Matrix4(), bq = new THREE.Quaternion(), bs = new THREE.Vector3(), bp = new THREE.Vector3();
  const paws = [-1, 1].map(s => { const p = mesh(new THREE.SphereGeometry(.02, 12, 10), cream); p.scale.set(1.3, .7, 1); p.position.set(.11 + s * .01, .015, .1 + s * .03); group.add(p); return p; });

  const st = { awake: 0, awakeAt: -10, nextZ: 3, twitch: -10, t: 0 };
  const api = {
    group,
    wake(text = 'Meow?') {
      st.awakeAt = st.t;
      fx.say(headPivot, text, { offset: [0, .12, 0] });
    },
    twitch() { st.twitch = st.t; },
    update(t) {
      st.t = t;
      const awake = t - st.awakeAt < 3.5;
      st.awake += ((awake ? 1 : 0) - st.awake) * .08;
      body.scale.y = .62 * (1 + Math.sin(t * 1.8) * .03);
      headPivot.rotation.z = st.awake * .35 + Math.sin(t * 1.8) * .01;
      headPivot.rotation.y = st.awake * Math.sin(t * 1.5) * .2;
      eyes.forEach(e => { e.scale.y = .2 + st.awake * .9; });
      const tw = t - st.twitch;
      ears.forEach((e, i) => { e.rotation.x = (tw < .3 || (Math.sin(t * .7 + i * 3) > .995)) ? Math.sin(t * 40) * .3 : 0; });
      // tail curls around the body and swishes at the tip
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1);
        const a = Math.PI * .95 + u * 2.2 + (u * u) * Math.sin(t * (awake ? 4 : 1.2)) * (awake ? .6 : .25);
        bp.set(Math.cos(a) * .13 * (1 - u * .1), .02 + u * .015, Math.sin(a) * .1 + .01);
        beads.setMatrixAt(i, bm.compose(bp, bq, bs.setScalar(1 - i * .045)));
      }
      beads.instanceMatrix.needsUpdate = true;
      if (!awake && t > st.nextZ) { st.nextZ = t + rand(4, 7); fx.say(headPivot, 'z', { emoji: true, dur: 1800, offset: [0, .1, 0] }); }
    },
    onClick() { api.wake(pick(['Meow?', 'Mrrp.', '...five more minutes.', 'Purr.'])); },
  };
  return api;
}

// ---------------------------------------------------------------- Rubik's cube
export function buildCube(fx) {
  const group = new THREE.Group();
  const s = .018, gap = .0012;
  // one material with vertex colours per face, so the 27 cubies cost 27 draw calls rather than 162
  const faces = [0xd8343a, 0xff8a1f, 0xf4f4f4, 0xffd23f, 0x2fa84f, 0x2a64d8].map(c => new THREE.Color(c));
  const black = new THREE.Color(0x111216);
  const cubeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .35 });
  const cubie = (x, y, z) => {
    const g = new THREE.BoxGeometry(s, s, s);
    const on = [x === 1, x === -1, y === 1, y === -1, z === 1, z === -1];
    const cols = new Float32Array(24 * 3);
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) (on[f] ? faces[f] : black).toArray(cols, (f * 4 + v) * 3);
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return g;
  };
  const holder = new THREE.Group(); holder.position.y = s * 1.5 + gap; holder.userData.live = true; group.add(holder);
  const cubies = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    const m = mesh(cubie(x, y, z), cubeMat);
    m.position.set(x * (s + gap), y * (s + gap), z * (s + gap));
    holder.add(m); cubies.push(m);
  }
  const pivot = new THREE.Group(); holder.add(pivot);
  let turn = null;
  // while nobody is twisting it, draw the cube as one merged mesh (1 draw call instead of 27)
  let solid = null;
  function freeze() {
    holder.updateMatrixWorld(true);
    const inv = holder.matrixWorld.clone().invert();
    solid = mesh(mergeGeometries(cubies.map(c => c.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld)))), cubeMat);
    holder.add(solid);
    cubies.forEach(c => { c.visible = false; });
  }
  function thaw() { if (!solid) return; solid.removeFromParent(); solid.geometry.dispose(); solid = null; cubies.forEach(c => { c.visible = true; }); }
  freeze();
  const quips = ['Solved it. Probably.', 'R U R′ U′', 'One more twist…'];
  return {
    group,
    update(t, dt) {
      holder.rotation.y = Math.sin(t * .3) * .05 + .5;
      if (!turn) return;
      turn.p = Math.min(1, turn.p + dt / .35);
      pivot.rotation[turn.axis] = ease.inOut(turn.p) * turn.dir * Math.PI / 2;
      if (turn.p >= 1) {
        pivot.updateMatrixWorld();
        turn.list.forEach(c => {
          holder.attach(c);
          c.position.multiplyScalar(1 / (s + gap)).round().multiplyScalar(s + gap);
          const e = c.rotation; e.set(Math.round(e.x / (Math.PI / 2)) * Math.PI / 2, Math.round(e.y / (Math.PI / 2)) * Math.PI / 2, Math.round(e.z / (Math.PI / 2)) * Math.PI / 2);
        });
        pivot.rotation.set(0, 0, 0);
        turn = null;
        freeze();
      }
    },
    onClick() {
      if (turn) return;
      thaw();
      const axis = pick(['x', 'y', 'z']), layer = pick([-1, 0, 1]), dir = pick([-1, 1]);
      const list = cubies.filter(c => Math.round(c.position[axis] / (s + gap)) === layer);
      list.forEach(c => pivot.attach(c));
      turn = { axis, dir, list, p: 0 };
      if (Math.random() < .35) fx.say(group, pick(quips), { offset: [0, .12, 0] });
    },
  };
}

// ---------------------------------------------------------------- pizza box with one slice missing
export function buildPizza() {
  const group = new THREE.Group();
  const card = mat(0xc89a62, .9);
  const base = mesh(new THREE.BoxGeometry(.26, .018, .26), card); base.position.y = .009; group.add(base);
  const lidTex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c89a62'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7a4a22'; ctx.textAlign = 'center';
    ctx.font = '700 30px "JetBrains Mono", monospace'; ctx.fillText('404', w / 2, 112);
    ctx.font = '500 20px "JetBrains Mono", monospace'; ctx.fillText('slice not found', w / 2, 146);
  });
  const hinge = new THREE.Group(); hinge.position.set(0, .018, -.13); group.add(hinge);
  const lid = mesh(new THREE.BoxGeometry(.26, .006, .26), [card, card, new THREE.MeshStandardMaterial({ map: lidTex, roughness: .9 }), card, card, card]);
  lid.position.set(0, 0, .13); lid.rotation.y = Math.PI; hinge.add(lid);
  hinge.rotation.x = -1.95;
  const slices = 6, missing = TAU / slices;
  const crust = mesh(new THREE.CircleGeometry(.112, 48, missing, TAU - missing), mat(0xc98a3d, .7)); crust.rotation.x = -Math.PI / 2; crust.position.y = .0185; group.add(crust);
  const cheese = mesh(new THREE.CircleGeometry(.098, 48, missing, TAU - missing), mat(0xf2c14e, .55)); cheese.rotation.x = -Math.PI / 2; cheese.position.y = .019; group.add(cheese);
  const pep = mat(0xb5352b, .5);
  for (let i = 0; i < 12; i++) {
    const a = missing + .25 + (i / 12) * (TAU - missing - .5), r = .03 + (i % 3) * .022;
    const p = mesh(new THREE.CylinderGeometry(.012, .012, .003, 16), pep, false);
    p.position.set(Math.cos(a) * r, .02, -Math.sin(a) * r); group.add(p);
  }
  return { group };
}

// ---------------------------------------------------------------- energy drink pyramid
export function buildCans() {
  const group = new THREE.Group();
  const label = canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#9be84f'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#16210b'; ctx.font = '800 44px "Space Grotesk", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('BYTE', w * .25, 78); ctx.fillText('BYTE', w * .75, 78);
  });
  const side = new THREE.MeshStandardMaterial({ map: label, roughness: .35, metalness: .3 });
  const spots = [[-1, 0], [0, 0], [1, 0], [-.5, 1], [.5, 1], [0, 2]];
  // all six cans share one label mesh and one caps mesh
  const body = [], caps = [];
  spots.forEach(([x, row], i) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x * .046, .04 + row * .081, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 1.3), new THREE.Vector3(1, 1, 1));
    body.push(new THREE.CylinderGeometry(.022, .022, .08, 28, 1, true).applyMatrix4(m));
    [.04, -.04].forEach(y => caps.push(new THREE.CircleGeometry(.022, 20).rotateX(y > 0 ? -Math.PI / 2 : Math.PI / 2).translate(0, y, 0).applyMatrix4(m)));
  });
  group.add(mesh(mergeGeometries(body), side), mesh(mergeGeometries(caps), mat(0xc7cad3, .25, .9)));
  return { group };
}

// ---------------------------------------------------------------- mini robotic arm doing pick-and-place
export function buildArm() {
  const group = new THREE.Group();
  const orange = mat(C.accent, .4, .1), dark = mat(C.dark, .4, .4), steel = mat(0xb9bcc6, .3, .8);
  const base = mesh(new THREE.CylinderGeometry(.045, .055, .03, 32), dark); base.position.y = .015; group.add(base);
  const turret = new THREE.Group(); turret.position.y = .03; turret.userData.live = true; group.add(turret);
  turret.add(mesh(new THREE.CylinderGeometry(.03, .035, .03, 24), orange));
  const L1 = .12, L2 = .1, SH = .03;
  const shoulder = new THREE.Group(); shoulder.position.y = SH; turret.add(shoulder);
  const link1 = rbox(L1, .02, .022, .008, orange); link1.position.x = L1 / 2; shoulder.add(link1);
  const elbow = new THREE.Group(); elbow.position.x = L1; shoulder.add(elbow);
  elbow.add(mesh(new THREE.CylinderGeometry(.014, .014, .03, 16), dark).rotateX(Math.PI / 2));
  const link2 = rbox(L2, .016, .018, .006, orange); link2.position.x = L2 / 2; elbow.add(link2);
  const wrist = new THREE.Group(); wrist.position.x = L2; elbow.add(wrist);
  const fingers = [-1, 1].map(s => { const f = mesh(new THREE.BoxGeometry(.03, .006, .006), steel); f.position.set(-.025, 0, s * .012); wrist.add(f); return f; });
  wrist.add(mesh(new THREE.BoxGeometry(.012, .01, .034), dark));
  const tip = new THREE.Object3D(); tip.position.x = -.042; wrist.add(tip);

  const block = rbox(.024, .024, .024, .004, mat(C.mint, .4)); block.userData.live = true; group.add(block);
  // stations in the arm's own frame: yaw (radians) and reach
  const spots = [{ yaw: .7, r: .15 }, { yaw: -.9, r: .14 }];
  const spotPos = s => new THREE.Vector3(Math.cos(s.yaw) * s.r, .012, -Math.sin(s.yaw) * s.r);
  block.position.copy(spotPos(spots[0]));

  // keyframes: yaw, reach, height of the gripper tip above the shoulder, grip
  const keys = (a, b) => [
    [a.yaw, a.r, .06, 0, 1], [a.yaw, a.r, -.006, 0, .7], [a.yaw, a.r, -.006, 1, .4], [a.yaw, a.r, .07, 1, .7],
    [b.yaw, b.r, .07, 1, 1.4], [b.yaw, b.r, -.006, 1, .7], [b.yaw, b.r, -.006, 0, .4], [b.yaw, b.r, .08, 0, .7], [0, .1, .12, 0, 1.6],
  ];
  let from = 0, seq = keys(spots[0], spots[1]), k = 0, kt = 0, holding = false;
  let cur = [0, .1, .12, 0];
  const v = new THREE.Vector3();

  function solve(yaw, r, h) {
    turret.rotation.y = yaw;
    const d = Math.min(Math.hypot(r, h), L1 + L2 - .001);
    const t1 = Math.atan2(h, r) + Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
    const ex = Math.cos(t1) * L1, ey = Math.sin(t1) * L1;
    const t2 = Math.atan2(h - ey, r - ex);
    shoulder.rotation.z = t1;
    elbow.rotation.z = t2 - t1;
    wrist.rotation.z = -Math.PI / 2 - t2 + Math.PI;
  }
  return {
    group,
    update(t, dt) {
      const prev = seq[(k + seq.length - 1) % seq.length], next = seq[k];
      kt += dt / next[4];
      const p = ease.inOut(Math.min(1, kt));
      cur = [0, 1, 2].map(i => prev[i] + (next[i] - prev[i]) * p);
      solve(cur[0], cur[1], cur[2] + .006);
      const grip = next[3] && p > .5 ? 1 : prev[3] && !(next[3] === 0 && p > .5) ? 1 : 0;
      fingers.forEach((f, i) => { f.position.z = (i ? 1 : -1) * (grip ? .0125 : .02); });
      if (grip && !holding && kt >= 1) holding = true;
      if (!grip && holding) { holding = false; const dest = spotPos(spots[1 - from]); block.position.copy(dest); block.rotation.set(0, 0, 0); from = 1 - from; }
      if (holding) { tip.getWorldPosition(v); group.worldToLocal(v); block.position.copy(v); block.rotation.y = turret.rotation.y; }
      if (kt >= 1) {
        kt = 0; k++;
        if (k >= seq.length) { k = 1; seq = keys(spots[from], spots[1 - from]); }
      }
    },
  };
}

// ---------------------------------------------------------------- Arduino + breadboard with traffic-light LEDs
export function buildBreadboard() {
  const group = new THREE.Group();
  const holes = canvasTexture(256, 96, (ctx, w, h) => {
    ctx.fillStyle = '#eeeae2'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c9c3b6';
    for (let x = 8; x < w; x += 10) for (const y of [10, 18, 30, 38, 46, 54, 66, 78, 86]) ctx.fillRect(x, y, 4, 4);
    ctx.fillStyle = '#d9534f'; ctx.fillRect(0, 2, w, 2); ctx.fillStyle = '#4a6fd9'; ctx.fillRect(0, h - 4, w, 2);
  });
  const bb = mesh(new THREE.BoxGeometry(.17, .012, .064), [mat(0xeeeae2, .8), mat(0xeeeae2, .8), new THREE.MeshStandardMaterial({ map: holes, roughness: .8 }), mat(0xeeeae2, .8), mat(0xeeeae2, .8), mat(0xeeeae2, .8)]);
  bb.position.y = .006; group.add(bb);
  const ard = rbox(.1, .01, .07, .004, mat(0x1f6fb5, .45)); ard.position.set(-.15, .005, .0); group.add(ard);
  const chip = rbox(.035, .007, .012, .002, mat(0x14161c, .3, .3)); chip.position.set(-.14, .013, .01); group.add(chip);
  const usb = rbox(.022, .014, .018, .002, mat(0xb8bcc8, .25, .9)); usb.position.set(-.195, .016, -.02); group.add(usb);
  const header = rbox(.07, .008, .006, .001, mat(0x111216, .5)); header.position.set(-.15, .014, -.03); group.add(header);
  const wires = [[0xd9534f, -.12, -.04], [0x222222, -.13, -.02], [0xffd23f, -.14, .0], [0x4a90d9, -.16, .02]];
  wires.forEach(([c, x], i) => group.add(tube([[x, .015, -.03], [x + .02, .05 + i * .006, -.03], [-.05 + i * .02, .04, -.01], [-.03 + i * .02, .013, .0 + i * .004]], .0025, mat(c, .5))));
  const leds = [0xff4040, 0xffc040, 0x40ff80].map((c, i) => {
    const m = glow(c);
    const l = mesh(new THREE.SphereGeometry(.007, 12, 10), m, false); l.position.set(.02 + i * .03, .02, .0); group.add(l);
    const leg = mesh(new THREE.CylinderGeometry(.001, .001, .012, 4), mat(0xb8bcc8, .3, .9), false); leg.position.set(.02 + i * .03, .011, 0); group.add(leg);
    return { m, c };
  });
  return {
    group,
    update(t) {
      const phase = Math.floor(t / .9) % 3;
      leds.forEach(({ m, c }, i) => m.color.setHex(i === 2 - phase ? c : new THREE.Color(c).multiplyScalar(.15).getHex()));
    },
  };
}

// ---------------------------------------------------------------- Raspberry Pi with a spinning fan
export function buildPi() {
  const group = new THREE.Group();
  const board = rbox(.09, .008, .06, .003, mat(0x1f7a4a, .5)); board.position.y = .004; group.add(board);
  const caseMat = new THREE.MeshPhysicalMaterial({ color: 0xff5a7a, roughness: .2, transparent: true, opacity: .5, clearcoat: 1 });
  const shell = rbox(.1, .03, .07, .008, caseMat); shell.position.y = .017; group.add(shell);
  for (let i = 0; i < 3; i++) { const p = rbox(.016, .014, .014, .002, mat(0xb8bcc8, .25, .9)); p.position.set(.052, .012, -.02 + i * .02); group.add(p); }
  const fanG = new THREE.Group(); fanG.position.set(-.01, .034, 0); group.add(fanG);
  fanG.add(mesh(new THREE.CylinderGeometry(.02, .02, .004, 24), mat(0x111216, .5)));
  const blades = new THREE.Group(); blades.position.y = .003; blades.userData.live = true; fanG.add(blades);
  for (let i = 0; i < 5; i++) { const b = mesh(new THREE.BoxGeometry(.016, .001, .006), mat(0x2a2e3e, .5), false); b.position.x = .009; const h = new THREE.Group(); h.rotation.y = i * TAU / 5; h.add(b); b.rotation.x = .3; blades.add(h); }
  const led = glow(0xff3030);
  const l = mesh(new THREE.SphereGeometry(.003, 8, 6), led, false); l.position.set(-.04, .01, .025); group.add(l);
  return { group, update: t => { blades.rotation.y = t * 30; led.color.setHex(Math.sin(t * 9) > .6 ? 0x40ff80 : 0xff3030); } };
}

// ---------------------------------------------------------------- laptop on a stack of books, showing a live sensor graph
export function buildLaptop() {
  const group = new THREE.Group();
  const titles = [['DSA', 0x2c3e75, '#f4f1fa'], ['Clean Code', 0xd9774a, '#1a1c25'], ['Python', 0x3d7a5a, '#f4f1fa']];
  let y = 0;
  titles.forEach(([, color], i) => {
    const h = .032 + (i % 2) * .006;
    const cover = mesh(new THREE.BoxGeometry(.32, h, .23), mat(color, .7));
    const pages = mesh(new THREE.BoxGeometry(.31, h * .8, .222), mat(0xf2ede2, .9));
    [cover, pages].forEach(m => { m.position.set((i - 1) * .008 + (m === pages ? .006 : 0), y + h / 2, (i % 2) * .006); m.rotation.y = (i - 1) * .04; group.add(m); });
    y += h;
  });
  const alu = mat(0xb9bcc6, .35, .6);
  const lap = new THREE.Group(); lap.position.y = y; group.add(lap);
  const base = rbox(.3, .012, .21, .006, alu); base.position.y = .006; lap.add(base);
  const deck = mesh(new THREE.PlaneGeometry(.25, .09), mat(0x23262f, .6), false); deck.rotation.x = -Math.PI / 2; deck.position.set(0, .0125, -.02); lap.add(deck);
  const hinge = new THREE.Group(); hinge.position.set(0, .012, -.105); lap.add(hinge);
  const lid = rbox(.3, .008, .21, .004, alu); lid.position.z = .105; hinge.add(lid);
  hinge.rotation.x = -1.82;
  const data = Array.from({ length: 80 }, (_, i) => .5 + Math.sin(i * .3) * .2);
  const screen = canvasTexture(512, 340, (ctx, w, h) => {
    ctx.fillStyle = '#0b0e1b'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#8c90b0'; ctx.font = '500 18px "JetBrains Mono", monospace';
    ctx.fillText('sensor_dashboard.py', 18, 30);
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(18, 50 + i * 55); ctx.lineTo(w - 18, 50 + i * 55); ctx.stroke(); }
    [['#ff9e64', 0], ['#7ee0c3', 20]].forEach(([c, off]) => {
      ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.beginPath();
      data.forEach((v, i) => { const x = 18 + i * (w - 36) / (data.length - 1), yy = 60 + (1 - Math.min(1, v + (off ? Math.sin(i * .2) * .1 - .15 : 0))) * 240; i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); });
      ctx.stroke();
    });
    ctx.fillStyle = '#7ee0c3'; ctx.fillText(`CO2 ${Math.round(400 + data[data.length - 1] * 300)} ppm`, 18, h - 16);
  });
  const panel = mesh(new THREE.PlaneGeometry(.27, .18), new THREE.MeshBasicMaterial({ map: screen, toneMapped: false }), false);
  panel.rotation.x = Math.PI / 2; panel.rotation.z = Math.PI; panel.position.set(0, -.0045, .105);
  hinge.add(panel);
  let acc = 0, n = 0;
  return {
    group,
    update(t, dt) {
      acc += dt;
      if (acc < .25) return;
      acc = 0; n++;
      data.shift();
      data.push(Math.max(.1, Math.min(.95, data[data.length - 1] + (Math.random() - .5) * .12 + Math.sin(n * .15) * .03)));
      screen.redraw();
    },
  };
}

// ---------------------------------------------------------------- lava lamp
export function buildLava() {
  const group = new THREE.Group();
  const metal = mat(0x30333f, .3, .8);
  const base = mesh(new THREE.CylinderGeometry(.03, .05, .07, 32), metal); base.position.y = .035; group.add(base);
  const glass = mesh(new THREE.LatheGeometry([[.03, 0], [.04, .08], [.032, .2], [.018, .24]].map(([x, yy]) => new THREE.Vector2(x, yy)), 32),
    new THREE.MeshStandardMaterial({ color: 0x7a4bd9, roughness: .1, transparent: true, opacity: .45, emissive: 0x3a1f80, emissiveIntensity: .6, depthWrite: false }), false);
  glass.position.y = .07; group.add(glass);
  const cap = mesh(new THREE.CylinderGeometry(.012, .019, .035, 24), metal); cap.position.y = .325; group.add(cap);
  const blobMat = glow(0xff8a4a);
  const blobs = Array.from({ length: 5 }, (_, i) => { const b = mesh(new THREE.SphereGeometry(.014 + (i % 3) * .004, 16, 12), blobMat, false); b.userData.live = true; group.add(b); return b; });
  return {
    group,
    update(t) {
      blobs.forEach((b, i) => {
        const u = (Math.sin(t * .35 + i * 1.7) + 1) / 2;
        const yy = .085 + u * .16;
        const r = .03 + (.04 - .03) * Math.sin(Math.min(1, (yy - .07) / .08) * Math.PI / 2) - Math.max(0, yy - .15) * .15;
        b.position.set(Math.sin(t * .5 + i) * r * .4, yy, Math.cos(t * .4 + i * 2) * r * .4);
        b.scale.set(1, 1 + Math.sin(t * .8 + i) * .35, 1);
      });
    },
  };
}

// ---------------------------------------------------------------- headphones lying on the desk
export function buildHeadphones() {
  const group = new THREE.Group();
  const dark = mat(0x24262f, .45, .2);
  const band = mesh(new THREE.TorusGeometry(.075, .008, 10, 32, Math.PI), dark);
  band.rotation.x = -Math.PI / 2; band.position.y = .012; group.add(band);
  [-1, 1].forEach(s => {
    const cup = mesh(new THREE.CylinderGeometry(.035, .035, .026, 28), dark); cup.position.set(s * .075, .018, 0); cup.rotation.z = s * .35; group.add(cup);
    const pad = mesh(new THREE.TorusGeometry(.026, .009, 10, 24), mat(C.accent, .7)); pad.rotation.x = Math.PI / 2; pad.position.set(s * .075 - s * .004, .034, 0); pad.rotation.y = s * .35; group.add(pad);
  });
  return { group };
}

// ---------------------------------------------------------------- wall: shelf with trophies, poster, clock
export function buildWall(awards) {
  const group = new THREE.Group();
  const wood = mat(C.wood, .55);
  const shelf = rbox(.9, .025, .2, .008, wood); group.add(shelf);
  [[0x6c7bd9, .2], [0xd97b6c, .22], [0x8fc7a8, .18], [0xe0c27a, .21]].forEach(([c, h], i) => {
    const bk = rbox(.035, h, .15, .004, mat(c, .7));
    bk.position.set(-.38 + i * .04, .0125 + h / 2, 0);
    if (i === 3) { bk.rotation.z = -.22; bk.position.x += .022; }
    group.add(bk);
  });
  const cup = [[0, 0], [.05, 0], [.05, .01], [.015, .02], [.012, .07], [.02, .08], [.05, .1], [.055, .17], [0, .17]].map(([x, y]) => new THREE.Vector2(x, y));
  const plaques = [];
  [[0xd9a441, .1, 1.1], [0xc0c4cf, .3, .85]].forEach(([color, x, s], i) => {
    const tg = new THREE.Group(); tg.position.set(x, .0125, .02); tg.scale.setScalar(s); group.add(tg);
    tg.add(mesh(new THREE.LatheGeometry(cup, 40), mat(color, .22, 1)));
    const plinth = rbox(.07, .03, .05, .004, mat(0x1d2030, .5)); plinth.position.y = -.0; tg.add(plinth);
    const p = canvasTexture(128, 48, (ctx, w, h, text = '') => {
      ctx.fillStyle = '#1d2030'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#d9c38a'; ctx.font = '600 20px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(text, w / 2, 31);
    });
    const plaque = mesh(new THREE.PlaneGeometry(.06, .022), new THREE.MeshBasicMaterial({ map: p }), false);
    plaque.position.set(0, .0, .0255); tg.add(plaque);
    tg.children[0].position.y = .015;
    plaques.push(p);
  });

  const poster = new THREE.Group(); poster.position.set(-2.75, .12, 0); group.add(poster);
  const frame = rbox(.42, .3, .02, .006, mat(0x1a1c25, .4)); poster.add(frame);
  const art = canvasTexture(512, 360, (ctx, w, h) => {
    ctx.fillStyle = '#f4f1fa'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1a1c25'; ctx.font = '700 46px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText('print(', w / 2, 140);
    ctx.fillStyle = '#e8743b'; ctx.fillText('"Hello, World"', w / 2, 200);
    ctx.fillStyle = '#1a1c25'; ctx.fillText(')', w / 2, 260);
    ctx.font = '500 18px "JetBrains Mono", monospace'; ctx.fillStyle = '#8c90b0'; ctx.fillText('where it all started', w / 2, 320);
  });
  const artMesh = mesh(new THREE.PlaneGeometry(.38, .26), new THREE.MeshStandardMaterial({ map: art, roughness: .8 }), false);
  artMesh.position.z = .011; poster.add(artMesh);

  const clock = new THREE.Group(); clock.position.set(-2.05, .56, 0); group.add(clock);
  const rim = mesh(new THREE.CylinderGeometry(.11, .11, .025, 48), mat(0x1a1c25, .4)); rim.rotation.x = Math.PI / 2; clock.add(rim);
  const faceTex = canvasTexture(256, 256, ctx => {
    const d = new Date(), cx = 128;
    ctx.fillStyle = '#f4f1fa'; ctx.beginPath(); ctx.arc(cx, cx, 128, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#1a1c25';
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ctx.lineWidth = i % 3 ? 3 : 7; ctx.beginPath(); ctx.moveTo(cx + Math.sin(a) * 100, cx - Math.cos(a) * 100); ctx.lineTo(cx + Math.sin(a) * 116, cx - Math.cos(a) * 116); ctx.stroke(); }
    const hand = (a, len, w, c) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, cx); ctx.lineTo(cx + Math.sin(a) * len, cx - Math.cos(a) * len); ctx.stroke(); };
    const s = d.getSeconds(), m = d.getMinutes() + s / 60, h = d.getHours() % 12 + m / 60;
    hand(h / 12 * TAU, 60, 9, '#1a1c25'); hand(m / 60 * TAU, 92, 6, '#1a1c25'); hand(s / 60 * TAU, 100, 2, '#e8743b');
    ctx.fillStyle = '#e8743b'; ctx.beginPath(); ctx.arc(cx, cx, 7, 0, TAU); ctx.fill();
  });
  const clockFace = mesh(new THREE.CircleGeometry(.1, 48), new THREE.MeshBasicMaterial({ map: faceTex }), false);
  clockFace.position.z = .0135; clock.add(clockFace);

  let lastSec = -1;
  return {
    group,
    trophyAnchor: plaques.length ? group : null,
    setAwards(list) {
      const labels = (list || []).filter(a => a.year).slice(0, 2).map(a => `${(a.org || a.title).split(/\s+/)[0]} '${a.year.slice(2)}`);
      plaques.forEach((p, i) => p.redraw(labels[i] || ['1st', '2nd'][i]));
    },
    redrawFonts() { art.redraw(); },
    update() {
      const s = new Date().getSeconds();
      if (s !== lastSec) { lastSec = s; faceTex.redraw(); }
    },
  };
}
