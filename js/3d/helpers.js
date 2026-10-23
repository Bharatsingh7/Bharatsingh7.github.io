// Small building blocks shared by every 3D module
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const C = {
  bg: 0x0c1411, accent: 0xff9e64, accent2: 0xb69cff, mint: 0x7ee0c3, eye: 0x9fe8ff,
  shell: 0xeceaf3, dark: 0x1d2030, wood: 0x6b4a33, steel: 0x262a36,
  wall: 0x46624f, wallDark: 0x2c4234, leaf: 0x4f9a5b, leafDark: 0x2f6e43, leafLight: 0x8cc96b, terracotta: 0xc2734f,
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
    // cached size: reading clientWidth every frame right after moving bubbles forces a layout
    this.w = container.clientWidth; this.h = container.clientHeight;
    new ResizeObserver(() => { this.w = container.clientWidth; this.h = container.clientHeight; }).observe(container);
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
    if (!this.list.length) return;
    const now = performance.now();
    const w = this.w, h = this.h;
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

// ---------------------------------------------------------------- shared animated uniforms
// one clock for every shader-driven effect (RGB strips, leaf sway)
export const U = { uTime: { value: 0 }, uMode: { value: 0 }, uLevel: { value: 1 }, uGust: { value: 0 } };
export const RGB_MODES = ['rainbow', 'forest', 'breathe', 'off'];

const RGB_GLSL = /* glsl */`
  uniform float uTime, uMode, uLevel;
  vec3 hsv(vec3 c) { vec3 p = abs(fract(c.xxx + vec3(1., 2. / 3., 1. / 3.)) * 6. - 3.); return c.z * mix(vec3(1.), clamp(p - 1., 0., 1.), c.y); }
  vec3 rgbAt(float u) {
    if (uMode < .5) return hsv(vec3(fract(u - uTime * .12), .78, 1.));
    if (uMode < 1.5) { float k = .5 + .5 * sin(u * 9.4 - uTime * 1.3); return mix(vec3(.12, .8, .38), vec3(.5, 1., .78), k); }
    if (uMode < 2.5) return hsv(vec3(fract(uTime * .03), .7, .3 + .7 * (.5 + .5 * sin(uTime * 1.6))));
    return vec3(.03);
  }`;
// the same colour on the CPU, for lights and instanced keys
const _c = new THREE.Color();
export function rgbAt(u, out = _c) {
  const t = U.uTime.value, m = U.uMode.value;
  if (m === 0) return out.setHSL(((u - t * .12) % 1 + 1) % 1, .85, .6);
  if (m === 1) { const k = .5 + .5 * Math.sin(u * 9.4 - t * 1.3); return out.setRGB(.12 + .38 * k, .8 + .2 * k, .38 + .4 * k); }
  if (m === 2) return out.setHSL((t * .03) % 1, .75, .15 + .45 * (.5 + .5 * Math.sin(t * 1.6)));
  return out.setRGB(.03, .03, .03);
}

// material whose colour follows the current RGB mode; u0..u1 maps the mesh's uv.x onto the colour flow
const RGB_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
export function rgbMaterial({ u0 = 0, u1 = 1, spill = false } = {}) {
  const uniforms = { ...U, uA: { value: u0 }, uB: { value: u1 } };
  if (!spill) return new THREE.ShaderMaterial({
    uniforms, vertexShader: RGB_VERT, toneMapped: false,
    fragmentShader: `${RGB_GLSL} uniform float uA, uB; varying vec2 vUv; void main() { gl_FragColor = vec4(rgbAt(mix(uA, uB, vUv.x)) * (.6 + .9 * uLevel), 1.); }`,
  });
  return new THREE.ShaderMaterial({
    uniforms, vertexShader: RGB_VERT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    fragmentShader: `${RGB_GLSL} uniform float uA, uB; varying vec2 vUv; void main() {
      float a = pow(1. - abs(vUv.y - .5) * 2., 2.2) * smoothstep(0., .06, vUv.x) * smoothstep(1., .94, vUv.x);
      gl_FragColor = vec4(rgbAt(mix(uA, uB, vUv.x)) * a * .55 * uLevel, 1.); }`,
  });
}

// LED strip: a bright core plus a soft additive spill (fake light on the surface behind it)
export function ledStrip(len, { spill = .22, u0 = 0, u1 = 1, thick = .012 } = {}) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(len, thick, thick), rgbMaterial({ u0, u1 })));
  if (spill) {
    const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(len * 1.04, spill), rgbMaterial({ u0, u1, spill: true }));
    glowPlane.position.z = -thick * .6;
    g.add(glowPlane);
  }
  return g;
}

// leaf sway, done in the vertex shader so a whole room of leaves costs nothing on the CPU.
// geometry needs an aTip attribute (0 at the stem, 1 at the tip)
export function addWind(material, strength = 1) {
  material.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uGust = U.uGust;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uGust;\nattribute float aTip;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = vec3(0.);
        #endif
        float ph = ip.x * 3.1 + ip.y * 2.3 + ip.z * 1.7;
        float sw = sin(uTime * 1.6 + ph) * .6 + sin(uTime * 2.7 + ph * 1.3) * .3;
        transformed.z += sw * aTip * aTip * (${(.12 * strength).toFixed(3)} + uGust * .5);
        transformed.x += cos(uTime * 1.9 + ph) * aTip * aTip * uGust * .25;`);
  };
  return material;
}

// soft contact shadow under a prop; cheap, and it grounds things when real shadows are off
let blobTex;
export function blobShadow(w, d, opacity = .35) {
  blobTex ||= (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const ctx = cv.getContext('2d'), g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.55, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(cv);
  })();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = .002;
  m.renderOrder = -1;
  return m;
}

// merge every mesh under root that never moves into one mesh per material, to save draw calls.
// anything flagged userData.live (and its children) is left alone.
export function bake(root) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const buckets = new Map(), victims = [];
  root.traverse(o => {
    if (o.userData.live) return;
    for (let p = o.parent; p && p !== root; p = p.parent) if (p.userData.live) return;
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.material.transparent || o.material.map?.redraw || o.userData.keep) return;
    const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    const keys = Object.keys(geo.attributes).sort().join();
    const k = `${o.material.uuid}|${keys}|${o.castShadow}`;
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!buckets.has(k)) buckets.set(k, { mat: o.material, geos: [], cast: o.castShadow, recv: o.receiveShadow });
    buckets.get(k).geos.push(geo);
    victims.push(o);
  });
  for (const b of buckets.values()) {
    if (b.geos.length < 2) { b.geos.forEach(g => g.dispose()); continue; }
    const merged = mergeGeometries(b.geos);
    b.geos.forEach(g => g.dispose());
    if (!merged) continue;
    const m = new THREE.Mesh(merged, b.mat);
    m.castShadow = b.cast; m.receiveShadow = b.recv;
    root.add(m);
    b.done = true;
  }
  victims.forEach(o => {
    const k = `${o.material.uuid}|${Object.keys(o.geometry.attributes).sort().join()}|${o.castShadow}`;
    if (buckets.get(k)?.done) o.removeFromParent();
  });
  return root;
}
