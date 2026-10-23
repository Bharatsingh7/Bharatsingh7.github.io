// Every plant in the room. Leaves from all plants share two InstancedMeshes (heart-shaped and blade-shaped)
// and sway in the vertex shader, so a room full of greenery is only a handful of draw calls.
import * as THREE from 'three';
import { C, mat, mesh, addWind, rod } from './helpers.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const UP = new THREE.Vector3(0, 1, 0);

// small seeded random so the room looks the same on every visit
function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function leafGeometry(kind) {
  const s = new THREE.Shape();
  if (kind === 'heart') {
    s.moveTo(0, 0);
    s.bezierCurveTo(-.55, .02, -.6, .62, 0, 1);
    s.bezierCurveTo(.6, .62, .55, .02, 0, 0);
  } else {
    s.moveTo(-.07, 0);
    s.quadraticCurveTo(-.08, .62, 0, 1);
    s.quadraticCurveTo(.08, .62, .07, 0);
    s.lineTo(-.07, 0);
  }
  const g = new THREE.ShapeGeometry(s, kind === 'heart' ? 5 : 4);
  const p = g.attributes.position, tip = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    // fold along the midrib and curl the tip back a little
    p.setZ(i, -Math.abs(x) * .35 + y * y * .18);
    tip[i] = y;
  }
  g.setAttribute('aTip', new THREE.BufferAttribute(tip, 1));
  g.computeVertexNormals();
  return g;
}

