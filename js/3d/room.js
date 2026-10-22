// The hero scene: room, desk props, ARIA and Bolt, plus the choreography that ties them to the chat
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { C, mat, rbox, Bubbles, Confetti, rand, pick } from './helpers.js';
import { buildRobot } from './robot.js';
import { buildBolt, makePaper, makeEnvelope } from './bolt.js';
import * as P from './props.js';
import { initCursorDrone } from './cursor-drone.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
function makeRenderer(canvas, alpha) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  return r;
}

// shared pointer, in pixels and normalised -1..1
const pointer = { x: 0, y: 0, px: innerWidth / 2, py: innerHeight / 2, inside: false };
addEventListener('pointermove', e => {
  pointer.px = e.clientX; pointer.py = e.clientY;
  pointer.x = e.clientX / innerWidth * 2 - 1;
  pointer.y = -(e.clientY / innerHeight * 2 - 1);
  pointer.inside = true;
});
document.addEventListener('pointerleave', () => { pointer.inside = false; });

if (!hasWebGL()) {
  document.documentElement.classList.add('no-webgl');
  document.getElementById('drone').remove();
} else {
  initRoom();
  if (finePointer && !reduce) initCursorDrone(document.getElementById('drone'), pointer, makeRenderer);
  else document.getElementById('drone').remove();
}

