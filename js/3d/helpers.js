// Small building blocks shared by every 3D module
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const C = {
  bg: 0x0f1222, accent: 0xff9e64, accent2: 0xb69cff, mint: 0x7ee0c3, eye: 0x9fe8ff,
  shell: 0xeceaf3, dark: 0x1d2030, wood: 0x4a3a30, steel: 0x262a36,
};

const matCache = new Map();
export function mat(color, roughness = .6, metalness = 0, extra = {}) {
  const key = Object.keys(extra).length ? null : `${color}|${roughness}|${metalness}`;
  if (key && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  if (key) matCache.set(key, m);
  return m;
}
export const glow = color => new THREE.MeshBasicMaterial({ color, toneMapped: false });

export function mesh(geo, material, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = m.receiveShadow = shadow;
  return m;
}
export function rbox(w, h, d, r, material, seg = 3) {
  return mesh(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2)), material);
}
export function rod(a, b, r, material) {
  const m = mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 12), material);
  m.position.copy(a).lerp(b, .5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}
export function tube(points, r, material) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return mesh(new THREE.TubeGeometry(curve, 24, r, 8), material);
}

// canvas-backed texture with a draw callback; call .redraw() to repaint
export function canvasTexture(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.redraw = (...args) => { draw(ctx, w, h, ...args); tex.needsUpdate = true; };
  tex.redraw();
  return tex;
}

export const ease = {
  inOut: p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2,
  out: p => 1 - Math.pow(1 - p, 3),
  in: p => p * p * p,
  back: p => 1 + 2.7 * Math.pow(p - 1, 3) + 1.7 * Math.pow(p - 1, 2),
};
export const clamp = THREE.MathUtils.clamp;
export const lerp = THREE.MathUtils.lerp;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const wait = ms => new Promise(r => setTimeout(r, ms));

// speech bubbles: HTML elements pinned to 3D points
export class Bubbles {
  constructor(container, camera, canvas) {
    this.el = container; this.camera = camera; this.canvas = canvas;
    this.list = [];
    this.v = new THREE.Vector3();
  }
  // anchor: Object3D (plus offset) or a function returning a Vector3
  say(anchor, text, { emoji = false, dur = 2200, offset = [0, 0, 0] } = {}) {
    const el = document.createElement('div');
    el.className = `bubble${emoji ? ' emoji' : ''}`;
    el.textContent = text;
    this.el.appendChild(el);
    const b = { el, anchor, offset: new THREE.Vector3(...offset), until: performance.now() + dur, drift: emoji ? 1 : 0, born: performance.now() };
    this.list.push(b);
    return b;
  }
  update() {
    const now = performance.now();
    const w = this.el.clientWidth, h = this.el.clientHeight;
    this.list = this.list.filter(b => {
      if (now > b.until) {
        b.el.classList.add('out');
        setTimeout(() => b.el.remove(), 300);
        return false;
      }
      if (typeof b.anchor === 'function') this.v.copy(b.anchor());
      else b.anchor.getWorldPosition(this.v);
      this.v.add(b.offset);
      if (b.drift) this.v.y += (now - b.born) / 1000 * .06;
      this.v.project(this.camera);
      const x = (this.v.x + 1) / 2 * w, y = (1 - this.v.y) / 2 * h;
      b.el.style.left = `${x}px`;
      b.el.style.top = `${y}px`;
      b.el.style.display = this.v.z > 1 ? 'none' : '';
      return true;
    });
  }
}

// confetti burst using one instanced mesh
export class Confetti {
  constructor(scene, n = 120) {
    this.n = n;
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(.018, .01), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), n);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    const colors = [C.accent, C.accent2, C.mint, 0xffd84a, 0xff6b9a];
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) this.mesh.setColorAt(i, col.setHex(pick(colors)));
    this.p = Array.from({ length: n }, () => ({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3() }));
    this.life = 0;
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(1, 1, 1);
    scene.add(this.mesh);
  }
  burst(at) {
    this.p.forEach(p => {
      p.pos.copy(at);
      p.vel.set(rand(-.6, .6), rand(.8, 1.6), rand(-.6, .6));
      p.rot.set(rand(0, 6), rand(0, 6), rand(0, 6));
      p.spin.set(rand(-9, 9), rand(-9, 9), rand(-9, 9));
    });
    this.life = 2.6;
    this.mesh.visible = true;
  }
  update(dt) {
    if (this.life <= 0) return;
    this.life -= dt;
    this.p.forEach((p, i) => {
      p.vel.y -= 2.2 * dt;
      p.vel.multiplyScalar(1 - 1.6 * dt);
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < .78) { p.pos.y = .78; p.vel.set(0, 0, 0); p.spin.set(0, 0, 0); }
      p.rot.x += p.spin.x * dt; p.rot.y += p.spin.y * dt; p.rot.z += p.spin.z * dt;
      this.m4.compose(p.pos, this.q.setFromEuler(p.rot), this.s);
      this.mesh.setMatrixAt(i, this.m4);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.life <= 0) this.mesh.visible = false;
  }
}