export class Foliage {
  constructor(density = 1, seed = 7) {
    this.density = density;
    this.r = rng(seed);
    this.items = { heart: [], blade: [] };
    this.stems = [];
    this.statics = new THREE.Group();
    this.meshes = [];
    this.q = new THREE.Quaternion(); this.q2 = new THREE.Quaternion();
  }
  // a leaf whose tip points along dir; roll spins it around that axis
  leaf(kind, pos, dir, size, color, { roll = this.r() * 6.28, keep = false, sx = 1 } = {}) {
    if (!keep && this.r() > this.density) return;
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
    q.multiply(this.q2.setFromAxisAngle(UP, roll));
    this.items[kind].push({ pos: pos.clone(), q, s: new THREE.Vector3(size * sx, size, size), color });
  }
  stem(points, r = .006) {
    const curve = new THREE.CatmullRomCurve3(points);
    this.stems.push(new THREE.TubeGeometry(curve, Math.max(4, points.length * 3), r, 5));
    return curve;
  }
  build(scene) {
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    for (const kind of ['heart', 'blade']) {
      const list = this.items[kind];
      if (!list.length) continue;
      const material = addWind(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .55, side: THREE.DoubleSide }), kind === 'heart' ? 1 : .5);
      const im = new THREE.InstancedMesh(leafGeometry(kind), material, list.length);
      list.forEach((l, i) => {
        im.setMatrixAt(i, m4.compose(l.pos, l.q, l.s));
        // a little colour jitter so no two leaves match
        im.setColorAt(i, col.setHex(l.color).offsetHSL((this.r() - .5) * .03, 0, (this.r() - .5) * .08));
      });
      im.castShadow = true; im.receiveShadow = true;
      im.computeBoundingSphere();
      scene.add(im);
      this.meshes.push(im);
    }
    if (this.stems.length) {
      const stems = mesh(mergeGeometries(this.stems), mat(0x3f6b35, .7));
      stems.castShadow = false;
      scene.add(stems);
    }
    scene.add(this.statics);
  }

  // ------------------------------------------------------------ plant builders (world coordinates)
  pot(pos, { r = .08, h = .14, color = C.terracotta, square = false, rim = true } = {}) {
    const g = square ? new THREE.BoxGeometry(r * 1.8, h, r * 1.8) : new THREE.CylinderGeometry(r, r * .78, h, 20);
    const p = mesh(g, mat(color, .75)); p.position.set(pos.x, pos.y + h / 2, pos.z); this.statics.add(p);
    if (rim && !square) { const rm = mesh(new THREE.CylinderGeometry(r * 1.06, r * 1.06, h * .18, 20), mat(color, .7)); rm.position.set(pos.x, pos.y + h * .92, pos.z); this.statics.add(rm); }
    const soil = mesh(square ? new THREE.PlaneGeometry(r * 1.7, r * 1.7) : new THREE.CircleGeometry(r * .95, 16), mat(0x2b1d17, 1), false);
    soil.rotation.x = -Math.PI / 2; soil.position.set(pos.x, pos.y + h * .94, pos.z); this.statics.add(soil);
    return new THREE.Vector3(pos.x, pos.y + h * .94, pos.z);
  }

  // leaves strung along a curve, alternating sides, pointing outward and down
  vine(points, { size = .055, every = .045, color = C.leaf, light = .5, out = null } = {}) {
    const curve = this.stem(points, .004);
    const len = curve.getLength(), n = Math.floor(len / every);
    for (let i = 1; i <= n; i++) {
      const u = i / n, p = curve.getPointAt(u), t = curve.getTangentAt(u);
      const side = new THREE.Vector3().crossVectors(t, UP).normalize();
      if (side.lengthSq() < .01) side.set(1, 0, 0);
      side.multiplyScalar(i % 2 ? 1 : -1);
      const dir = side.add(new THREE.Vector3(0, -.35, 0)).add(out || new THREE.Vector3(0, 0, .6)).normalize();
      const c = this.r() < light ? C.leafLight : C.leaf;
      this.leaf('heart', p, dir, size * (.75 + this.r() * .5) * (1 - u * .35), i % 5 === 0 ? C.leafDark : (color === C.leaf ? c : color));
    }
    return curve;
  }

  hanging(hook, { drop = .45, vines = 5, length = .9 } = {}) {
    const potPos = hook.clone().add(new THREE.Vector3(0, -drop, 0));
    const r = .1;
    const bowl = mesh(new THREE.LatheGeometry([[0, 0], [.06, .005], [.095, .04], [.105, .1], [.1, .11]].map(([x, y]) => new THREE.Vector2(x, y)), 20), mat(0xe9e2d4, .6));
    bowl.position.copy(potPos); this.statics.add(bowl);
    const soil = mesh(new THREE.CircleGeometry(.098, 16), mat(0x2b1d17, 1), false); soil.rotation.x = -Math.PI / 2; soil.position.copy(potPos).add(new THREE.Vector3(0, .1, 0)); this.statics.add(soil);
    const rope = mat(0xcbb48c, .9);
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2;
      this.statics.add(rod(potPos.clone().add(new THREE.Vector3(Math.cos(a) * r, .1, Math.sin(a) * r)), hook, .003, rope));
    }
    const top = potPos.clone().add(new THREE.Vector3(0, .1, 0));
    // a crown of leaves spilling over the rim
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2 + this.r();
      const dir = new THREE.Vector3(Math.cos(a), .9 + this.r() * .5, Math.sin(a));
      this.leaf('heart', top.clone().add(new THREE.Vector3(Math.cos(a) * .05, 0, Math.sin(a) * .05)), dir, .07 + this.r() * .02, this.r() < .5 ? C.leaf : C.leafLight);
    }
    for (let v = 0; v < vines; v++) {
      const a = v / vines * Math.PI * 2 + this.r() * .6;
      const dx = Math.cos(a), dz = Math.sin(a);
      const L = length * (.55 + this.r() * .6);
      const pts = [top.clone().add(new THREE.Vector3(dx * .09, 0, dz * .09))];
      for (let k = 1; k <= 5; k++) {
        const u = k / 5;
        pts.push(top.clone().add(new THREE.Vector3(dx * (.12 + u * .08) + Math.sin(u * 5 + v) * .03, -u * L, dz * (.12 + u * .08) + Math.cos(u * 4 + v) * .03)));
      }
      this.vine(pts, { out: new THREE.Vector3(dx, 0, dz).multiplyScalar(.8).add(new THREE.Vector3(0, 0, .4)) });
    }
    return potPos;
  }

  monstera(pos) {
    const top = this.pot(pos, { r: .16, h: .34, color: 0xd9d2c3 });
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2 + this.r() * .5, lean = .35 + this.r() * .5, h = .35 + this.r() * .45;
      const end = top.clone().add(new THREE.Vector3(Math.cos(a) * lean * .6, h, Math.sin(a) * lean * .6));
      const mid = top.clone().lerp(end, .5).add(new THREE.Vector3(0, .08, 0));
      this.stem([top.clone().add(new THREE.Vector3(Math.cos(a) * .03, 0, Math.sin(a) * .03)), mid, end], .007);
      const dir = new THREE.Vector3(Math.cos(a), -.25 + this.r() * .4, Math.sin(a));
      this.leaf('heart', end, dir, .3 + this.r() * .12, i % 3 ? C.leafDark : C.leaf, { keep: true, roll: Math.PI / 2 + (this.r() - .5) * .6 });
    }
  }

  snake(pos) {
    const top = this.pot(pos, { r: .1, h: .22, color: 0x2c2f38, square: true });
    for (let i = 0; i < 14; i++) {
      const a = this.r() * Math.PI * 2, d = this.r() * .07;
      const dir = new THREE.Vector3(Math.cos(a) * .18, 1, Math.sin(a) * .18);
      this.leaf('blade', top.clone().add(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d)), dir, .45 + this.r() * .35, i % 3 ? 0x3d7a46 : 0x6e9b4a, { keep: true, sx: 1.6 });
    }
  }

  succulent(pos, size = 1, color = 0x7fb58a) {
    const top = this.pot(pos, { r: .035 * size, h: .05 * size, color: [C.terracotta, 0xe9e2d4, 0x6c7bd9][Math.floor(this.r() * 3)] });
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4, up = .5 + (i / 12) * 1.4;
      this.leaf('blade', top, new THREE.Vector3(Math.cos(a), up, Math.sin(a)), .06 * size * (1.1 - i / 24), color, { keep: true, sx: 3.2 });
    }
  }

  bush(pos, { size = 1, count = 16 } = {}) {
    const top = this.pot(pos, { r: .08 * size, h: .14 * size });
    for (let i = 0; i < count; i++) {
      const a = i * 2.4, lift = .25 + (i % 4) * .08;
      const end = top.clone().add(new THREE.Vector3(Math.cos(a) * .06 * size, lift * size * .5, Math.sin(a) * .06 * size));
      this.leaf('heart', end, new THREE.Vector3(Math.cos(a) * .7, 1, Math.sin(a) * .7), .085 * size, i % 3 ? C.leaf : C.leafLight, { keep: true });
    }
  }

  seedlings(pos, cols = 6, rows = 2) {
    const tray = mesh(new THREE.BoxGeometry(cols * .05 + .02, .035, rows * .05 + .02), mat(0x2c2f38, .8)); tray.position.set(pos.x, pos.y + .0175, pos.z); this.statics.add(tray);
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const p = new THREE.Vector3(pos.x + (c - (cols - 1) / 2) * .05, pos.y + .045, pos.z + (r - (rows - 1) / 2) * .05);
      const h = .02 + this.r() * .03;
      this.stem([p, p.clone().add(new THREE.Vector3(0, h, 0))], .0018);
      [-1, 1].forEach(s => this.leaf('heart', p.clone().add(new THREE.Vector3(0, h, 0)), new THREE.Vector3(s, .5, .2), .025, C.leafLight, { keep: true, roll: 0 }));
    }
  }
}
