// The quadcopter that follows the mouse across the whole page, on its own transparent canvas
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { C, mat, mesh, rbox } from './helpers.js';

export function initCursorDrone(canvas, pointer, makeRenderer) {
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

  const drone = new THREE.Group();
  const tilt = new THREE.Group();
  drone.add(tilt);
  const white = mat(0xf0eef5, .3, .05), dark = mat(C.dark, .35, .4);
  tilt.add(rbox(.26, .07, .34, .03, white));
  const canopy = rbox(.16, .04, .2, .02, new THREE.MeshPhysicalMaterial({ color: 0x0b0e18, roughness: .1, clearcoat: 1 }));
  canopy.position.set(0, .045, -.01); tilt.add(canopy);
  const gimbal = mesh(new THREE.SphereGeometry(.04, 20, 14), dark); gimbal.position.set(0, -.05, .14); tilt.add(gimbal);
  const lens = mesh(new THREE.CircleGeometry(.018, 20), new THREE.MeshBasicMaterial({ color: C.accent2 }), false);
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
    rotor.add(mesh(new THREE.BoxGeometry(.26, .004, .025), mat(0x2a2e3e, .4)));
    const disc = mesh(new THREE.CircleGeometry(.13, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .06, depthWrite: false }), false);
    disc.rotation.x = -Math.PI / 2; rotor.add(disc);
    tilt.add(rotor);
    rotors.push(rotor);
    const light = mesh(new THREE.SphereGeometry(.012, 10, 8), new THREE.MeshBasicMaterial({ color: z < 0 ? 0xff6b6b : C.mint }), false);
    light.position.set(x * .23, -.01, z * .2 + z * .03); tilt.add(light);
  }
  scene.add(drone);

  // the canvas is only S×S pixels and is moved with a CSS transform: far cheaper than a full-screen WebGL layer
  const S = 180;
  renderer.setSize(S, S, false);
  canvas.style.width = canvas.style.height = `${S}px`;
  camera.position.set(0, 0, 2.2);
  camera.aspect = 1;
  camera.updateProjectionMatrix();

  // spring physics in screen pixels; K turns pixel speed into the old world-unit speed for the tilt
  const K = .006;
  const pos = { x: innerWidth * .7, y: innerHeight * .3 }, vel = { x: 0, y: 0 };
  let scale = 0, last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    if (document.hidden) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const t = now / 1000;
    scale += ((pointer.inside ? 1 : 0) - scale) * .08;
    if (scale < .01) { canvas.style.visibility = 'hidden'; return; }
    canvas.style.visibility = '';

    const tx = pointer.px + 70, ty = pointer.py - 60, damp = Math.pow(.04, dt);
    vel.x = (vel.x + (tx - pos.x) * 9 * dt) * damp;
    vel.y = (vel.y + (ty - pos.y) * 9 * dt) * damp;
    pos.x += vel.x * dt; pos.y += vel.y * dt;
    const bob = Math.sin(t * 2.4) * 5;
    canvas.style.transform = `translate3d(${pos.x - S / 2}px, ${pos.y - S / 2 + bob}px, 0)`;

    // bank into motion, seen slightly from above
    const vx = vel.x * K, vy = -vel.y * K;
    tilt.rotation.x = .55 + THREE.MathUtils.clamp(-vy * .12, -.4, .4);
    tilt.rotation.z = THREE.MathUtils.clamp(-vx * .12, -.55, .55);
    tilt.rotation.y += (THREE.MathUtils.clamp(vx * .08, -.5, .5) - tilt.rotation.y) * .1;
    rotors.forEach((r, i) => { r.rotation.y += (i % 2 ? -1 : 1) * .9; });
    drone.scale.setScalar(.8 * scale);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);
}
