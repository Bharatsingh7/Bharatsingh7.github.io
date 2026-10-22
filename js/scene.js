// 3D hero (desk, monitor, ARIA robot) and the cursor-following drone, built with three.js
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const BG = 0x0f1222, ACCENT = 0xff9e64, ACCENT2 = 0xb69cff, EYE = 0x9fe8ff;

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

// shared pointer, normalised to -1..1
const pointer = { x: 0, y: 0, px: innerWidth / 2, py: innerHeight / 2, inside: false };
addEventListener('pointermove', e => {
  pointer.px = e.clientX; pointer.py = e.clientY;
  pointer.x = e.clientX / innerWidth * 2 - 1;
  pointer.y = -(e.clientY / innerHeight * 2 - 1);
  pointer.inside = true;
});
document.addEventListener('pointerleave', () => { pointer.inside = false; });

const mat = (color, roughness = .6, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
function rbox(w, h, d, r, material) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), material);
  m.castShadow = m.receiveShadow = true;
  return m;
}
function rod(a, b, r, material) {
  const len = a.distanceTo(b);
  const m = mesh(new THREE.CylinderGeometry(r, r, len, 12), material);
  m.position.copy(a).lerp(b, .5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}
function mesh(geo, material, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = m.receiveShadow = shadow;
  return m;
}
function makeRenderer(canvas, alpha) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  return r;
}

if (!hasWebGL()) {
  document.documentElement.classList.add('no-webgl');
  document.getElementById('drone').remove();
} else {
  initRoom();
  if (finePointer && !reduce) initDrone(); else document.getElementById('drone').remove();
}

