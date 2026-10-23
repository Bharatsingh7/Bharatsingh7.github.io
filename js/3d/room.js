// The hero scene: room, desk props, ARIA and Bolt, plus the choreography that ties them to the chat
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { C, U, RGB_MODES, mat, rbox, mesh, glow, ledStrip, blobShadow, bake, rgbAt, Bubbles, Confetti, rand, pick, clamp } from './helpers.js';
import { buildRobot } from './robot.js';
import { buildBolt, makePaper, makeEnvelope } from './bolt.js';
import * as P from './props.js';
import * as G from './gadgets.js';
import { Foliage } from './plants.js';
import { buildRoomShell, BACK, CEIL, WIN } from './roomshell.js';
import { quality, frameMonitor } from './quality.js';
import { initCursorDrone } from './cursor-drone.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
function makeRenderer(canvas, alpha) {
  const q = quality.s;
  const r = new THREE.WebGLRenderer({ canvas, antialias: q.aa, alpha, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, q.dpr));
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
  // build the room after the page has loaded and painted, so the text shows up straight away
  // (module scripts run after the HTML is parsed; a short idle wait lets the text paint first)
  const idle = fn => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 600 }) : setTimeout(fn, 100));
  idle(() => {
    initRoom();
    if (finePointer && !reduce) initCursorDrone(document.getElementById('drone'), pointer, makeRenderer);
    else document.getElementById('drone').remove();
  });
}

