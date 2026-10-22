// ARIA: the desk robot. A canvas face for expressions and a small timeline engine for emotes.
import * as THREE from 'three';
import { C, mat, glow, mesh, rbox, canvasTexture, ease, lerp } from './helpers.js';

const TAU = Math.PI * 2;
const bounce = (lt, f, a) => Math.abs(Math.sin(lt * Math.PI * f)) * a;

// each emote: dur in seconds (Infinity = until ended), face (string or fn of p), pose(p, lt) -> channel values
// arm channels: raise (outward/up) and fwd (swing forward); body: y, rx, ry, rz; head: hx, hy, hz
const EMOTES = {
  wave: { dur: 1.8, face: 'happy', pose: (p, lt) => ({ ar: 2.6 + Math.sin(lt * 12) * .35, hz: .12 }) },
  nod: { dur: 1.2, face: 'normal', pose: p => ({ hx: Math.sin(p * Math.PI * 3) * .28 * (1 - p * .3) }) },
  shrug: { dur: 1.6, face: 'confused', pose: () => ({ al: 1.0, ar: 1.0, alf: .35, arf: .35, hz: .18, y: -.006 }) },
  hop: { dur: 1, face: 'happy', pose: p => ({ y: Math.abs(Math.sin(p * Math.PI * 2)) * .06, al: .6, ar: .6 }) },
  dance: {
    dur: 4, face: 'happy', pose: (p, lt) => ({
      y: bounce(lt, 2.6, .03), rz: Math.sin(lt * 4) * .12, ry: Math.sin(lt * 2) * .5,
      al: 1.2 + Math.sin(lt * 8) * .8, ar: 1.2 - Math.sin(lt * 8) * .8, hz: -Math.sin(lt * 4) * .15,
    }),
  },
  spin: { dur: 1.4, face: 'happy', pose: p => ({ ry: ease.inOut(p) * TAU, y: Math.sin(p * Math.PI) * .04, al: .9, ar: .9 }) },
  backflip: {
    dur: 1.6, face: p => p < .55 ? 'surprised' : 'happy', pose: p => {
      if (p < .15) return { y: -.02 * (p / .15), al: .3, ar: .3 };
      if (p > .85) return { y: -.02 * (1 - (p - .85) / .15), al: .3, ar: .3 };
      const q = (p - .15) / .7;
      return { y: Math.sin(q * Math.PI) * .3, rx: -ease.inOut(q) * TAU, al: 2.5, ar: 2.5 };
    },
  },
  think: { dur: 2.6, face: 'think', pose: () => ({ ar: .3, arf: 2.0, hx: -.18, hy: .25, hz: .12 }) },
  point: { dur: 2.2, face: 'normal', pose: () => ({ ry: -.75, arf: 1.5, ar: .25, hy: -.1 }) },
  celebrate: {
    dur: 2.4, face: 'happy', pose: (p, lt) => ({
      y: bounce(lt, 2.2, .09), al: 2.8, ar: 2.8 + Math.sin(lt * 14) * .15, rz: Math.sin(lt * 6) * .06,
    }),
  },
  love: {
    dur: 2.4, face: 'hearts', pose: (p, lt) => ({
      rz: Math.sin(lt * 3) * .1, al: .45, ar: .45, alf: 1, arf: 1, hz: Math.sin(lt * 3) * .15,
    }),
  },
  surprised: { dur: 1.2, face: 'surprised', pose: p => ({ y: p < .3 ? Math.sin(p / .3 * Math.PI) * .05 : 0, al: 1.3, ar: 1.3, hx: -.1 }) },
  dizzy: {
    dur: 2.8, face: 'dizzy', pose: (p, lt) => ({
      rz: Math.sin(lt * 5) * .15, rx: Math.cos(lt * 5) * .1, hz: Math.sin(lt * 5 + 1) * .25, al: .6 + Math.sin(lt * 5) * .3, ar: .6 - Math.sin(lt * 5) * .3,
    }),
  },
  angry: { dur: 1.8, face: 'angry', pose: (p, lt) => ({ ry: Math.sin(lt * 30) * .06, al: .15, ar: .15, alf: -.25, arf: -.25, hx: .12, y: -.005 }) },
  sleep: { dur: Infinity, face: 'sleepy', pose: (p, lt) => ({ y: -.012, hx: .32, al: .04, ar: .04, rz: .05 + Math.sin(lt * .8) * .02, hy: 0 }) },
  stretch: {
    dur: 2.1, face: 'happy', pose: p => ({
      al: 2.9 * Math.sin(p * Math.PI), ar: 2.9 * Math.sin(p * Math.PI), y: Math.sin(p * Math.PI) * .02,
      rz: Math.sin(p * TAU) * .12, hx: -.22 * Math.sin(p * Math.PI),
    }),
  },
  catch: { dur: 2.4, face: 'happy', pose: () => ({ al: .35, ar: .35, alf: 1.25, arf: 1.25, hx: .18 }) },
  highfive: { dur: 1.8, face: 'happy', pose: p => ({ ar: 2.7, arf: .35, hy: .35, hx: -.15, y: p > .45 && p < .6 ? .02 : 0 }) },
  ride: { dur: Infinity, face: 'happy', pose: (p, lt) => ({ al: 2.95, ar: 2.95, rz: Math.sin(lt * 3) * .08, hx: -.2 }) },
  lookCat: { dur: 2.4, face: 'hearts', pose: () => ({ ry: -1.05, hy: -.3, hx: .2 }) },
};
export const EMOTE_NAMES = Object.keys(EMOTES);