// ============================================================ ROOM
function initRoom() {
  const host = document.getElementById('scene');
  const canvas = document.getElementById('room');
  const renderer = makeRenderer(canvas, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 4.2, 9);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .35;

  const camera = new THREE.PerspectiveCamera(32, 1, .1, 40);
  const lookAt = new THREE.Vector3(.12, 1.02, 0);

  // ---- lights
  scene.add(new THREE.HemisphereLight(0xaab4ff, 0x1a1420, .55));
  const key = new THREE.DirectionalLight(0xfff1e6, 1.6);
  key.position.set(2.2, 4, 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -2.2, right: 2.2, top: 2.2, bottom: -1, near: .5, far: 12 });
  key.shadow.bias = -.0004; key.shadow.normalBias = .02;
  scene.add(key);
  const rim = new THREE.DirectionalLight(ACCENT2, 1.4);
  rim.position.set(-3, 2.5, -2);
  scene.add(rim);

  // ---- room shell
  const floor = mesh(new THREE.PlaneGeometry(30, 30), mat(0x13162a, .95), false);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);
  const wall = mesh(new THREE.PlaneGeometry(14, 7), mat(0x181c33, .92), false);
  wall.position.set(0, 3.5, -.8); wall.receiveShadow = true;
  scene.add(wall);

  // ---- desk
  const wood = mat(0x4a3a30, .55);
  const steel = mat(0x262a36, .4, .6);
  const desk = rbox(2, .05, .85, .02, wood);
  desk.position.set(0, .75, 0);
  scene.add(desk);
  for (const [x, z] of [[-.92, -.36], [.92, -.36], [-.92, .36], [.92, .36]]) {
    const leg = rbox(.05, .73, .05, .015, steel);
    leg.position.set(x, .365, z);
    scene.add(leg);
  }
  const TOP = .775;

  // ---- monitor with a live terminal texture
  const monitor = new THREE.Group();
  monitor.position.set(-.22, TOP, -.18);
  monitor.rotation.y = .1;
  scene.add(monitor);
  const shell = mat(0x1a1c25, .35, .4);
  const base = rbox(.3, .015, .19, .006, shell); base.position.y = .008; monitor.add(base);
  const neck = rbox(.06, .3, .03, .01, shell); neck.position.set(0, .16, -.05); monitor.add(neck);
  const body = rbox(1, .58, .035, .015, shell); body.position.set(0, .45, -.02); monitor.add(body);

  const sc = document.createElement('canvas');
  sc.width = 1024; sc.height = 576;
  const sctx = sc.getContext('2d');
  const screenTex = new THREE.CanvasTexture(sc);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = 4;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(.95, .535), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.position.set(0, .45, .0);
  monitor.add(screen);
  const screenGlow = new THREE.PointLight(0x8fa8ff, .9, 1.6, 2);
  screenGlow.position.set(0, .45, .35);
  monitor.add(screenGlow);

  // terminal state: finished lines + one line being typed
  const term = {
    lines: [
      ['$ ', 'whoami'],
      ['', 'bharat singh bhati · software developer'],
      ['$ ', 'cat focus.txt'],
      ['', 'machine vision · iot · on-device ai'],
      ['$ ', 'aria --listen'],
      ['', 'ready.'],
    ],
    typing: null, shown: 0, dirty: true, cursor: true,
  };
  function wrap(text, max) {
    const out = []; let line = '';
    for (const word of text.split(' ')) {
      if ((line + ' ' + word).trim().length > max) { out.push(line); line = word; } else line = (line + ' ' + word).trim();
    }
    if (line) out.push(line);
    return out;
  }
  function drawScreen() {
    const W = sc.width, H = sc.height;
    const g = sctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#11152a'); g.addColorStop(1, '#0a0d1b');
    sctx.fillStyle = g; sctx.fillRect(0, 0, W, H);
    sctx.fillStyle = '#1a1f38'; sctx.fillRect(0, 0, W, 46);
    ['#ff6b6b', '#ffcf5c', '#7ee0c3'].forEach((c, i) => { sctx.fillStyle = c; sctx.beginPath(); sctx.arc(28 + i * 26, 23, 7, 0, 7); sctx.fill(); });
    sctx.fillStyle = '#8c90b0'; sctx.font = '500 20px "JetBrains Mono", monospace';
    sctx.fillText('aria — ~/bharat', 120, 30);

    const rows = [];
    for (const [p, t] of term.lines) wrap(t, 62).forEach((l, i) => rows.push([i ? '' : p, l, p ? 'cmd' : 'out']));
    if (term.typing) {
      const vis = term.typing.slice(0, term.shown);
      wrap(vis, 62).forEach(l => rows.push(['', l, 'out']));
      if (!vis) rows.push(['', '', 'out']);
    }
    const lh = 34, maxRows = Math.floor((H - 80) / lh);
    const view = rows.slice(-maxRows);
    sctx.font = '400 24px "JetBrains Mono", monospace';
    view.forEach(([p, t, kind], i) => {
      const y = 92 + i * lh;
      let x = 36;
      if (p) { sctx.fillStyle = '#ff9e64'; sctx.fillText(p, x, y); x += sctx.measureText(p).width; }
      sctx.fillStyle = kind === 'cmd' ? '#ece9f4' : '#a9adc8';
      sctx.fillText(t, x, y);
      if (i === view.length - 1 && term.cursor) {
        sctx.fillStyle = '#ff9e64';
        sctx.fillRect(x + sctx.measureText(t).width + 6, y - 20, 12, 26);
      }
    });
    screenTex.needsUpdate = true;
  }
  addEventListener('aria:talk', e => {
    const d = e.detail;
    if (d.on) {
      if (term.typing) term.lines.push(['', term.typing]);
      term.lines.push(['$ ', d.q ? `aria ask "${d.q.slice(0, 40)}"` : 'aria say']);
      term.typing = d.text; term.shown = 0;
      robot.talking = true;
    } else {
      robot.talking = false;
    }
    term.dirty = true;
  });
  document.fonts.ready.then(() => { term.dirty = true; });

  // ---- keyboard, mouse, mug, plant, dev board, lamp, shelf
  const kb = rbox(.5, .02, .16, .008, mat(0x23262f, .5, .2));
  kb.position.set(-.2, TOP + .01, .17);
  scene.add(kb);
  const keyGeo = new RoundedBoxGeometry(.026, .012, .026, 2, .004);
  const keys = new THREE.InstancedMesh(keyGeo, mat(0x353a48, .55), 56);
  keys.castShadow = true;
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (let r = 0, i = 0; r < 4; r++) for (let c = 0; c < 14; c++, i++) {
    m4.setPosition(-.2 - .218 + c * .0335, TOP + .026, .17 - .05 + r * .034);
    keys.setMatrixAt(i, m4);
    keys.setColorAt(i, col.set((r === 0 && c === 0) || (r === 2 && c === 13) ? ACCENT : 0x353a48));
  }
  scene.add(keys);
  const mouse = rbox(.06, .025, .1, .012, mat(0x23262f, .45, .2));
  mouse.position.set(.16, TOP + .012, .19);
  scene.add(mouse);

  const mug = new THREE.Group();
  mug.position.set(-.78, TOP, .12);
  const mugMat = mat(0xece6dc, .4);
  const cup = mesh(new THREE.CylinderGeometry(.042, .037, .1, 32), mugMat); cup.position.y = .05; mug.add(cup);
  const coffee = mesh(new THREE.CircleGeometry(.038, 24), mat(0x3b2418, .2)); coffee.rotation.x = -Math.PI / 2; coffee.position.y = .093; mug.add(coffee);
  const handle = mesh(new THREE.TorusGeometry(.024, .007, 10, 20, Math.PI), mugMat); handle.rotation.z = -Math.PI / 2; handle.position.set(.042, .05, 0); mug.add(handle);
  scene.add(mug);

  const plant = new THREE.Group();
  plant.position.set(-.82, TOP, -.25);
  const pot = mesh(new THREE.CylinderGeometry(.075, .058, .14, 32), mat(0xc2734f, .7)); pot.position.y = .07; plant.add(pot);
  const soil = mesh(new THREE.CircleGeometry(.07, 24), mat(0x2b1d17, 1)); soil.rotation.x = -Math.PI / 2; soil.position.y = .135; plant.add(soil);
  const leafMat = mat(0x4f8a5b, .55, 0, { side: THREE.DoubleSide });
  const leaves = [];
  for (let i = 0; i < 9; i++) {
    const leaf = mesh(new THREE.SphereGeometry(.05, 16, 12), leafMat);
    leaf.scale.set(.42, 1.6, .16);
    const piv = new THREE.Group();
    piv.position.y = .13;
    piv.rotation.set(.35 + (i % 3) * .14, i * 2.4, 0);
    leaf.position.y = .07;
    piv.add(leaf);
    plant.add(piv);
    leaves.push(piv);
  }
  scene.add(plant);

  // dev board (ESP32 / Pi-ish) with a blinking LED
  const board = new THREE.Group();
  board.position.set(.62, TOP, .2);
  board.rotation.y = -.35;
  const pcb = rbox(.17, .012, .1, .004, mat(0x1f6b45, .5)); pcb.position.y = .006; board.add(pcb);
  const chip = rbox(.04, .008, .04, .002, mat(0x14161c, .3, .3)); chip.position.set(-.02, .016, 0); board.add(chip);
  const usb = rbox(.03, .014, .025, .002, mat(0xb8bcc8, .25, .9)); usb.position.set(-.075, .017, 0); board.add(usb);
  for (let i = 0; i < 10; i++) {
    const pin = mesh(new THREE.BoxGeometry(.006, .012, .006), mat(0xd9b45a, .3, .9));
    pin.position.set(-.06 + i * .013, .018, .043); board.add(pin);
  }
  const led = mesh(new THREE.SphereGeometry(.006, 12, 8), new THREE.MeshBasicMaterial({ color: 0x7ee0c3 }), false);
  led.position.set(.05, .017, -.025); board.add(led);
  scene.add(board);

  // desk lamp in the back-right corner, shade leaning over the dev board
  const lampMat = mat(0xe7e2d8, .45, .1);
  const LB = new THREE.Vector3(.88, TOP, -.3), J1 = new THREE.Vector3(.86, TOP + .42, -.34), J2 = new THREE.Vector3(.74, TOP + .5, -.06);
  const lb = mesh(new THREE.CylinderGeometry(.065, .075, .02, 32), lampMat); lb.position.copy(LB).setY(TOP + .01); scene.add(lb);
  scene.add(rod(LB, J1, .009, lampMat), rod(J1, J2, .009, lampMat));
  const joint = mesh(new THREE.SphereGeometry(.016, 16, 12), steel); joint.position.copy(J1); scene.add(joint);
  const shade = mesh(new THREE.ConeGeometry(.075, .11, 32, 1, true), mat(0xe7e2d8, .45, .1, { side: THREE.DoubleSide }));
  shade.position.copy(J2).add(new THREE.Vector3(0, -.04, .01)); shade.rotation.x = .35; scene.add(shade);
  const bulb = mesh(new THREE.SphereGeometry(.026, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe2bf }), false);
  bulb.position.copy(shade.position).add(new THREE.Vector3(0, -.04, .015)); scene.add(bulb);
  const lampLight = new THREE.SpotLight(0xffc896, 5, 3, .95, .6, 1.6);
  lampLight.position.copy(bulb.position);
  lampLight.target.position.set(.45, TOP, .12);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(1024, 1024);
  lampLight.shadow.bias = -.0005;
  scene.add(lampLight, lampLight.target);

  // wall shelf: books + hackathon trophy
  const shelf = rbox(.8, .025, .2, .008, wood);
  shelf.position.set(.5, 1.64, -.68);
  scene.add(shelf);
  [[0x6c7bd9, .2], [0xd97b6c, .22], [0x8fc7a8, .18], [0xe0c27a, .21]].forEach(([c, h], i) => {
    const bk = rbox(.035, h, .15, .004, mat(c, .7));
    bk.position.set(.2 + i * .04, 1.653 + h / 2, -.68);
    if (i === 3) { bk.rotation.z = .2; bk.position.x += .015; }
    scene.add(bk);
  });
  const trophyPts = [[0, 0], [.05, 0], [.05, .01], [.015, .02], [.012, .07], [.02, .08], [.05, .1], [.055, .17], [0, .17]].map(([x, y]) => new THREE.Vector2(x, y));
  const trophy = mesh(new THREE.LatheGeometry(trophyPts, 40), mat(0xd9a441, .22, 1));
  trophy.position.set(.67, 1.653, -.66);
  scene.add(trophy);

  // ---- ARIA, the robot
  const robot = buildRobot();
  robot.group.position.set(.4, TOP, .04);
  robot.group.rotation.y = -.35;
  scene.add(robot.group);

  // ---- framing
  let W = 1, H = 1, wide = true;
  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    wide = W > 960 && W / H > 1.1;
    if (wide) {
      // render a wider virtual view and show its left part, so the desk sits right of the text
      const full = W * 1.5;
      camera.aspect = full / H;
      camera.setViewOffset(full, H, W * .07, 0, W, H);
    } else {
      camera.aspect = W / H;
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  // ---- interaction: click the robot
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hitRobot(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(robot.group, true).length > 0;
  }
  // the text column sits on top of the canvas on desktop, so listen on the hero
  const hero = host.parentElement;
  hero.addEventListener('pointermove', e => { if (!e.target.closest('.hero-col > *')) canvas.style.cursor = hitRobot(e) ? 'pointer' : ''; });
  hero.addEventListener('click', e => {
    if (e.target.closest('.hero-col > *')) return;
    if (hitRobot(e)) { robot.poke(); dispatchEvent(new Event('aria:poke')); }
  });

  // ---- loop
  let visible = true, t0 = performance.now(), intro = reduce ? 1 : 0;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(host);
  const camPos = new THREE.Vector3();
  const look = new THREE.Vector3(), smooth = { x: 0, y: 0 };
  let frame = 0;

  function tick(now) {
    requestAnimationFrame(tick);
    if (!visible || document.hidden) return;
    const t = (now - t0) / 1000;
    frame++;

    intro = Math.min(1, intro + 1 / 150);
    const ease = 1 - Math.pow(1 - intro, 3);
    smooth.x += (pointer.x - smooth.x) * .05;
    smooth.y += (pointer.y - smooth.y) * .05;

    const dist = wide ? 3.1 : 3.1 * Math.max(.9, 1.02 / (W / H));
    const yaw = -.28 + smooth.x * .08 + (1 - ease) * .5;
    const height = 1.5 + smooth.y * .06 + (1 - ease) * .5;
    camPos.set(Math.sin(yaw) * dist * -1 + .12, height, Math.cos(yaw) * dist);
    camera.position.copy(camPos);
    look.copy(lookAt);
    if (!wide) look.y -= .12;
    camera.lookAt(look);

    // terminal typing
    if (term.typing && term.shown < term.typing.length) { term.shown = Math.min(term.typing.length, term.shown + 2); term.dirty = true; }
    const cur = Math.floor(t * 2) % 2 === 0;
    if (cur !== term.cursor) { term.cursor = cur; term.dirty = true; }
    if (term.dirty && frame % 2 === 0) { drawScreen(); term.dirty = false; }

    led.material.color.setHex(Math.sin(t * 6) > 0 ? 0x7ee0c3 : 0x1d4a3d);
    leaves.forEach((l, i) => { l.rotation.z = Math.sin(t * .8 + i) * .04; });
    screenGlow.intensity = .8 + Math.sin(t * 3) * .05;

    robot.update(t, camera, canvas);
    renderer.render(scene, camera);
  }
  drawScreen();
  requestAnimationFrame(tick);
}

