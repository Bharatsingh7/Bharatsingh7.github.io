// Room gadgets and the smaller robots. Same shape as props.js: each builder returns { group, update?(t, dt), onClick?() },
// with y = 0 at whatever the gadget stands on.
import * as THREE from 'three';
import { C, U, RGB_MODES, mat, glow, mesh, rbox, canvasTexture, rgbMaterial, rgbAt, bake, rand, pick } from './helpers.js';

const TAU = Math.PI * 2;
const MONO = '"JetBrains Mono", monospace';

// ---------------------------------------------------------------- gaming PC with a glass side and RGB fans
export function buildPC(onCycle) {
  const group = new THREE.Group();
  const W = .46, H = .5, D = .22;
  const shell = mat(0x15171d, .4, .3);
  const back = rbox(W, H, .02, .01, shell); back.position.set(0, H / 2, -D / 2 + .01); group.add(back);
  [[0, H - .01, W, .02, D], [0, .01, W, .02, D]].forEach(([x, y, w, h, d]) => { const b = rbox(w, h, d, .006, shell); b.position.set(x, y, 0); group.add(b); });
  [-1, 1].forEach(s => { const b = rbox(.02, H, D, .006, shell); b.position.set(s * (W / 2 - .01), H / 2, 0); group.add(b); });
  const glass = mesh(new THREE.PlaneGeometry(W - .03, H - .03), new THREE.MeshPhysicalMaterial({ color: 0x9aa4b8, roughness: .05, transparent: true, opacity: .14, metalness: 0, clearcoat: 1 }), false);
  glass.position.set(0, H / 2, D / 2 - .004); group.add(glass);
  // insides: board, GPU with a light bar, cooler, fans along the front
  const board = mesh(new THREE.PlaneGeometry(W - .06, H - .06), mat(0x1a1d26, .6)); board.position.set(-.02, H / 2, -D / 2 + .022); group.add(board);
  const gpu = rbox(.28, .05, .12, .008, mat(0x22252e, .4, .4)); gpu.position.set(-.04, .19, -.03); group.add(gpu);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(.24, .008, .004), rgbMaterial({ u0: .3, u1: .6 })); bar.position.set(-.04, .19, .032); group.add(bar);
  const fans = [];
  const ringMat = rgbMaterial({ u0: 0, u1: 1 });
  [[.17, .37], [.17, .2], [-.08, .37]].forEach(([x, y], i) => {
    const r = i === 2 ? .045 : .065;
    const f = new THREE.Group(); f.position.set(x, y, i === 2 ? -.04 : 0); f.rotation.y = i === 2 ? 0 : 0; group.add(f);
    f.add(new THREE.Mesh(new THREE.TorusGeometry(r, .006, 8, 32), ringMat));
    const blades = new THREE.Group(); f.add(blades);
    for (let k = 0; k < 7; k++) {
      const b = mesh(new THREE.BoxGeometry(r * .85, .004, .016), mat(0x2a2e3a, .5), false);
      b.position.x = r * .45; const h = new THREE.Group(); h.rotation.z = k / 7 * TAU; b.rotation.x = .5; h.add(b); blades.add(h);
    }
    bake(blades); blades.userData.live = true;
    fans.push(blades);
  });
  const power = mesh(new THREE.CylinderGeometry(.008, .008, .006, 16), glow(C.mint), false);
  power.rotation.x = Math.PI / 2; power.position.set(W / 2 - .04, H - .02, D / 2 - .03); power.rotation.z = Math.PI / 2;
  group.add(power);
  return {
    group,
    update(t, dt) { const sp = U.uMode.value === 3 ? 6 : 22; fans.forEach((b, i) => { b.rotation.z += dt * sp * (i ? 1 : 1.1); }); },
    onClick: onCycle,
  };
}

