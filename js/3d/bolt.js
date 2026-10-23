// Bolt: a little desk drone that sleeps on a charging pad and runs errands for ARIA.
// Movement is a spring toward a target; the async helpers make choreography read top to bottom.
import * as THREE from 'three';
import { C, mat, glow, mesh, rbox, bake, ease } from './helpers.js';

export function buildBolt(scene, padPos, scale = 1) {
  // charging pad
  const pad = new THREE.Group();
  pad.position.copy(padPos);
  const padBase = rbox(.17, .012, .17, .02, mat(C.dark, .4, .3)); padBase.position.y = .006; pad.add(padBase);
  const padRingMat = glow(C.mint);
  const padRing = mesh(new THREE.RingGeometry(.055, .062, 40), padRingMat, false);
  padRing.rotation.x = -Math.PI / 2; padRing.position.y = .0125; pad.add(padRing);
  const hMat = glow(C.mint);
  [[-.012, 0, .004, .04], [.012, 0, .004, .04], [0, 0, .024, .004]].forEach(([x, z, w, d]) => {
    const bar = mesh(new THREE.PlaneGeometry(w, d), hMat, false);
    bar.rotation.x = -Math.PI / 2; bar.position.set(x, .013, z); pad.add(bar);
  });
  scene.add(pad);

  // the drone
  const group = new THREE.Group();
  const tilt = new THREE.Group(); group.add(tilt);
  const white = mat(0xf0eef5, .3, .05), dark = mat(C.dark, .35, .4);
  const body = rbox(.08, .026, .11, .012, white); tilt.add(body);
  const canopy = rbox(.05, .014, .06, .007, new THREE.MeshPhysicalMaterial({ color: 0x0b0e18, roughness: .1, clearcoat: 1 }));
  canopy.position.set(0, .017, -.005); tilt.add(canopy);
  const eye = mesh(new THREE.SphereGeometry(.009, 14, 10), glow(C.accent), false);
  eye.position.set(0, -.004, .056); tilt.add(eye);
  const rotors = [];
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const arm = rbox(.012, .008, .08, .004, white);
    arm.position.set(x * .045, 0, z * .04); arm.rotation.y = Math.atan2(x, z); tilt.add(arm);
    const motor = mesh(new THREE.CylinderGeometry(.01, .01, .014, 14), dark);
    motor.position.set(x * .075, .006, z * .066); tilt.add(motor);
    const rotor = new THREE.Group(); rotor.position.set(x * .075, .015, z * .066);
    rotor.add(mesh(new THREE.BoxGeometry(.085, .002, .009), mat(0x2a2e3e, .4)));
    const disc = mesh(new THREE.CircleGeometry(.043, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }), false);
    disc.rotation.x = -Math.PI / 2; rotor.add(disc);
    rotor.userData.live = true; tilt.add(rotor); rotors.push({ rotor, disc });
    const led = mesh(new THREE.SphereGeometry(.004, 8, 6), glow(z < 0 ? 0xff6b6b : C.mint), false);
    led.position.set(x * .075, -.006, z * .066); tilt.add(led);
  }
  // scanning light cone, hidden until needed
  const cone = mesh(new THREE.ConeGeometry(.09, .3, 32, 1, true), new THREE.MeshBasicMaterial({
    color: C.mint, transparent: true, opacity: .14, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
  }), false);
  cone.position.y = -.16; cone.visible = false; tilt.add(cone);
  bake(tilt);
  const slot = new THREE.Group(); slot.position.y = -.03; group.add(slot);
  scene.add(group);
  group.scale.setScalar(scale);
  pad.scale.setScalar(scale);

  const dockPos = padPos.clone().add(new THREE.Vector3(0, .026 * scale, 0));
  const pos = dockPos.clone(), vel = new THREE.Vector3(), target = dockPos.clone();
  // all timing runs on scene time (st.t), so slow frame rates slow Bolt down instead of making it skip moves
  const st = { flying: false, spin: 0, roll: -1, follow: null, t: 0, yaw: 0, arrive: null, pathEnd: null };
  const tmp = new THREE.Vector3();

  const api = {
    group, pad,
    get flying() { return st.flying; },
    get position() { return pos; },

    goTo(v, { tol = .02, timeout = 4 } = {}) {
      st.follow = null;
      target.copy(v);
      st.arrive?.resolve();
      return new Promise(resolve => { st.arrive = { resolve, tol, until: st.t + timeout }; });
    },
    // follow a moving point fn(u) for dur ms of scene time, u from 0 to 1
    path(fn, dur) {
      const t0 = st.t;
      st.follow = () => fn(Math.min(1, (st.t - t0) / (dur / 1000)));
      st.pathEnd?.resolve();
      return new Promise(resolve => { st.pathEnd = { resolve, at: t0 + dur / 1000 }; });
    },
    async takeoff(height = .22) {
      if (st.flying) return;
      st.flying = true;
      await api.goTo(tmp.copy(dockPos).add(new THREE.Vector3(0, height, 0)));
    },
    async land() {
      await api.goTo(tmp.copy(dockPos).add(new THREE.Vector3(0, .12, 0)));
      await api.goTo(dockPos, { tol: .01 });
      st.flying = false;
    },
    scan(on) { cone.visible = on; },
    carry(obj) { slot.clear(); if (obj) slot.add(obj); },
    roll() { st.roll = 0; },

    update(dt, t) {
      st.t = t;
      if (st.follow) target.copy(st.follow());
      if (st.pathEnd && t >= st.pathEnd.at) { st.follow = null; const p = st.pathEnd; st.pathEnd = null; p.resolve(); }
      if (st.flying) {
        const k = 26, c = 9;
        tmp.copy(target).sub(pos).multiplyScalar(k).addScaledVector(vel, -c);
        vel.addScaledVector(tmp, dt);
        pos.addScaledVector(vel, dt);
        st.spin = Math.min(1, st.spin + dt * 3);
      } else {
        vel.set(0, 0, 0);
        pos.lerp(dockPos, .2);
        st.spin = Math.max(0, st.spin - dt * .8);
      }
      const hover = st.flying ? Math.sin(t * 5) * .004 : 0;
      group.position.set(pos.x, pos.y + hover, pos.z);
      // bank into motion, turn to face where it's going
      tilt.rotation.x = THREE.MathUtils.clamp(vel.z * 1.2, -.5, .5);
      tilt.rotation.z = THREE.MathUtils.clamp(-vel.x * 1.2, -.5, .5);
      if (vel.lengthSq() > .01) st.yaw += (Math.atan2(vel.x, vel.z) - st.yaw) * .05;
      group.rotation.y = st.yaw * .5;
      if (st.roll >= 0) {
        st.roll += dt / .7;
        tilt.rotation.z += ease.inOut(Math.min(1, st.roll)) * Math.PI * 2;
        if (st.roll >= 1) st.roll = -1;
      }
      rotors.forEach(({ rotor, disc }, i) => {
        rotor.rotation.y += (i % 2 ? -1 : 1) * st.spin * 1.1;
        disc.material.opacity = st.spin * .08;
      });
      const a = st.arrive;
      if (a && ((pos.distanceTo(target) < a.tol && vel.length() < .15) || t > a.until)) { st.arrive = null; a.resolve(); }
      padRingMat.color.setHex(C.mint).multiplyScalar(st.flying ? .35 : .7 + Math.sin(t * 2.5) * .3);
    },
  };
  return api;
}