function buildRobot() {
  const group = new THREE.Group();
  const shell = mat(0xeceaf3, .32, .05);
  const dark = mat(0x1d2030, .4, .3);
  const visorMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0c16, roughness: .12, metalness: .2, clearcoat: 1, clearcoatRoughness: .05 });
  const glow = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });

  // hover pad
  const pad = mesh(new THREE.CylinderGeometry(.09, .1, .018, 40), dark);
  pad.position.y = .009; group.add(pad);
  const ring = mesh(new THREE.TorusGeometry(.085, .004, 8, 48), glow(ACCENT), false);
  ring.rotation.x = Math.PI / 2; ring.position.y = .019; group.add(ring);

  const floatG = new THREE.Group(); group.add(floatG);
  const torso = rbox(.17, .16, .13, .055, shell); torso.position.y = .13; floatG.add(torso);
  const belly = rbox(.1, .06, .02, .01, dark); belly.position.set(0, .12, .062); floatG.add(belly);
  const core = mesh(new THREE.CircleGeometry(.014, 24), glow(ACCENT), false); core.position.set(0, .12, .0725); floatG.add(core);

  const arms = [-1, 1].map(s => {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * .1, .18, 0);
    const a = mesh(new THREE.CapsuleGeometry(.021, .07, 6, 16), shell);
    a.position.y = -.05;
    const hand = mesh(new THREE.SphereGeometry(.022, 20, 14), dark);
    hand.position.y = -.1;
    shoulder.add(a, hand);
    shoulder.rotation.z = s * .12;
    floatG.add(shoulder);
    return shoulder;
  });

  const head = new THREE.Group(); head.position.y = .30; floatG.add(head);
  const skull = rbox(.24, .17, .17, .065, shell); head.add(skull);
  const visor = rbox(.2, .105, .03, .035, visorMat); visor.position.z = .075; head.add(visor);
  const eyes = [-1, 1].map(s => {
    const e = mesh(new THREE.CapsuleGeometry(.012, .016, 4, 12), glow(EYE), false);
    e.position.set(s * .042, .004, .092);
    head.add(e);
    return e;
  });
  [-1, 1].forEach(s => {
    const ear = mesh(new THREE.CylinderGeometry(.03, .03, .02, 28), dark);
    ear.rotation.z = Math.PI / 2; ear.position.x = s * .125; head.add(ear);
    const dot = mesh(new THREE.CircleGeometry(.012, 20), glow(ACCENT2), false);
    dot.position.x = s * .1355; dot.rotation.y = s * Math.PI / 2; head.add(dot);
  });
  const stalk = mesh(new THREE.CylinderGeometry(.004, .004, .06, 8), dark); stalk.position.y = .11; head.add(stalk);
  const bulbMat = glow(ACCENT);
  const bulb = mesh(new THREE.SphereGeometry(.014, 16, 12), bulbMat, false); bulb.position.y = .145; head.add(bulb);

  const state = { talking: false, blinkAt: 2, pokeAt: -10, t: 0 };
  const tmp = new THREE.Vector3();
  const headTarget = { x: 0, y: 0 };

  function update(t, camera, canvas) {
    state.t = t;
    floatG.position.y = .02 + Math.sin(t * 2) * .008;
    ring.material.color.setHex(ACCENT).multiplyScalar(.75 + Math.sin(t * 2) * .25);

    // look toward the cursor: project the robot head to screen space and aim from there
    head.getWorldPosition(tmp).project(camera);
    const r = canvas.getBoundingClientRect();
    const hx = r.left + (tmp.x + 1) / 2 * r.width, hy = r.top + (1 - tmp.y) / 2 * r.height;
    const dx = (pointer.px - hx) / innerWidth, dy = (pointer.py - hy) / innerHeight;
    headTarget.x = THREE.MathUtils.clamp(dx * 2.2, -.9, .9) + .35;
    headTarget.y = THREE.MathUtils.clamp(dy * 1.6, -.4, .45);
    head.rotation.y += (headTarget.x - head.rotation.y) * .08;
    head.rotation.x += (headTarget.y - head.rotation.x) * .08;

    // blink
    if (t > state.blinkAt) { state.blinkAt = t + 2.5 + Math.random() * 3; state.blinkStart = t; }
    const bt = t - (state.blinkStart ?? -1);
    const lid = bt < .14 ? Math.abs(Math.cos(bt / .14 * Math.PI)) : 1;
    eyes.forEach(e => { e.scale.y = Math.max(.08, lid) * (state.talking ? 1 + Math.abs(Math.sin(t * 14)) * .25 : 1); });

    // arms: wave while talking, flail after a poke, idle sway otherwise
    const poked = t - state.pokeAt < 1.2;
    const waveR = state.talking ? -1.9 + Math.sin(t * 9) * .45 : poked ? -2.6 + Math.sin(t * 20) * .3 : .12 + Math.sin(t * 1.6) * .05;
    const waveL = poked ? 2.6 + Math.sin(t * 20 + 1) * .3 : -.12 - Math.sin(t * 1.6) * .05;
    arms[1].rotation.z += (waveR - arms[1].rotation.z) * .15;
    arms[0].rotation.z += (waveL - arms[0].rotation.z) * .15;
    torso.rotation.y = Math.sin(t * .7) * .06;
    head.position.y = .30 + (state.talking ? Math.abs(Math.sin(t * 12)) * .006 : 0);
    bulbMat.color.setHex(state.talking && Math.sin(t * 16) > 0 ? 0xffffff : ACCENT);
    if (poked) floatG.position.y += Math.abs(Math.sin((t - state.pokeAt) * 10)) * .03 * (1.2 - (t - state.pokeAt));
  }

  return {
    group, update,
    poke: () => { state.pokeAt = state.t; },
    set talking(v) { state.talking = v; },
  };
}