function drawFace(ctx, w, h, s) {
  ctx.fillStyle = '#080a14';
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2 - 6, gap = 46;
  const lx = s.lookX * 12, ly = s.lookY * 8;
  ctx.fillStyle = ctx.strokeStyle = '#9fe8ff';
  ctx.shadowColor = '#9fe8ff'; ctx.shadowBlur = 14;
  ctx.lineWidth = 9; ctx.lineCap = 'round';
  const eyes = fn => [-1, 1].forEach(sd => fn(cx + sd * gap + lx, cy + ly, sd));
  const capsule = (x, y, ew, eh) => { ctx.beginPath(); ctx.roundRect(x - ew / 2, y - eh / 2, ew, eh, ew / 2); ctx.fill(); };

  switch (s.face) {
    case 'happy':
      eyes((x, y) => { ctx.beginPath(); ctx.arc(x, y + 8, 15, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); });
      break;
    case 'hearts':
      ctx.fillStyle = ctx.shadowColor = '#ff7eb3';
      eyes((x, y) => {
        const r = 11 * (1 + Math.sin(s.t * 8) * .08);
        ctx.beginPath();
        ctx.moveTo(x, y + r * 1.3);
        ctx.bezierCurveTo(x - r * 2.2, y - r * .2, x - r * .9, y - r * 1.9, x, y - r * .6);
        ctx.bezierCurveTo(x + r * .9, y - r * 1.9, x + r * 2.2, y - r * .2, x, y + r * 1.3);
        ctx.fill();
      });
      break;
    case 'surprised':
      ctx.lineWidth = 7;
      eyes((x, y) => { ctx.beginPath(); ctx.arc(x, y, 17, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill(); });
      break;
    case 'dizzy':
      ctx.lineWidth = 5;
      eyes((x, y, sd) => {
        ctx.beginPath();
        for (let a = 0; a < 12; a += .2) {
          const r = a * 1.6, ang = a * sd + s.t * 6 * sd;
          const px = x + Math.cos(ang) * r, py = y + Math.sin(ang) * r;
          a ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
      });
      break;
    case 'sleepy':
      eyes((x, y) => { ctx.beginPath(); ctx.moveTo(x - 15, y + 4); ctx.quadraticCurveTo(x, y + 12, x + 15, y + 4); ctx.stroke(); });
      break;
    case 'angry':
      ctx.fillStyle = ctx.strokeStyle = ctx.shadowColor = '#ff8a6b';
      eyes((x, y, sd) => {
        capsule(x, y + 4, 22, 20);
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(x - 18 * sd, y - 20); ctx.lineTo(x + 14 * sd, y - 8); ctx.stroke();
      });
      break;
    case 'think':
      eyes((x, y) => capsule(x + 8, y - 10, 20, 26));
      ctx.shadowBlur = 0;
      [0, 1, 2].forEach(i => { if (Math.floor(s.t * 3) % 4 > i) { ctx.beginPath(); ctx.arc(cx + 20 + i * 16, cy + 38, 4, 0, TAU); ctx.fill(); } });
      break;
    case 'confused':
      eyes((x, y, sd) => capsule(x, y, sd < 0 ? 24 : 16, sd < 0 ? 32 : 18));
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) ctx.lineTo(cx - 18 + i * 6, cy + 36 + (i % 2 ? -4 : 4));
      ctx.stroke();
      break;
    default: {
      const bh = Math.max(4, 34 * s.blink);
      eyes((x, y) => capsule(x, y, 22, bh));
    }
  }
  // mouth while talking
  if (s.talk > 0 && s.face !== 'confused' && s.face !== 'think') {
    ctx.shadowBlur = 10;
    ctx.fillStyle = s.face === 'angry' ? '#ff8a6b' : '#9fe8ff';
    const mh = 4 + s.talk * 14;
    ctx.beginPath(); ctx.roundRect(cx - 14, cy + 40 - mh / 2, 28, mh, 6); ctx.fill();
  } else if (s.face === 'happy' || s.face === 'hearts') {
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(cx, cy + 30, 12, Math.PI * .15, Math.PI * .85); ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

export function buildRobot() {
  const group = new THREE.Group();
  const shell = mat(C.shell, .32, .05);
  const dark = mat(C.dark, .4, .3);

  const pad = mesh(new THREE.CylinderGeometry(.1, .11, .018, 40), dark);
  pad.position.y = .009; group.add(pad);
  const ringMat = glow(C.accent);
  const ring = mesh(new THREE.TorusGeometry(.095, .004, 8, 48), ringMat, false);
  ring.rotation.x = Math.PI / 2; ring.position.y = .019; group.add(ring);

  const floatG = new THREE.Group(); group.add(floatG);
  const pivot = new THREE.Group(); pivot.position.y = .2; floatG.add(pivot);   // rotations happen around the body's centre
  const body = new THREE.Group(); body.position.y = -.2; pivot.add(body);

  const torso = rbox(.17, .16, .13, .055, shell); torso.position.y = .14; body.add(torso);
  const belly = rbox(.1, .06, .02, .01, dark); belly.position.set(0, .13, .062); body.add(belly);
  const coreMat = glow(C.accent);
  const core = mesh(new THREE.CircleGeometry(.014, 24), coreMat, false); core.position.set(0, .13, .0725); body.add(core);
  const thrust = mesh(new THREE.ConeGeometry(.035, .06, 20, 1, true), new THREE.MeshBasicMaterial({ color: C.accent, transparent: true, opacity: .35, depthWrite: false, toneMapped: false }), false);
  thrust.rotation.x = Math.PI; thrust.position.y = .035; body.add(thrust);

  const carry = new THREE.Group(); carry.position.set(0, .14, .12); body.add(carry);

  const arms = [-1, 1].map(s => {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * .1, .19, 0);
    const a = mesh(new THREE.CapsuleGeometry(.021, .07, 6, 16), shell); a.position.y = -.05;
    const hand = mesh(new THREE.SphereGeometry(.022, 20, 14), dark); hand.position.y = -.1;
    shoulder.add(a, hand);
    body.add(shoulder);
    return { shoulder, hand, s };
  });

  const head = new THREE.Group(); head.position.y = .31; body.add(head);
  const skull = rbox(.25, .18, .17, .065, shell); head.add(skull);
  const visor = rbox(.21, .12, .03, .04, new THREE.MeshPhysicalMaterial({ color: 0x0a0c16, roughness: .15, metalness: .2, clearcoat: 1, clearcoatRoughness: .05 }));
  visor.position.z = .075; head.add(visor);
  const faceState = { face: 'normal', lookX: 0, lookY: 0, blink: 1, talk: 0, t: 0 };
  const faceTex = canvasTexture(256, 160, (ctx, w, h) => drawFace(ctx, w, h, faceState));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(.19, .1), new THREE.MeshBasicMaterial({ map: faceTex, toneMapped: false }));
  face.position.z = .0915; head.add(face);
  [-1, 1].forEach(s => {
    const ear = mesh(new THREE.CylinderGeometry(.032, .032, .02, 28), dark);
    ear.rotation.z = Math.PI / 2; ear.position.x = s * .13; head.add(ear);
    const dot = mesh(new THREE.CircleGeometry(.013, 20), glow(C.accent2), false);
    dot.position.x = s * .1405; dot.rotation.y = s * Math.PI / 2; head.add(dot);
  });
  const stalk = mesh(new THREE.CylinderGeometry(.004, .004, .06, 8), dark); stalk.position.y = .115; head.add(stalk);
  const bulbMat = glow(C.accent);
  const bulb = mesh(new THREE.SphereGeometry(.015, 16, 12), bulbMat, false); bulb.position.y = .15; head.add(bulb);

  // ---------- emote engine ----------
  const st = { cur: null, queue: [], talking: false, blinkAt: 2, blinkStart: -1, t: 0, lift: 0, look: { x: 0, y: 0 } };
  const pose = { y: 0, rx: 0, ry: 0, rz: 0, hx: 0, hy: 0, hz: 0, al: 0, ar: 0, alf: 0, arf: 0 };
  let faceKey = '';

  function start(name, resolve) {
    const def = EMOTES[name];
    st.cur = { name, def, t0: st.t, resolve, ending: null };
    api.onEmote?.(name);
  }
  function finish() {
    const done = st.cur;
    st.cur = null;
    done?.resolve?.();
    if (st.queue.length) { const [n, r] = st.queue.shift(); start(n, r); }
  }

  const api = {
    group, head, carry, onEmote: null,
    get current() { return st.cur?.name || null; },
    get busy() { return !!st.cur || st.queue.length > 0; },
    set talking(v) { st.talking = v; },
    set lift(v) { st.lift = v; },
    // play an emote; force interrupts whatever is running
    emote(name, { force = false } = {}) {
      if (!EMOTES[name]) return Promise.resolve();
      return new Promise(resolve => {
        if (force && st.cur) { st.queue = []; finish(); }
        if (st.cur) st.queue.push([name, resolve]);
        else start(name, resolve);
      });
    },
    // end an open-ended emote (sleep, ride) with a short blend out
    end(name) {
      if (st.cur && (!name || st.cur.name === name) && !st.cur.ending) st.cur.ending = st.t;
    },
    handWorld(side = 1, out = new THREE.Vector3()) { return arms[side > 0 ? 1 : 0].hand.getWorldPosition(out); },
    topWorld(out = new THREE.Vector3()) { return bulb.getWorldPosition(out); },
    hold(obj) { carry.clear(); if (obj) carry.add(obj); },

    update(t, lookX, lookY) {
      st.t = t;
      faceState.t = t;
      // idle pose
      const idle = {
        y: .015 + Math.sin(t * 2) * .008, rx: 0, ry: Math.sin(t * .7) * .06, rz: 0,
        hx: lookY, hy: lookX, hz: 0,
        al: .12 + Math.sin(t * 1.6) * .05, ar: .12 + Math.sin(t * 1.6) * .05, alf: 0, arf: 0,
      };
      let face = 'normal', target = idle;
      const cur = st.cur;
      if (cur) {
        const lt = t - cur.t0;
        const dur = cur.def.dur;
        const p = Number.isFinite(dur) ? Math.min(1, lt / dur) : 0;
        let w = Math.min(1, lt / .2);
        if (Number.isFinite(dur)) w = Math.min(w, (dur - lt) / .25);
        if (cur.ending != null) w = Math.min(w, 1 - (t - cur.ending) / .35);
        w = Math.max(0, w);
        const e = cur.def.pose(p, lt);
        // full turns end where they started, so wrap them instead of letting the blend unwind them
        for (const k of ['rx', 'ry']) if (k in e) e[k] = Math.atan2(Math.sin(e[k]), Math.cos(e[k]));
        target = {};
        for (const k in idle) target[k] = k in e ? lerp(idle[k], e[k], ease.inOut(w)) : idle[k];
        face = typeof cur.def.face === 'function' ? cur.def.face(p) : cur.def.face;
        if (w < .5 && (lt > .3)) face = 'normal';
        if ((Number.isFinite(dur) && lt >= dur) || (cur.ending != null && t - cur.ending >= .35)) finish();
      }
      // ease toward target (rotations that loop a full turn are applied directly)
      for (const k in pose) {
        const direct = (k === 'ry' || k === 'rx') && cur && Math.abs(target[k]) > 1.6;
        pose[k] = direct ? target[k] : lerp(pose[k], target[k], .2);
      }

      floatG.position.y = pose.y + st.lift;
      pivot.rotation.set(pose.rx, pose.ry, pose.rz);
      head.rotation.set(pose.hx, pose.hy, pose.hz);
      head.position.y = .31 + (st.talking ? Math.abs(Math.sin(t * 12)) * .005 : 0);
      arms[0].shoulder.rotation.set(-pose.alf, 0, -pose.al);
      arms[1].shoulder.rotation.set(-pose.arf, 0, pose.ar);

      ringMat.color.setHex(C.accent).multiplyScalar(.75 + Math.sin(t * 2) * .25);
      thrust.scale.y = 1 + Math.sin(t * 30) * .15 + (pose.y + st.lift) * 6;
      bulbMat.color.setHex(st.talking && Math.sin(t * 16) > 0 ? 0xffffff : C.accent);
      coreMat.color.setHex(face === 'angry' ? 0xff5a5a : face === 'hearts' ? 0xff7eb3 : C.accent);

      // face
      if (t > st.blinkAt) { st.blinkAt = t + 2.5 + Math.random() * 3; st.blinkStart = t; }
      const bt = t - st.blinkStart;
      faceState.blink = bt < .16 ? Math.abs(Math.cos(bt / .16 * Math.PI)) : 1;
      faceState.face = face;
      faceState.lookX = THREE.MathUtils.clamp(lookX * 1.5, -1, 1);
      faceState.lookY = THREE.MathUtils.clamp(-lookY * 2, -1, 1);
      faceState.talk = st.talking ? Math.abs(Math.sin(t * 13)) * (.5 + Math.abs(Math.sin(t * 5.3)) * .5) : 0;
      const animated = face === 'dizzy' || face === 'hearts' || face === 'think' || st.talking;
      const key = `${face}|${faceState.lookX.toFixed(1)}|${faceState.lookY.toFixed(1)}|${faceState.blink.toFixed(1)}|${animated ? Math.floor(t * 20) : ''}`;
      if (key !== faceKey) { faceKey = key; faceTex.redraw(); }
    },
  };
  return api;
}