// ---------------------------------------------------------------- gaming chair, pushed back from the desk
export function buildChair() {
  const group = new THREE.Group();
  const black = mat(0x1b1d24, .6), accent = mat(0x3fae7a, .55), metal = mat(0x9aa0ad, .3, .8);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU;
    const leg = rbox(.3, .03, .04, .01, black); leg.position.set(Math.cos(a) * .15, .07, Math.sin(a) * .15); leg.rotation.y = -a; group.add(leg);
    const wheel = mesh(new THREE.SphereGeometry(.025, 10, 8), black); wheel.position.set(Math.cos(a) * .29, .025, Math.sin(a) * .29); group.add(wheel);
  }
  const gas = mesh(new THREE.CylinderGeometry(.025, .03, .33, 14), metal); gas.position.y = .25; group.add(gas);
  const seat = rbox(.52, .09, .5, .04, black); seat.position.y = .45; group.add(seat);
  const seatStripe = rbox(.16, .092, .48, .03, accent); seatStripe.position.y = .452; group.add(seatStripe);
  const backrest = new THREE.Group(); backrest.position.set(0, .48, -.24); backrest.rotation.x = -.18; group.add(backrest);
  const bk = rbox(.5, .82, .1, .05, black); bk.position.y = .45; backrest.add(bk);
  [-1, 1].forEach(s => { const wing = rbox(.08, .6, .12, .035, accent); wing.position.set(s * .23, .4, .02); backrest.add(wing); });
  const head = rbox(.26, .12, .06, .03, mat(0xeae6dc, .8)); head.position.set(0, .74, .07); backrest.add(head);
  [-1, 1].forEach(s => {
    const post = rbox(.03, .16, .03, .01, black); post.position.set(s * .26, .54, -.02); group.add(post);
    const pad = rbox(.07, .03, .26, .012, black); pad.position.set(s * .26, .63, 0); group.add(pad);
  });
  return { group };
}

// ---------------------------------------------------------------- game controller
export function buildController() {
  const group = new THREE.Group();
  const body = mat(0xeae6dc, .45);
  const mid = rbox(.1, .022, .055, .011, body); mid.position.y = .014; group.add(mid);
  [-1, 1].forEach(s => {
    const grip = mesh(new THREE.SphereGeometry(.032, 16, 12), body); grip.scale.set(1, .42, 1.15); grip.position.set(s * .055, .013, .012); group.add(grip);
    const stick = mesh(new THREE.CylinderGeometry(.009, .009, .012, 14), mat(0x222429, .5)); stick.position.set(s * .025, .03, .012); group.add(stick);
  });
  [[0xff6b6b, .062, -.004], [0x7ee0c3, .072, .006], [0x6fa8ff, .052, .006], [0xffd84a, .062, .016]].forEach(([c, x, z]) => {
    const b = mesh(new THREE.CylinderGeometry(.0045, .0045, .006, 10), mat(c, .4), false); b.position.set(x, .027, z); group.add(b);
  });
  const dpad = rbox(.018, .005, .006, .001, mat(0x222429, .5)); dpad.position.set(-.062, .027, .006); group.add(dpad);
  const dpad2 = dpad.clone(); dpad2.rotation.y = Math.PI / 2; group.add(dpad2);
  return { group };
}