// ============================================================ DRONE
function initDrone() {
  const canvas = document.getElementById('drone');
  const renderer = makeRenderer(canvas, true);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .6;
  scene.add(new THREE.HemisphereLight(0xdde3ff, 0x221a2a, .9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(2, 5, 4);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(30, 1, .1, 50);
  camera.position.set(0, 0, 10);

  // build the quadcopter
  const drone = new THREE.Group();
  const tilt = new THREE.Group();
  drone.add(tilt);
  const white = mat(0xf0eef5, .3, .05), dark = mat(0x1d2030, .35, .4);
  const body = rbox(.26, .07, .34, .03, white); tilt.add(body);
  const canopy = rbox(.16, .04, .2, .02, new THREE.MeshPhysicalMaterial({ color: 0x0b0e18, roughness: .1, clearcoat: 1 }));
  canopy.position.set(0, .045, -.01); tilt.add(canopy);
  const gimbal = mesh(new THREE.SphereGeometry(.04, 20, 14), dark); gimbal.position.set(0, -.05, .14); tilt.add(gimbal);
  const lens = mesh(new THREE.CircleGeometry(.018, 20), new THREE.MeshBasicMaterial({ color: ACCENT2 }), false);
  lens.position.set(0, -.05, .181); tilt.add(lens);
  const rotors = [];
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const arm = rbox(.04, .025, .26, .01, white);
    arm.position.set(x * .14, 0, z * .12);
    arm.rotation.y = Math.atan2(x, z);
    tilt.add(arm);
    const motor = mesh(new THREE.CylinderGeometry(.03, .03, .04, 20), dark);
    motor.position.set(x * .23, .02, z * .2); tilt.add(motor);
    const rotor = new THREE.Group();
    rotor.position.set(x * .23, .045, z * .2);
    const blade = mesh(new THREE.BoxGeometry(.26, .004, .025), mat(0x2a2e3e, .4));
    rotor.add(blade);
    const disc = mesh(new THREE.CircleGeometry(.13, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .06, depthWrite: false }), false);
    disc.rotation.x = -Math.PI / 2; rotor.add(disc);
    tilt.add(rotor);
    rotors.push(rotor);
    const light = mesh(new THREE.SphereGeometry(.012, 10, 8), new THREE.MeshBasicMaterial({ color: z < 0 ? 0xff6b6b : 0x7ee0c3 }), false);
    light.position.set(x * .23, -.01, z * .2 + z * .03); tilt.add(light);
  }
  scene.add(drone);

  let W = innerWidth, H = innerHeight;
  function resize() {
    W = innerWidth; H = innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  // screen pixel -> world point on the z=0 plane
  const v = new THREE.Vector3(), dir = new THREE.Vector3();
  function toWorld(px, py, out) {
    v.set(px / W * 2 - 1, -(py / H) * 2 + 1, .5).unproject(camera);
    dir.copy(v).sub(camera.position).normalize();
    return out.copy(camera.position).addScaledVector(dir, -camera.position.z / dir.z);
  }

  const target = new THREE.Vector3(), pos = new THREE.Vector3(), vel = new THREE.Vector3();
  toWorld(W * .7, H * .3, pos);
  let scale = 0, last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    if (document.hidden) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const t = now / 1000;

    toWorld(pointer.px + 70, pointer.py - 60, target);
    const acc = target.clone().sub(pos).multiplyScalar(9);
    vel.addScaledVector(acc, dt).multiplyScalar(Math.pow(.04, dt));
    pos.addScaledVector(vel, dt);
    drone.position.set(pos.x, pos.y + Math.sin(t * 2.4) * .03, 0);

    // bank into motion, view slightly from above
    tilt.rotation.x = .55 + THREE.MathUtils.clamp(-vel.y * .12, -.4, .4);
    tilt.rotation.z = THREE.MathUtils.clamp(-vel.x * .12, -.55, .55);
    tilt.rotation.y += (THREE.MathUtils.clamp(vel.x * .08, -.5, .5) - tilt.rotation.y) * .1;
    rotors.forEach((r, i) => { r.rotation.y += (i % 2 ? -1 : 1) * .9; });

    scale += ((pointer.inside ? 1 : 0) - scale) * .08;
    drone.scale.setScalar(.8 * Math.max(.001, scale));
    renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);
}