// small props Bolt can deliver
export function makePaper() {
  const g = new THREE.Group();
  const sheet = mesh(new THREE.BoxGeometry(.07, .001, .095), mat(0xf7f5ef, .9));
  g.add(sheet);
  for (let i = 0; i < 6; i++) {
    const line = mesh(new THREE.PlaneGeometry(i === 0 ? .03 : .05, .003), new THREE.MeshBasicMaterial({ color: i === 0 ? C.accent : 0x9a9db8 }), false);
    line.rotation.x = -Math.PI / 2; line.position.set(i === 0 ? -.01 : 0, .0006, -.035 + i * .013); g.add(line);
  }
  g.position.y = -.012;
  return g;
}
export function makeEnvelope() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(.08, .004, .055), mat(0xf2e6d0, .85)));
  const flap = mesh(new THREE.ConeGeometry(.04, .025, 3), mat(0xe6d6b8, .85));
  flap.rotation.set(Math.PI / 2, 0, Math.PI); flap.scale.set(1, 1, .1); flap.position.set(0, .003, -.01); g.add(flap);
  const seal = mesh(new THREE.CylinderGeometry(.008, .008, .003, 16), mat(0xd9534f, .5)); seal.position.set(0, .005, 0); g.add(seal);
  g.position.y = -.012;
  return g;
}