// ---------------------------------------------------------------- 3D printer printing a tiny ARIA
export function buildPrinter(fx) {
  const group = new THREE.Group();
  const alu = mat(0x2c2f38, .35, .7), dark = mat(0x16181e, .5), orange = mat(C.accent, .45);
  const base = rbox(.3, .05, .3, .01, dark); base.position.y = .025; group.add(base);
  [-1, 1].forEach(s => { const rail = rbox(.024, .42, .024, .004, alu); rail.position.set(s * .14, .26, -.06); group.add(rail); });
  const top = rbox(.31, .024, .03, .004, alu); top.position.set(0, .47, -.06); group.add(top);
  const bed = new THREE.Group(); bed.position.y = .06; bed.userData.live = true; group.add(bed);
  const plate = rbox(.22, .01, .22, .004, mat(0x1d2a24, .35, .2)); bed.add(plate);
  const gantry = new THREE.Group(); gantry.userData.live = true; group.add(gantry);
  const xbar = rbox(.3, .02, .02, .004, alu); xbar.position.z = -.06; gantry.add(xbar);
  const head = new THREE.Group(); gantry.add(head);
  const block = rbox(.05, .05, .05, .008, orange); block.position.set(0, .025, -.035); head.add(block);
  const nozzle = mesh(new THREE.ConeGeometry(.007, .015, 10), mat(0xd9b46a, .3, .9)); nozzle.rotation.x = Math.PI; nozzle.position.set(0, -.005, -.02); head.add(nozzle);
  const hot = glow(0xff7a3a);
  const tipGlow = mesh(new THREE.SphereGeometry(.003, 8, 6), hot, false); tipGlow.position.set(0, -.013, -.02); head.add(tipGlow);
  const spool = mesh(new THREE.TorusGeometry(.045, .022, 10, 24), mat(0x6be0a8, .5)); spool.position.set(0, .53, -.06); spool.userData.live = true; group.add(spool);
  const screen = canvasTexture(128, 64, (ctx, w, h, p = 0) => {
    ctx.fillStyle = '#0b1a14'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7ee0c3'; ctx.font = `500 13px ${MONO}`;
    ctx.fillText(p >= 1 ? 'done!' : 'printing', 8, 20);
    ctx.fillText(`${Math.round(p * 100)}%`, 84, 20);
    ctx.fillStyle = 'rgba(126,224,195,.2)'; ctx.fillRect(8, 36, w - 16, 10);
    ctx.fillStyle = '#7ee0c3'; ctx.fillRect(8, 36, (w - 16) * p, 10);
  });
  const lcd = mesh(new THREE.PlaneGeometry(.08, .04), new THREE.MeshBasicMaterial({ map: screen, toneMapped: false }), false);
  lcd.position.set(.09, .03, .151); lcd.rotation.x = -.3; group.add(lcd);

  // the print: a small ARIA figure revealed layer by layer with a clipping plane
  const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  const pla = new THREE.MeshStandardMaterial({ color: 0x8ff0c6, roughness: .5, clippingPlanes: [plane], side: THREE.DoubleSide });
  const fig = new THREE.Group(); fig.position.y = .005; bed.add(fig);
  const fb = mesh(new THREE.CylinderGeometry(.026, .03, .045, 20), pla); fb.position.y = .0225; fig.add(fb);
  const fh = mesh(new THREE.SphereGeometry(.026, 18, 12), pla); fh.scale.set(1.15, .85, 1); fh.position.y = .07; fig.add(fh);
  const fa = mesh(new THREE.CylinderGeometry(.003, .003, .02, 8), pla); fa.position.y = .1; fig.add(fa);
  const fbulb = mesh(new THREE.SphereGeometry(.007, 10, 8), pla); fbulb.position.y = .112; fig.add(fbulb);
  const FIG_H = .12;

  const st = { p: 0, hold: 0, t: 0, frame: 0 };
  const wp = new THREE.Vector3();
  const api = {
    group,
    update(t, dt) {
      st.t = t;
      if (st.hold > 0) { st.hold -= dt; if (st.hold <= 0) st.p = 0; }
      else st.p = Math.min(1, st.p + dt / 50);
      if (st.p >= 1 && st.hold <= 0) st.hold = 7;
      const printing = st.hold <= 0;
      const layer = st.p * FIG_H;
      head.position.x = printing ? Math.sin(t * 7.3) * .035 + Math.sin(t * 2.1) * .01 : 0;
      bed.position.z = printing ? Math.sin(t * 5.1) * .03 : 0;
      gantry.position.y = .08 + layer + (printing ? 0 : .08);
      hot.color.setHex(printing ? (Math.sin(t * 20) > 0 ? 0xff8a3a : 0xff5a2a) : 0x552211);
      spool.rotation.z = -t * (printing ? .4 : 0);
      fig.getWorldPosition(wp);
      plane.constant = wp.y + (printing ? layer : FIG_H + .05);
      if (st.frame++ % 20 === 0) screen.redraw(st.p);
    },
    onClick() {
      if (st.hold > 0) { fx.say(group, pick(['Fresh off the bed.', 'Tiny ARIA, 100% PLA.']), { offset: [0, .55, 0] }); return; }
      st.p = 1; st.hold = 7; screen.redraw(1);
      fig.getWorldPosition(wp);
      fx.burst(wp.clone().add(new THREE.Vector3(0, .1, 0)));
      fx.say(group, 'Print finished!', { offset: [0, .55, 0] });
    },
  };
  return api;
}