function initRoom() {
  const host = document.getElementById('scene');
  const canvas = document.getElementById('room');
  const q = quality.s;
  document.documentElement.dataset.quality = quality.tier;
  const renderer = makeRenderer(canvas, false);
  renderer.shadowMap.enabled = q.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;   // the soft variant costs ~4x per pixel
  renderer.shadowMap.autoUpdate = false;   // refreshed every few frames instead, see step()
  renderer.localClippingEnabled = true;    // the 3D printer reveals its print with a clipping plane

  const DAY_BG = new THREE.Color(0x0f1a15), NIGHT_BG = new THREE.Color(0x070b10);
  const scene = new THREE.Scene();
  scene.background = DAY_BG.clone();
  scene.fog = new THREE.Fog(DAY_BG.clone(), 6, 14);
  // reflections from a baked room environment; the low tier skips it (it costs a few hundred ms to build)
  if (q.tex === 1) {
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture;
    scene.environmentIntensity = .3;
  }
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 40);

  // ---- room shell (walls, window, sun, neon, RGB cove) + soft fill lights
  const shell = buildRoomShell(scene, q);
  bake(shell.group);
  const hemi = new THREE.HemisphereLight(0xd4ecdc, 0x2a2018, .5);
  scene.add(hemi);
  const fill = new THREE.DirectionalLight(0xe4ecff, .55);
  fill.position.set(-2, 3, 5);
  scene.add(fill);
  // the low tier skips these two: every light adds shading cost to every pixel
  const moon = new THREE.DirectionalLight(C.accent2, .2);
  moon.position.set(-3, 2.5, -2);
  const rgbLight = new THREE.PointLight(0xffffff, 1, 4.5, 1.6);
  rgbLight.position.set(-.1, 1.5, -.45);
  if (quality.tier !== 'low') scene.add(moon, rgbLight);

  // ---- desk
  const TOP = .775;
  const desk = rbox(3.1, .05, 1.15, .02, mat(C.wood, .55)); desk.position.y = .75; scene.add(desk);
  const legs = new THREE.Group();
  for (const [x, z] of [[-1.48, -.5], [1.48, -.5], [-1.48, .5], [1.48, .5]]) {
    const leg = rbox(.05, .73, .05, .015, mat(C.steel, .4, .6)); leg.position.set(x, .365, z); legs.add(leg);
  }
  scene.add(bake(legs));
  const lip = ledStrip(3.06, { spill: 0, u0: .4, u1: 1.4, thick: .01 }); lip.position.set(0, .736, .582); scene.add(lip);

  // ---- bubbles + effects
  const bubbles = new Bubbles(document.getElementById('bubbles'), camera, canvas);
  const confetti = new Confetti(scene);
  const fx = { say: (anchor, text, opts) => bubbles.say(anchor, text, opts), burst: at => confetti.burst(at) };

  // ---- props
  const updaters = [];
  const clickables = [];
  function place(prop, x, z, ry = 0, y = TOP, shadow = null) {
    prop.group.position.set(x, y, z);
    prop.group.rotation.y = ry;
    scene.add(prop.group);
    if (prop.update) updaters.push(prop.update);
    if (prop.onClick) clickables.push(prop);
    // soft contact shadows stand in for real ones on the low tier
    if (shadow && !q.shadows) { const b = blobShadow(...shadow); b.position.set(x, y + .002, z); b.rotation.z = -ry; scene.add(b); }
    bake(prop.group);   // merge the parts that never move (moving parts are flagged userData.live)
    // tiny parts don't need to cast shadows; fewer casters makes the shadow pass cheaper
    prop.group.traverse(o => { if (o.isMesh && o.castShadow) { o.geometry.computeBoundingSphere(); if (o.geometry.boundingSphere.radius < .03) o.castShadow = false; } });
    return prop;
  }

  // desk, left to right
  const monitor = place(P.buildMonitor(), -.2, -.28, 0, TOP, [.5, .3]);
  place(P.buildKeyboard(), -.25, .17);
  place(P.buildLaptop(), -.95, -.16, .5, TOP, [.45, .35, .4]);
  place(G.buildScope(), -1.33, -.36, .35, TOP, [.32, .26]);
  place(P.buildPizza(), -1.15, .28, .2, TOP, [.34, .34, .3]);
  place(G.buildController(), -.85, .45, .35);
  place(P.buildMug(), -.66, .3);
  place(P.buildDuck(fx), -.5, .44, .5);
  place(P.buildHeadphones(), -.08, .44, .25);
  place(P.buildCube(fx), .2, .42, .3);
  place(P.buildBreadboard(), .4, .3, -.15);
  place(P.buildPi(), .5, -.45, -.4);
  place(P.buildArm(), 1.02, -.2, 0, TOP, [.25, .25]);
  place(G.buildPrinter(fx), 1.36, -.33, -.2, TOP, [.42, .42]);
  const cat = place(P.buildCat(fx), 1.27, .36, -.5, TOP, [.4, .32]);
  const wallProps = place(P.buildWall(), .75, -.73, 0, 1.72);

  // floor and walls
  const rgb = {
    cycle() {
      U.uMode.value = (U.uMode.value + 1) % RGB_MODES.length;
      panel.refresh();
      fx.say(panel.group, `RGB: ${RGB_MODES[U.uMode.value]}`, { offset: [0, .16, 0], dur: 1400 });
    },
  };
  place(G.buildPC(() => rgb.cycle()), 2.08, -.7, 0, 0, [.6, .35]);
  const panel = place(G.buildPanel({ isDay: () => shell.isDay, cycle: () => rgb.cycle() }), 1.5, BACK + .015, 0, 1.52);
  place(G.buildChair(), -1.85, .8, .9, 0, [.7, .7]);
  const shelfStrip = ledStrip(.88, { spill: .3, u0: .9, u1: 1.3 }); shelfStrip.position.set(.75, 1.7, -.64); scene.add(shelfStrip);
  place(G.buildWalker(.1), .62, -.73, 0, 1.7325);
  // a second shelf on the left: seedlings under a grow light, lava lamp, cans
  const leftShelf = new THREE.Group(); leftShelf.position.set(-1.95, 1.3, -.75); scene.add(leftShelf);
  leftShelf.add(rbox(1.0, .025, .2, .008, mat(C.wood, .55)));
  const grow = new THREE.Group(); grow.position.set(-.22, .3, 0); leftShelf.add(grow);
  grow.add(rbox(.42, .018, .04, .006, mat(0x2a2d36, .5)));
  const growBar = mesh(new THREE.BoxGeometry(.38, .006, .02), glow(0xff5fd2), false); growBar.position.y = -.011; grow.add(growBar);
  const growCone = mesh(new THREE.CylinderGeometry(.19, .3, .26, 4, 1, true), new THREE.MeshBasicMaterial({ color: 0xff4fc8, transparent: true, opacity: .07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), false);
  growCone.rotation.y = Math.PI / 4; growCone.scale.z = .25; growCone.position.y = -.14; grow.add(growCone);
  [-.2, .2].forEach(x => { const w = mesh(new THREE.CylinderGeometry(.002, .002, .2, 4), mat(0x777777, .5), false); w.position.set(x, .1, 0); grow.add(w); });
  place(P.buildLava(), -1.62, -.75, 0, 1.3125);
  place(P.buildCans(), -1.5, -.75, .3, 1.3125);

  // ---- plants: everything leafy goes through one Foliage so it shares two instanced meshes
  const fol = new Foliage(q.foliage);
  fol.bush(new THREE.Vector3(-1.45, TOP, .08));
  fol.monstera(new THREE.Vector3(-2.3, 0, -.45));
  fol.snake(new THREE.Vector3(2.75, 0, -.6));
  fol.snake(new THREE.Vector3(-2.75, 0, .2));
  fol.seedlings(new THREE.Vector3(-2.17, 1.3125, -.75));
  const hooks = [[-1.25, -.45, .42, 1.0], [.95, -.4, .32, .7], [2.6, -.55, .5, 1.1], [-2.55, -.3, .45, .9]];
  const pots = hooks.map(([x, z, drop, length]) => fol.hanging(new THREE.Vector3(x, CEIL, z), { drop, length, vines: 5 }));
  const sillY = WIN.y0 + .0075;
  const sillStops = [1.95, 2.2, 2.45, 2.7];
  sillStops.forEach((x, i) => fol.succulent(new THREE.Vector3(x, sillY, BACK + .1), 1.1, [0x7fb58a, 0x9cc7a0, 0x6fa77f, 0xa9c98a][i]));
  // vines framing the window and draping off the wall shelf
  fol.vine([[WIN.x0 - .05, WIN.y1 + .06, BACK + .05], [(WIN.x0 + WIN.x1) / 2, WIN.y1 + .02, BACK + .06], [WIN.x1 + .04, WIN.y1 + .05, BACK + .05], [WIN.x1 + .07, WIN.y1 - .4, BACK + .06], [WIN.x1 + .05, WIN.y0 + .3, BACK + .07]].map(p => new THREE.Vector3(...p)), { size: .05 });
  fol.vine([[WIN.x0 - .04, WIN.y1 + .04, BACK + .05], [WIN.x0 - .08, WIN.y1 - .5, BACK + .06], [WIN.x0 - .05, WIN.y1 - .8, BACK + .08]].map(p => new THREE.Vector3(...p)), { size: .048 });
  fol.vine([[.36, 1.735, -.64], [.33, 1.6, -.62], [.36, 1.42, -.6], [.33, 1.3, -.6]].map(p => new THREE.Vector3(...p)), { size: .045 });
  fol.vine([[1.15, 1.735, -.64], [1.18, 1.62, -.62], [1.16, 1.52, -.6]].map(p => new THREE.Vector3(...p)), { size: .045 });
  // terrarium on top of the PC, with ferns from the shared foliage
  const terraAt = new THREE.Vector3(2.0, .5, -.7);
  const terra = G.buildTerrarium(fol, terraAt);
  terra.group.position.copy(terraAt); scene.add(terra.group); updaters.push(terra.update);
  fol.build(scene);
  bake(fol.statics);
  clickables.push(...fol.meshes.map(m => ({ group: m, onClick: hitAt => plantClick(hitAt) })));

  // ---- little robots: vacuum on the floor, SproutBot on the windowsill
  const vacuum = place(G.buildVacuum(fx, { x0: -1.3, x1: 2.9, z0: .78, z1: 1.7 }, [{ x: -1.85, z: .8, r: .4 }]), 0, 0, 0, 0);
  const sprout = place(G.buildSproutBot(fx, sillStops.map(x => x - (WIN.x0 + WIN.x1) / 2)), (WIN.x0 + WIN.x1) / 2, BACK + .16, 0, sillY);

  // ---- clickable room bits
  clickables.push(
    { group: shell.windowHit, onClick: () => { shell.setDay(!shell.isDay); panel.refresh(); fx.say(shell.windowHit, shell.isDay ? 'Good morning ☀️' : 'Lights on 🌙', { offset: [0, .2, .2], dur: 1500 }); } },
    ...shell.signs.map(m => ({ group: m, onClick: () => shell.poke(m) })),
  );

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
    water: at => routine(async () => {
      const spot = (at || pick(pots)).clone();
      await bolt.takeoff(.3);
      await bolt.goTo(spot.clone().add(v3(0, .22, .25)));
      fx.say(bolt.group, 'Watering 🌱', { offset: [0, .1, 0], dur: 1500 });
      for (let i = 0; i < 3; i++) { fx.say(() => spot.clone().add(v3(rand(-.08, .08), .12, .1)), '💧', { emoji: true, dur: 1100 }); U.uGust.value = .6; await wait(450); }
      robot.emote('hop');
      fx.say(robot.head, '💚', { emoji: true, offset: [0, .2, 0] });
      await wait(400);
      await bolt.land();
    }),
    chase: () => routine(async () => {
      await bolt.takeoff(.3);
      fx.say(bolt.group, 'Race you!', { offset: [0, .1, 0], dur: 1400 });
      cat.wake(pick(['…a robot on a robot?', '!?', 'Mrrp?!']));
      robot.emote('surprised');
      const over = () => vacuum.position.clone().add(v3(0, .4, 0));
      await bolt.goTo(over(), { tol: .06 });
      await bolt.path(() => over(), 3200);
      vacuum.spin();
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
  function plantClick(at) {
    U.uGust.value = 1;
    fx.say(() => at, pick(['🌿', '🍃', '✨']), { emoji: true, dur: 1200 });
    if (!show && Math.random() < .6) combos.water(at);
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
    [2, () => combos.water()], [2, combos.chase],
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
    shell.setName((d.name || 'hello').split(/\s+/)[0]);
  });
  document.fonts.ready.then(() => { monitor.redrawFonts(); wallProps.redrawFonts(); panel.refresh(); });
  document.fonts.load('400 64px Yellowtail').then(() => shell.redrawFonts(), () => {});
  // day or night from the visitor's own clock
  const hour = new Date().getHours();
  shell.setDay(hour >= 6 && hour < 18, true);

  // ---- framing
  // wide: desk sits right of the hero text; narrow (phones): close in on ARIA, the neon sign and the shelf.
  // fit widens the narrow view on very tall screens so the desk never gets cropped
  const VIEW = {
    wide: { look: [.35, 1.3, 0], dist: 5.1, yaw: -.2, h: 1.78 },
    narrow: { look: [.75, 1.42, 0], dist: 4.3, yaw: -.12, h: 1.65, fit: .8 },
  };
  let W = 1, H = 1, wide = true, wideDist = 5.1, rect = canvas.getBoundingClientRect();
  const hero = host.parentElement;
  function resize() {
    const r = host.getBoundingClientRect();
    rect = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    wide = W > 960 && W / H > 1.1;
    if (wide) {
      // render a wider virtual view and show its left part, so the room's centre lands in the middle of the
      // free space right of the text column; then back the camera off until the whole desk fits in that space
      const col = document.querySelector('.hero-col').getBoundingClientRect();
      const colRight = Math.min(W * .55, col.right - r.left + 24);
      const full = W + colRight;
      camera.aspect = full / H;
      camera.setViewOffset(full, H, 0, 0, W, H);
      const halfDesk = 1.75;   // desk plus a little margin, in metres
      wideDist = clamp(halfDesk * H / ((W - colRight) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))), VIEW.wide.dist, 8);
      hero.style.setProperty('--col', `${colRight}px`);
    } else {
      camera.aspect = W / H;
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);

  // ---- clicking things in the scene, and dragging to look around
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const targets = () => clickables.map(c => c.group);
  function hit(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(targets(), true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o) { const c = clickables.find(x => x.group === o); if (c) return { c, point: hits[0].point }; o = o.parent; }
    return null;
  }
  // the canvas rect is cached (reading it every frame forces a layout); scrolling only moves it
  addEventListener('scroll', () => { rect = canvas.getBoundingClientRect(); }, { passive: true });
  resize();
  const onUi = e => e.target.closest('.hero-col > *');
  const drag = { on: false, x0: 0, yaw0: 0, yaw: 0, moved: false, releasedAt: -1e9 };
  canvas.style.touchAction = 'pan-y';   // vertical swipes still scroll the page; sideways ones turn the view
  hero.addEventListener('pointerdown', e => {
    if (onUi(e)) return;
    Object.assign(drag, { on: true, x0: e.clientX, yaw0: drag.yaw, moved: false });
  });
  addEventListener('pointermove', e => {
    if (!drag.on) return;
    const dx = e.clientX - drag.x0;
    if (Math.abs(dx) > 6) drag.moved = true;
    if (drag.moved) drag.yaw = clamp(drag.yaw0 - dx * .0035, -.5, .5);
  }, { passive: true });
  const endDrag = () => { if (drag.on) { drag.on = false; drag.releasedAt = performance.now(); } };
  addEventListener('pointerup', endDrag);
  addEventListener('pointercancel', () => { drag.on = false; drag.moved = false; drag.releasedAt = performance.now(); });
  // hover feedback raycasts at most ~8 times a second, and only for a mouse
  let lastHover = 0;
  hero.addEventListener('pointermove', e => {
    if (!finePointer || drag.on || onUi(e) || e.timeStamp - lastHover < 120) return;
    lastHover = e.timeStamp;
    canvas.style.cursor = hit(e) ? 'pointer' : 'grab';
  });
  hero.addEventListener('click', e => {
    if (onUi(e) || drag.moved) return;
    const h = hit(e);
    h?.c.onClick(h.point);
  });

  window.ARIA3D = { emote: n => robot.emote(n, { force: true }), combo: (n, ...a) => combos[n]?.(...a), robot, bolt, quality, renderer, rgb, shell, scene, camera };

  // ---- loop
  let visible = true, frame = 0, last = performance.now(), lastRender = 0;
  const introStart = performance.now();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(host);
  const smooth = { x: 0, y: 0 }, tmp = new THREE.Vector3(), look = new THREE.Vector3();
  const monitorFps = frameMonitor(tier => {
    const s2 = quality.s;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, s2.dpr));
    resize();
    if (!s2.shadows) { shell.sun.castShadow = false; shell.sun.intensity *= .6; }
    if (!s2.dust && shell.dust) shell.dust.visible = false;
    document.documentElement.dataset.quality = tier;
    console.info(`[room] running slow, quality → ${tier}`);
  });

  function tick(now) {
    requestAnimationFrame(tick);
    if (!visible || document.hidden) { last = now; return; }
    const minGap = 1000 / quality.s.fps - 2;
    if (now - lastRender < minGap) return;
    const ms = now - (lastRender || now);
    lastRender = now;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    step(dt, now);
    renderer.render(scene, camera);
    if (!canvas.classList.contains('ready')) canvas.classList.add('ready');
    bubbles.update();
    monitorFps(ms);
  }

  const dayBg = new THREE.Color();
  let idleOn = true;
  function step(dt, now) {
    t += dt; frame++;
    U.uTime.value = t;
    U.uGust.value = Math.max(0, U.uGust.value - dt * .7);
    for (let i = timers.length - 1; i >= 0; i--) if (t >= timers[i].at) timers.splice(i, 1)[0].resolve();

    // camera: intro sweep, a little cursor parallax, plus whatever the visitor dragged (eases back after a while)
    const intro = reduce ? 1 : Math.min(1, (now - introStart) / 2400);
    const e = 1 - Math.pow(1 - intro, 3);
    smooth.x += (pointer.x - smooth.x) * .05;
    smooth.y += (pointer.y - smooth.y) * .05;
    if (!drag.on && now - drag.releasedAt > 4000) drag.yaw *= .97;
    const v = wide ? VIEW.wide : VIEW.narrow;
    const dist = wide ? wideDist : v.dist * Math.max(1, v.fit / (W / H));
    const yaw = v.yaw + (finePointer ? smooth.x * .08 : 0) + drag.yaw + (1 - e) * .5;
    look.set(...v.look);
    camera.position.set(look.x - Math.sin(yaw) * dist, v.h + (finePointer ? smooth.y * .07 : 0) + (1 - e) * .5, look.z + Math.cos(yaw) * dist);
    camera.lookAt(look);

    // robot head follows the cursor: aim from the head's on-screen position
    robot.head.getWorldPosition(tmp).project(camera);
    const hx = rect.left + (tmp.x + 1) / 2 * rect.width, hy = rect.top + (1 - tmp.y) / 2 * rect.height;
    const lx = THREE.MathUtils.clamp((pointer.px - hx) / innerWidth * 2.2, -.9, .9) + .3;
    const ly = THREE.MathUtils.clamp((pointer.py - hy) / innerHeight * 1.6, -.4, .45);

    // day and night: sun, fill and sky fade, RGB takes over at night
    shell.update(t, dt);
    const d = shell.day;
    shell.sun.intensity = (quality.s.shadows ? 5 : 1.8) * d;
    hemi.intensity = .25 + .65 * d;
    fill.intensity = .2 + .55 * d;
    moon.intensity = .55 - .35 * d;
    U.uLevel.value = 1 - .4 * d;
    rgbLight.color.copy(rgbAt(.6));
    rgbLight.intensity = U.uMode.value === 3 ? 0 : .5 + 1.6 * (1 - d);
    dayBg.copy(NIGHT_BG).lerp(DAY_BG, d);
    scene.background.copy(dayBg); scene.fog.color.copy(dayBg);
    renderer.toneMappingExposure = .95 + .12 * d;

    robot.update(t, lx, ly);
    bolt.update(dt, t);
    updaters.forEach(u => u(t, dt));
    confetti.update(dt);
    if (idleOn) idleTick(now);

    const every = quality.s.shadowEvery;
    if (every && frame % every === 0) renderer.shadowMap.needsUpdate = true;
  }
  // compile every shader before the first frame (in parallel where the browser supports it),
  // so the room doesn't hitch for the first few seconds; the canvas fades in once it's ready
  resize();
  step(0, performance.now());
  renderer.compileAsync(scene, camera).catch(() => {}).finally(() => { last = performance.now(); requestAnimationFrame(tick); });

  // debug/testing: advance the simulation without waiting for frames (handy where WebGL is slow)
  Object.assign(window.ARIA3D, {
    advance(sec) { for (let i = 0; i < sec * 30; i++) step(1 / 30, performance.now()); renderer.shadowMap.needsUpdate = true; renderer.render(scene, camera); bubbles.update(); },
    idle(on) { idleOn = on; },
    info: () => ({ tier: quality.tier, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, dpr: renderer.getPixelRatio(), shadows: shell.sun.castShadow }),
  });
}