function initRoom() {
  const host = document.getElementById('scene');
  const canvas = document.getElementById('room');
  const renderer = makeRenderer(canvas, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.bg);
  scene.fog = new THREE.Fog(C.bg, 4.8, 10);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .35;
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 40);

  // ---- lights
  scene.add(new THREE.HemisphereLight(0xaab4ff, 0x1a1420, .55));
  const key = new THREE.DirectionalLight(0xfff1e6, 1.6);
  key.position.set(2.2, 4, 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -2.4, right: 2.4, top: 2.4, bottom: -1, near: .5, far: 12 });
  key.shadow.bias = -.0004; key.shadow.normalBias = .02;
  scene.add(key);
  const rim = new THREE.DirectionalLight(C.accent2, 1.4);
  rim.position.set(-3, 2.5, -2);
  scene.add(rim);

  // ---- room + desk
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), mat(0x13162a, .95));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), mat(0x181c33, .92));
  wall.position.set(0, 3.5, -.85); wall.receiveShadow = true;
  scene.add(wall);
  const TOP = .775;
  const desk = rbox(3.1, .05, 1.15, .02, mat(C.wood, .55)); desk.position.y = .75; scene.add(desk);
  for (const [x, z] of [[-1.48, -.5], [1.48, -.5], [-1.48, .5], [1.48, .5]]) {
    const leg = rbox(.05, .73, .05, .015, mat(C.steel, .4, .6)); leg.position.set(x, .365, z); scene.add(leg);
  }

  // ---- bubbles + effects
  const bubbles = new Bubbles(document.getElementById('bubbles'), camera, canvas);
  const confetti = new Confetti(scene);
  const fx = { say: (anchor, text, opts) => bubbles.say(anchor, text, opts) };

  // ---- props
  const updaters = [];
  const clickables = [];
  function place(prop, x, z, ry = 0, y = TOP) {
    prop.group.position.set(x, y, z);
    prop.group.rotation.y = ry;
    scene.add(prop.group);
    if (prop.update) updaters.push(prop.update);
    if (prop.onClick) clickables.push(prop);
    return prop;
  }
  const monitor = place(P.buildMonitor(), -.2, -.28);
  place(P.buildKeyboard(), -.25, .17);
  const laptop = place(P.buildLaptop(), -.9, -.16, .5);
  const cat = place(P.buildCat(fx), 1.27, .36, -.5);
  place(P.buildPlant(), -1.38, -.1);
  place(P.buildLava(), -1.36, -.42);
  place(P.buildMug(), -.68, .32);
  place(P.buildDuck(fx), -.5, .42, .5);
  place(P.buildHeadphones(), -.08, .44, .25);
  place(P.buildCube(fx), .2, .42, .3);
  place(P.buildBreadboard(), .4, .3, -.15);
  place(P.buildPi(), .93, -.3, -.4);
  place(P.buildArm(), 1.18, -.12, 0);
  place(P.buildCans(), 1.45, .0, -.2);
  place(P.buildPizza(), -1.12, .3, .2);
  const lamp = place(P.buildLamp(), 1.38, -.4, 0);
  const wallProps = place(P.buildWall(), .75, -.73, 0, 1.72);
  void laptop; void lamp;

  // ---- ARIA + Bolt
  const RS = 1.4;   // ARIA is drawn larger than life so emotes read at a glance
  const robot = buildRobot();
  robot.group.scale.setScalar(RS);
  robot.group.position.set(.62, TOP, .02);
  robot.group.rotation.y = -.3;
  scene.add(robot.group);
  const bolt = buildBolt(scene, new THREE.Vector3(.98, TOP, .3), 1.3);
  clickables.push({ group: robot.group, onClick: () => poke() }, { group: bolt.group, onClick: () => boltClick() });

  // emote side effects
  robot.onEmote = name => {
    const above = { offset: [0, .2, 0] };
    if (name === 'dance') [0, 900, 1800, 2700].forEach(d => setTimeout(() => fx.say(robot.head, pick(['🎵', '🎶']), { emoji: true, dur: 1500, offset: [rand(-.1, .1), .15, 0] }), d));
    if (name === 'celebrate') confetti.burst(robot.topWorld().add(new THREE.Vector3(0, .05, 0)));
    if (name === 'love' || name === 'lookCat') fx.say(robot.head, '💖', { emoji: true, ...above });
    if (name === 'dizzy') fx.say(robot.head, '💫', { emoji: true, dur: 2600, ...above });
    if (name === 'angry') fx.say(robot.head, '💢', { emoji: true, ...above });
    if (name === 'surprised') fx.say(robot.head, '❗', { emoji: true, dur: 1200, ...above });
  };

  // ---- choreography (Bolt + ARIA together)
  // pauses count scene time, like Bolt's moves, so routines stay in sync at any frame rate
  let t = 0;
  const timers = [];
  const wait = ms => new Promise(resolve => timers.push({ at: t + ms / 1000, resolve }));
  let show = false;
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const robotAt = (dx, dy, dz) => robot.group.position.clone().add(v3(dx * RS, dy * RS, dz * RS));
  async function routine(fn) {
    if (show) return;
    show = true;
    try { await fn(); } finally { show = false; }
  }
  const combos = {
    deliver: kind => routine(async () => {
      const item = kind === 'paper' ? makePaper() : makeEnvelope();
      await bolt.takeoff();
      bolt.carry(item);
      fx.say(bolt.group, kind === 'paper' ? 'Printing… done!' : 'Mail call!', { offset: [0, .1, 0], dur: 1800 });
      await bolt.goTo(robotAt(-.02, .55, .22));
      robot.emote('catch', { force: true });
      await bolt.goTo(robotAt(-.02, .3, .2));
      bolt.carry(null);
      item.position.set(0, 0, 0);
      item.rotation.set(-.3, 0, 0);
      robot.hold(item);
      await bolt.goTo(robotAt(.15, .5, .25));
      bolt.roll();
      await wait(1500);
      robot.hold(null);
      await bolt.land();
    }),
    highfive: () => routine(async () => {
      await bolt.takeoff();
      await bolt.goTo(robotAt(.3, .48, .08));
      robot.emote('highfive', { force: true });
      await wait(650);
      await bolt.goTo(robotAt(.2, .44, .06), { tol: .03 });
      fx.say(() => robotAt(.24, .5, .06), '✋', { emoji: true, dur: 900 });
      await wait(250);
      bolt.roll();
      await bolt.goTo(robotAt(.35, .55, .1));
      await bolt.land();
    }),
    ride: () => routine(async () => {
      await bolt.takeoff(.3);
      await bolt.goTo(robotAt(0, .58, .02));
      robot.emote('ride', { force: true });
      fx.say(robot.head, 'Wheee!', { offset: [.15, .18, 0], dur: 1600 });
      const base = robotAt(0, .58, .02);
      let u = 0;
      const lifter = () => { robot.lift = Math.sin(u * Math.PI) * .2; };
      updaters.push(lifter);
      await bolt.path(k => { u = k; return base.clone().add(v3(Math.sin(k * Math.PI * 2) * .05, Math.sin(k * Math.PI) * .2, 0)); }, 2600);
      updaters.splice(updaters.indexOf(lifter), 1);
      robot.lift = 0;
      robot.end('ride');
      robot.emote('hop');
      await bolt.land();
    }),
    patrol: () => routine(async () => {
      await bolt.takeoff(.35);
      const c = v3(.1, TOP + .5, .05);
      await bolt.goTo(c.clone().add(v3(.8, 0, 0)));
      await bolt.path(u => c.clone().add(v3(Math.cos(u * Math.PI * 2) * .8, Math.sin(u * Math.PI * 4) * .04, Math.sin(u * Math.PI * 4) * .2)), 5000);
      await bolt.land();
    }),
    orbit: () => routine(async () => {
      await bolt.takeoff(.3);
      const c = robotAt(0, .32, 0);
      await bolt.goTo(c.clone().add(v3(.25, 0, 0)));
      robot.emote('spin');
      await bolt.path(u => c.clone().add(v3(Math.cos(u * Math.PI * 4) * .25, Math.sin(u * Math.PI * 8) * .03, Math.sin(u * Math.PI * 4) * .25)), 3000);
      await bolt.land();
    }),
    scanCat: () => routine(async () => {
      await bolt.takeoff(.3);
      const above = cat.group.position.clone().add(v3(0, .34, 0));
      await bolt.goTo(above);
      bolt.scan(true);
      cat.twitch();
      await wait(1400);
      cat.wake('?!');
      bolt.scan(false);
      robot.emote('lookCat');
      fx.say(bolt.group, 'cat.exe detected', { offset: [0, .1, 0], dur: 1600 });
      await wait(800);
      await bolt.land();
    }),
    trophies: () => routine(async () => {
      await bolt.takeoff(.3);
      const c = wallProps.group.position.clone().add(v3(.2, .2, .18));
      await bolt.goTo(c);
      await bolt.path(u => c.clone().add(v3(Math.cos(u * Math.PI * 2) * .15, Math.sin(u * Math.PI * 4) * .03, Math.sin(u * Math.PI * 2) * .08)), 2200);
      await bolt.land();
    }),
  };

  // ---- reactions
  let pokes = [];
  function poke() {
    const now = performance.now();
    pokes = pokes.filter(p => now - p < 6000).concat(now);
    if (robot.current === 'sleep') { wake(); return; }
    const n = pokes.length;
    if (n <= 2) {
      robot.emote('surprised', { force: true });
      dispatchEvent(new CustomEvent('aria:say', { detail: { text: pick(["Oh! Hi. Ask me something, I don't bite.", 'That tickles.', 'Bolt, did you see that?']), topic: 'quip' } }));
    } else if (n <= 5) {
      robot.emote('angry', { force: true });
      fx.say(robot.head, pick(['Hey!', 'Rude.', 'I have feelings. Simulated ones.']), { offset: [0, .2, 0] });
    } else {
      robot.emote('dizzy', { force: true });
      fx.say(robot.head, 'Too… many… clicks…', { offset: [0, .22, 0] });
      pokes = [];
    }
  }
  function boltClick() {
    fx.say(bolt.group, pick(['beep boop', 'bzzt!', 'Bolt, reporting!', '*happy whirring*']), { offset: [0, .1, 0], dur: 1500 });
    if (bolt.flying) { bolt.roll(); return; }
    routine(async () => { await bolt.takeoff(.16); bolt.roll(); await wait(800); await bolt.land(); });
  }
  const TOPIC = {
    hello: () => robot.emote('wave'),
    skills: () => { robot.emote('think'); robot.emote('nod'); },
    projects: () => robot.emote('point'),
    experience: () => robot.emote('nod'),
    education: () => robot.emote('nod'),
    awards: () => { robot.emote('celebrate'); combos.trophies(); },
    contact: () => { robot.emote('hop'); combos.deliver('envelope'); },
    resume: () => combos.deliver('paper'),
    who: () => robot.emote('love'),
    hire: () => robot.emote('celebrate'),
    yes: () => { robot.emote('nod'); robot.emote('hop'); },
    unknown: () => robot.emote('shrug'),
  };
  addEventListener('aria:talk', e => {
    const d = e.detail;
    robot.talking = d.on;
    noteInput();
    if (!d.on) return;
    monitor.say(d.q, d.text);
    if (robot.current === 'sleep') wake();
    TOPIC[d.topic]?.();
  });

  // ---- idle life: antics every so often, nap after 40 s without input
  let lastInput = performance.now(), nextIdle = performance.now() + 9000, napZ = 0;
  function noteInput() {
    lastInput = performance.now();
    if (robot.current === 'sleep') wake();
  }
  function wake() { robot.end('sleep'); robot.emote('stretch'); }
  ['pointerdown', 'keydown', 'wheel'].forEach(ev => addEventListener(ev, noteInput, { passive: true }));
  let lastMove = 0;
  addEventListener('pointermove', () => { const n = performance.now(); if (n - lastMove > 500) { lastMove = n; noteInput(); } }, { passive: true });

  const ANTICS = [
    [3, () => robot.emote('dance')], [2, () => robot.emote('spin')], [2, () => robot.emote('backflip')],
    [1, () => robot.emote('stretch')], [1, () => robot.emote('wave')],
    [2, combos.highfive], [2, combos.ride], [2, combos.patrol], [2, combos.orbit], [2, combos.scanCat],
  ];
  const total = ANTICS.reduce((a, [w]) => a + w, 0);
  function idleTick(now) {
    if (robot.current === 'sleep') {
      if (now > napZ) { napZ = now + 2200; fx.say(robot.head, 'Z', { emoji: true, dur: 2000, offset: [.12, .14, 0] }); }
      return;
    }
    if (now - lastInput > 40000 && !show && !robot.busy) { robot.emote('sleep'); return; }
    if (now < nextIdle) return;
    nextIdle = now + rand(10000, 16000);
    if (show || robot.busy || reduce) return;
    let r = Math.random() * total;
    for (const [w, fn] of ANTICS) { if ((r -= w) <= 0) { fn(); break; } }
  }

  // ---- resume data → terminal, trophies
  // this module can finish loading after content.js has fetched the data, so read the promise rather than wait for the event
  window.resumeReady?.then(d => {
    if (!d) return;
    monitor.setIntro([
      ['$ ', 'whoami'], ['', [d.name, d.titleParts[0]].filter(Boolean).join(' · ').toLowerCase()],
      ['$ ', 'cat focus.txt'], ['', (d.titleParts.slice(1).join(' · ') || d.title).toLowerCase()],
      ['$ ', 'aria --listen'], ['', 'ready.'],
    ]);
    wallProps.setAwards(d.awards);
  });
  document.fonts.ready.then(() => { monitor.redrawFonts(); wallProps.redrawFonts(); });

  // ---- framing
  let W = 1, H = 1, wide = true;
  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    wide = W > 960 && W / H > 1.1;
    if (wide) {
      // render a wider virtual view and show its left part, so the desk sits to the right of the text
      const full = W * 1.22;
      camera.aspect = full / H;
      camera.setViewOffset(full, H, 0, 0, W, H);
    } else {
      camera.aspect = W / H;
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  // ---- clicking things in the scene
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hit(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(clickables.map(c => c.group), true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o) { const c = clickables.find(x => x.group === o); if (c) return c; o = o.parent; }
    return null;
  }
  const hero = host.parentElement;
  const onUi = e => e.target.closest('.hero-col > *');
  hero.addEventListener('pointermove', e => { if (!onUi(e)) canvas.style.cursor = hit(e) ? 'pointer' : ''; });
  hero.addEventListener('click', e => { if (!onUi(e)) hit(e)?.onClick(); });

  window.ARIA3D = { emote: n => robot.emote(n, { force: true }), combo: n => combos[n]?.(), robot, bolt };

  // ---- loop
  let visible = true, frame = 0, last = performance.now();
  const introStart = performance.now();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(host);
  const lookAt = v3(.05, 1.0, 0), smooth = { x: 0, y: 0 }, tmp = new THREE.Vector3();

  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!visible || document.hidden) return;
    step(dt, now);
    renderer.render(scene, camera);
    bubbles.update();
  }

  function step(dt, now) {
    t += dt; frame++;
    for (let i = timers.length - 1; i >= 0; i--) if (t >= timers[i].at) timers.splice(i, 1)[0].resolve();

    const intro = reduce ? 1 : Math.min(1, (now - introStart) / 2400);
    const e = 1 - Math.pow(1 - intro, 3);
    smooth.x += (pointer.x - smooth.x) * .05;
    smooth.y += (pointer.y - smooth.y) * .05;
    const dist = wide ? 4.7 : 3.3 * Math.max(1, 1 / (W / H));
    const yaw = (wide ? -.22 : -.08) + smooth.x * .1 + (1 - e) * .5;
    tmp.copy(lookAt);
    if (!wide) tmp.set(.35, .92, 0);   // phones: close in on ARIA's half of the desk
    camera.position.set(tmp.x - Math.sin(yaw) * dist, 1.62 + smooth.y * .07 + (1 - e) * .5, Math.cos(yaw) * dist);
    camera.lookAt(tmp);

    // robot head follows the cursor: aim from the head's on-screen position
    robot.head.getWorldPosition(tmp).project(camera);
    const r = canvas.getBoundingClientRect();
    const hx = r.left + (tmp.x + 1) / 2 * r.width, hy = r.top + (1 - tmp.y) / 2 * r.height;
    const lx = THREE.MathUtils.clamp((pointer.px - hx) / innerWidth * 2.2, -.9, .9) + .3;
    const ly = THREE.MathUtils.clamp((pointer.py - hy) / innerHeight * 1.6, -.4, .45);

    robot.update(t, lx, ly);
    bolt.update(dt, t);
    updaters.forEach(u => u(t, dt));
    confetti.update(dt);
    if (idleOn) idleTick(now);
  }
  requestAnimationFrame(tick);

  // debug/testing: advance the simulation without waiting for frames (handy where WebGL is slow)
  let idleOn = true;
  Object.assign(window.ARIA3D, {
    advance(sec) { for (let i = 0; i < sec * 30; i++) step(1 / 30, performance.now()); renderer.render(scene, camera); bubbles.update(); },
    idle(on) { idleOn = on; },
  });
}