// ---------------------------------------------------------------- oscilloscope with a live trace
export function buildScope() {
  const group = new THREE.Group();
  const body = rbox(.24, .15, .17, .012, mat(0x3a3f4a, .5, .2)); body.position.y = .075; group.add(body);
  let mode = 0, frame = 0;
  const tex = canvasTexture(256, 160, (ctx, w, h, t = 0) => {
    ctx.fillStyle = '#06140f'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(126,224,195,.14)'; ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y <= h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = '#8affc8'; ctx.lineWidth = 2.5; ctx.shadowColor = '#8affc8'; ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const u = i / 120;
      let x, y;
      if (mode === 1) { x = w / 2 + Math.sin(u * TAU * 3 + t) * w * .38; y = h / 2 + Math.sin(u * TAU * 2) * h * .36; }
      else { x = u * w; y = h / 2 + (Math.sin(u * 18 - t * 6) * .6 + Math.sin(u * 47 - t * 9) * .15) * h * .3 * (mode === 2 ? (u * 6 % 1 < .5 ? 1 : -1) : 1); }
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#7ee0c3'; ctx.font = `500 12px ${MONO}`; ctx.fillText(['CH1 2V/div', 'XY mode', 'CH1 PWM'][mode], 8, 16);
  });
  const screen = mesh(new THREE.PlaneGeometry(.13, .085), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), false);
  screen.position.set(-.035, .08, .0855); group.add(screen);
  for (let i = 0; i < 4; i++) {
    const k = mesh(new THREE.CylinderGeometry(.009, .009, .012, 14), mat(i ? 0xd9d4c8 : C.accent, .4), false);
    k.rotation.x = Math.PI / 2; k.position.set(.065 + (i % 2) * .03, .11 - Math.floor(i / 2) * .04, .09); group.add(k);
  }
  return {
    group,
    update(t) { if (frame++ % 4 === 0) tex.redraw(t); },
    onClick() { mode = (mode + 1) % 3; },
  };
}

// ---------------------------------------------------------------- smart-home wall panel (also the RGB switch)
export function buildPanel(state) {
  const group = new THREE.Group();
  const bezel = rbox(.3, .2, .02, .015, mat(0xefe8da, .5)); group.add(bezel);
  const tex = canvasTexture(384, 256, (ctx, w, h) => {
    const d = new Date();
    ctx.fillStyle = '#0d1a15'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e9f5ee'; ctx.font = `600 54px "Space Grotesk", sans-serif`;
    ctx.fillText(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 22, 70);
    ctx.font = `500 17px ${MONO}`; ctx.fillStyle = '#8fb5a2';
    ctx.fillText(state.isDay() ? 'sunny · window open' : 'night · lights on', 24, 100);
    const tiles = [['TEMP', `${(23.6 + Math.sin(d.getMinutes() / 9) * .8).toFixed(1)}°C`], ['HUMID', `${58 + d.getMinutes() % 6}%`], ['PLANTS', 'happy'], ['RGB', RGB_MODES[U.uMode.value]]];
    tiles.forEach(([k, v], i) => {
      const x = 22 + (i % 2) * 176, y = 122 + Math.floor(i / 2) * 64;
      ctx.fillStyle = '#16271f'; ctx.beginPath(); ctx.roundRect(x, y, 164, 54, 10); ctx.fill();
      ctx.fillStyle = '#6f9c86'; ctx.font = `500 12px ${MONO}`; ctx.fillText(k, x + 12, y + 20);
      ctx.fillStyle = i === 3 ? `#${rgbAt(.3).getHexString()}` : '#dff3e8'; ctx.font = `600 20px "Space Grotesk", sans-serif`; ctx.fillText(v, x + 12, y + 44);
    });
  });
  const screen = mesh(new THREE.PlaneGeometry(.27, .18), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), false);
  screen.position.z = .0105; group.add(screen);
  let last = -1, frame = 0;
  return {
    group,
    refresh() { tex.redraw(); },
    update() {
      const s = new Date().getSeconds();
      // breathe mode changes colour constantly, so repaint the RGB tile now and then
      if (s !== last || (U.uMode.value !== 1 && frame % 30 === 0)) { last = s; tex.redraw(); }
      frame++;
    },
    onClick() { state.cycle(); tex.redraw(); },
  };
}

// ---------------------------------------------------------------- smart terrarium with an ESP32 and a tiny OLED
export function buildTerrarium(foliage, at) {
  const group = new THREE.Group();
  const glass = mesh(new THREE.BoxGeometry(.2, .16, .14), new THREE.MeshPhysicalMaterial({ color: 0xcfe8de, roughness: .05, transparent: true, opacity: .16, clearcoat: 1, depthWrite: false }), false);
  glass.position.y = .08; group.add(glass);
  const lid = rbox(.205, .008, .145, .003, mat(0x3a3f4a, .4, .5)); lid.position.y = .162; group.add(lid);
  const soil = rbox(.19, .03, .13, .005, mat(0x3b2a20, 1)); soil.position.y = .015; group.add(soil);
  const moss = mat(0x5fa860, .9);
  [[-.05, .01, .9], [.02, -.02, 1.2], [.06, .03, .7], [-.01, .035, .6]].forEach(([x, z, s]) => {
    const m = mesh(new THREE.SphereGeometry(.03 * s, 12, 8), moss); m.scale.y = .45; m.position.set(x, .032, z); group.add(m);
  });
  const stone = mesh(new THREE.DodecahedronGeometry(.016), mat(0x9a9a92, .8)); stone.position.set(.05, .035, -.03); group.add(stone);
  // tiny ferns from the shared foliage (at = where the terrarium will sit), so they sway with everything else
  const base = new THREE.Vector3(-.04, .035, -.02).add(at);
  for (let i = 0; i < 7; i++) foliage.leaf('blade', base, new THREE.Vector3(Math.cos(i * .9) * .6, 1, Math.sin(i * .9) * .6), .07 + (i % 3) * .015, C.leafLight, { keep: true, sx: 2.2 });
  const esp = rbox(.07, .006, .035, .002, mat(0x1b1f2a, .5)); esp.position.set(.15, .003, .02); group.add(esp);
  const led = glow(0x3aa0ff);
  const ledM = mesh(new THREE.SphereGeometry(.003, 8, 6), led, false); ledM.position.set(.17, .008, .03); group.add(ledM);
  const oled = canvasTexture(128, 64, (ctx, w, h, m = 62) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#9fe8ff'; ctx.font = `500 14px ${MONO}`; ctx.fillText('soil', 6, 18); ctx.fillText(`${m}%`, 80, 18);
    ctx.fillRect(6, 30, (w - 12) * m / 100, 8);
    ctx.fillText('lux  ok', 6, 58);
  });
  const stand = rbox(.05, .035, .006, .002, mat(0x1b1f2a, .5)); stand.position.set(.15, .022, -.005); stand.rotation.x = -.3; group.add(stand);
  const screen = mesh(new THREE.PlaneGeometry(.044, .022), new THREE.MeshBasicMaterial({ map: oled, toneMapped: false }), false);
  screen.position.set(.15, .024, -.001); screen.rotation.x = -.3; group.add(screen);
  let acc = 0;
  return {
    group,
    update(t, dt) {
      led.color.setHex(Math.sin(t * 6) > .7 ? 0x3aa0ff : 0x0a2a4a);
      acc += dt;
      if (acc > 2.5) { acc = 0; oled.redraw(Math.round(60 + Math.sin(t * .1) * 6)); }
    },
  };
}

// ---------------------------------------------------------------- robot vacuum roaming the floor, with a cactus passenger
export function buildVacuum(fx, bounds, obstacles = []) {
  const group = new THREE.Group();
  const bodyG = new THREE.Group(); bodyG.userData.live = true; group.add(bodyG);
  const body = mesh(new THREE.CylinderGeometry(.17, .17, .06, 36), mat(0xeeeae2, .4)); body.position.y = .04; bodyG.add(body);
  const bumper = mesh(new THREE.CylinderGeometry(.172, .172, .025, 36, 1, true, -1.2, 2.4), mat(0x2a2d36, .5)); bumper.position.y = .03; bodyG.add(bumper);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.11, .005, 6, 40), rgbMaterial({ u0: 0, u1: 1 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = .071; bodyG.add(ring);
  const eye = mesh(new THREE.CylinderGeometry(.03, .03, .02, 20), mat(0x22252e, .3)); eye.position.set(0, .078, .07); bodyG.add(eye);
  const eyeLed = glow(C.mint);
  const el = mesh(new THREE.SphereGeometry(.006, 8, 6), eyeLed, false); el.position.set(0, .09, .09); bodyG.add(el);
  // cactus in a tiny pot riding on top
  const pot = mesh(new THREE.CylinderGeometry(.025, .02, .03, 14), mat(C.terracotta, .7)); pot.position.set(-.03, .085, -.04); bodyG.add(pot);
  const cactus = mat(0x4f9a5b, .6);
  const c1 = mesh(new THREE.CapsuleGeometry(.014, .04, 4, 10), cactus); c1.position.set(-.03, .13, -.04); bodyG.add(c1);
  const c2 = mesh(new THREE.CapsuleGeometry(.008, .016, 4, 8), cactus); c2.position.set(-.012, .13, -.04); c2.rotation.z = -.9; bodyG.add(c2);
  const flower = mesh(new THREE.SphereGeometry(.007, 8, 6), mat(0xff7fb0, .5), false); flower.position.set(-.03, .163, -.04); bodyG.add(flower);
  bake(bodyG);
  const blob = new THREE.Mesh(new THREE.CircleGeometry(.2, 24), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .25, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = .003; group.add(blob);

  const st = { x: (bounds.x0 + bounds.x1) / 2, z: (bounds.z0 + bounds.z1) / 2, a: .6, mode: 'drive', mt: 0, turn: 0, spin: 0 };
  const blocked = (x, z) => x < bounds.x0 || x > bounds.x1 || z < bounds.z0 || z > bounds.z1 || obstacles.some(o => Math.hypot(x - o.x, z - o.z) < o.r + .17);
  const api = {
    group,
    get position() { return group.position; },
    spin() { st.spin = 1; },
    update(t, dt) {
      st.mt += dt;
      if (st.spin > 0) { st.spin -= dt / 1.2; bodyG.rotation.y += dt * 9; }
      else if (st.mode === 'drive') {
        const nx = st.x + Math.sin(st.a) * .16 * dt, nz = st.z + Math.cos(st.a) * .16 * dt;
        if (blocked(nx, nz)) { st.mode = 'back'; st.mt = 0; }
        else { st.x = nx; st.z = nz; st.a += Math.sin(t * .4) * .2 * dt; }
      } else if (st.mode === 'back') {
        st.x -= Math.sin(st.a) * .08 * dt; st.z -= Math.cos(st.a) * .08 * dt;
        if (st.mt > .35) { st.mode = 'turn'; st.mt = 0; st.turn = (Math.random() < .5 ? -1 : 1) * rand(1.4, 2.6); }
      } else {
        st.a += st.turn * dt / .8;
        if (st.mt > .8) { st.mode = 'drive'; st.mt = 0; }
      }
      group.position.set(st.x, 0, st.z);
      if (st.spin <= 0) bodyG.rotation.y = st.a;
      bodyG.position.y = st.mode === 'back' ? Math.abs(Math.sin(st.mt * 30)) * .004 : 0;
      eyeLed.color.setHex(st.mode === 'drive' ? C.mint : 0xffb35f);
    },
    onClick() { api.spin(); fx.say(group, pick(['beep boop, cleaning', 'Dust detected.', '*vroom*', 'Cactus says hi 🌵']), { offset: [0, .3, 0], dur: 1600 }); },
  };
  return api;
}

// ---------------------------------------------------------------- SproutBot: tiny watering robot on the windowsill
export function buildSproutBot(fx, stops) {
  const group = new THREE.Group();
  const bot = new THREE.Group(); bot.userData.live = true; group.add(bot);
  const white = mat(0xf2efe8, .4), green = mat(0x3fae7a, .5), dark = mat(0x1d2030, .4);
  const body = rbox(.07, .05, .06, .015, white); body.position.y = .04; bot.add(body);
  [-1, 1].forEach(s => { const w = mesh(new THREE.CylinderGeometry(.016, .016, .01, 14), dark); w.rotation.z = Math.PI / 2; w.position.set(s * .038, .016, 0); bot.add(w); });
  const headPivot = new THREE.Group(); headPivot.position.y = .068; headPivot.userData.live = true; bot.add(headPivot);
  const head = mesh(new THREE.SphereGeometry(.028, 16, 12, 0, TAU, 0, Math.PI / 2), green); headPivot.add(head);
  [-1, 1].forEach(s => { const e = mesh(new THREE.SphereGeometry(.005, 8, 6), glow(0xeafff4), false); e.position.set(s * .011, .012, .024); headPivot.add(e); });
  const sprout = new THREE.Group(); sprout.position.y = .028; sprout.userData.live = true; headPivot.add(sprout);
  const stem = mesh(new THREE.CylinderGeometry(.002, .002, .022, 6), green, false); stem.position.y = .011; sprout.add(stem);
  [-1, 1].forEach(s => { const l = mesh(new THREE.SphereGeometry(.009, 10, 6), mat(0x8cc96b, .5), false); l.scale.set(1.4, .35, .8); l.position.set(s * .01, .022, 0); l.rotation.z = s * .4; sprout.add(l); });
  const spout = mesh(new THREE.CylinderGeometry(.004, .006, .04, 8), white); spout.rotation.x = Math.PI / 2.4; spout.position.set(0, .045, .045); bot.add(spout);
  bake(sprout); bake(headPivot); bake(bot);
  const drops = Array.from({ length: 4 }, () => { const d = mesh(new THREE.SphereGeometry(.004, 8, 6), glow(0x8fd8ff), false); d.visible = false; group.add(d); return d; });

  const st = { x: stops[0], target: stops[0], water: 0, next: 6, t: 0, i: 0 };
  const api = {
    group,
    water() { st.water = 1.8; fx.say(bot, pick(['💧', '🌱', '💚']), { emoji: true, offset: [0, .12, 0], dur: 1400 }); },
    update(t, dt) {
      st.t = t;
      const d = st.target - st.x;
      if (Math.abs(d) > .004) { st.x += Math.sign(d) * Math.min(Math.abs(d), dt * .08); bot.rotation.y = Math.sign(d) * Math.PI / 2; }
      else if (st.water <= 0 && t > st.next) {
        if (st.atStop) { st.atStop = false; st.i = (st.i + 1 + Math.floor(Math.random() * (stops.length - 1))) % stops.length; st.target = stops[st.i]; }
        else { st.atStop = true; bot.rotation.y = 0; api.water(); }
        st.next = t + rand(3, 7);
      }
      if (Math.abs(d) <= .004 && st.water > 0) bot.rotation.y *= .9;
      bot.position.x = st.x;
      bot.position.y = Math.abs(d) > .004 ? Math.abs(Math.sin(t * 18)) * .003 : 0;
      sprout.rotation.z = Math.sin(t * 3) * .2;
      st.water -= dt;
      headPivot.rotation.x = st.water > 0 ? .35 : 0;
      drops.forEach((p, i) => {
        p.visible = st.water > 0;
        if (!p.visible) return;
        const u = (t * 2 + i / drops.length) % 1;
        p.position.set(st.x, .045 - u * .06, .07 + u * .015);
      });
    },
    onClick() { api.water(); },
  };
  return api;
}

// ---------------------------------------------------------------- walking bot figurine patrolling the shelf
export function buildWalker(span = .12) {
  const group = new THREE.Group();
  const bot = new THREE.Group(); bot.userData.live = true; group.add(bot);
  const shell = mat(0xffcf5c, .45), dark = mat(0x1d2030, .4);
  const body = rbox(.05, .03, .04, .01, shell); body.position.y = .04; bot.add(body);
  const visor = rbox(.03, .012, .005, .004, glow(0x9fe8ff)); visor.position.set(0, .045, .021); bot.add(visor);
  const legs = [];
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const hip = new THREE.Group(); hip.position.set(x * .02, .03, z * .014); hip.userData.live = true; bot.add(hip);
    const leg = rbox(.008, .03, .008, .003, dark); leg.position.y = -.015; hip.add(leg);
    legs.push({ hip, ph: (x * z > 0 ? 0 : Math.PI) });
  }
  bake(bot);
  return {
    group,
    update(t) {
      const u = (Math.sin(t * .25) + 1) / 2;
      const vel = Math.cos(t * .25);
      bot.position.x = (u - .5) * span * 2;
      bot.rotation.y = vel > 0 ? Math.PI / 2 : -Math.PI / 2;
      const step = Math.abs(vel) > .1;
      legs.forEach(l => { l.hip.rotation.x = step ? Math.sin(t * 9 + l.ph) * .5 : 0; });
      bot.position.y = step ? Math.abs(Math.sin(t * 9)) * .004 : 0;
    },
  };
}

