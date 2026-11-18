// Cars: 8 models, traffic AI, parked (stealable) cars. buildCar returns
// paintMat so screenshot staging can repaint a staged car bright red/gold.
// Doors open on entry and close after a 0.25 s game-time timer.
import * as THREE from 'three';
import { CAR_MODELS, TRAFFIC_COUNT, PARKED_COUNT, ROADS, CITY_HALF } from './config.js';
import { clamp } from './util.js';

function plateTexture(text) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f4e8'; g.fillRect(0, 0, 128, 32);
  g.strokeStyle = '#222'; g.lineWidth = 3; g.strokeRect(1, 1, 126, 30);
  g.fillStyle = '#111'; g.font = 'bold 20px monospace'; g.textAlign = 'center';
  g.fillText(text, 64, 23);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let plateN = 100;
function nextPlate() { plateN += 7; return 'IH-' + (1000 + (plateN % 9000)); }

export function buildCar(model, color) {
  const group = new THREE.Group();
  const paintMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2733, roughness: 0.15, metalness: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
  const L = model.len, W = model.w;
  // body: main slab + tapered nose/tail so it reads as a car, not a box
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, 0.62, L), paintMat);
  body.position.y = 0.55; body.castShadow = true; body.receiveShadow = true;
  group.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, 0.4, L * 0.22), paintMat);
  nose.position.set(0, 0.42, L * 0.42); nose.castShadow = true;
  group.add(nose);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, 0.42, L * 0.18), paintMat);
  tail.position.set(0, 0.44, -L * 0.44); tail.castShadow = true;
  group.add(tail);
  // cabin with glass
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 0.55, L * 0.46), glassMat);
  cabin.position.set(0, 1.1, -L * 0.04); cabin.castShadow = true;
  group.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.08, L * 0.4), paintMat);
  roof.position.set(0, 1.4, -L * 0.04); roof.castShadow = true;
  group.add(roof);
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.95 });
  const hubGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.3, 10);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.3, metalness: 0.8 });
  const wheels = [];
  for (const [wx, wz] of [[-W / 2, L * 0.32], [W / 2, L * 0.32], [-W / 2, -L * 0.32], [W / 2, -L * 0.32]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    w.castShadow = true;
    group.add(w);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(wx, 0.36, wz);
    group.add(hub);
    wheels.push(w);
  }
  // lights (wider, brighter so the rear reads at a glance)
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffe9a0, emissiveIntensity: 1.4 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2020, emissiveIntensity: 1.0 });
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.08), headMat);
    h.position.set(sx * W * 0.32, 0.62, L * 0.5);
    group.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.08), tailMat);
    t.position.set(sx * W * 0.32, 0.62, -L * 0.5);
    group.add(t);
  }
  // rear window (sloped glass) + bumpers so the back reads as a car, not a slab
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, 0.5, 0.06), glassMat);
  rearGlass.position.set(0, 1.05, -L * 0.3);
  rearGlass.rotation.x = -0.35;
  group.add(rearGlass);
  const bumperMat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.6, metalness: 0.3 });
  const bumperR = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.2, 0.16), bumperMat);
  bumperR.position.set(0, 0.3, -L * 0.5 - 0.02);
  group.add(bumperR);
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.2, 0.16), bumperMat);
  bumperF.position.set(0, 0.3, L * 0.5 + 0.02);
  group.add(bumperF);
  // plate
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 0.18),
    new THREE.MeshStandardMaterial({ map: plateTexture(nextPlate()), roughness: 0.6 }),
  );
  plate.position.set(0, 0.42, -L * 0.5 - 0.02);
  plate.rotation.y = Math.PI;
  group.add(plate);
  // doors (open on entry, close after 0.25 s game time)
  const doorGeo = new THREE.BoxGeometry(0.06, 0.55, L * 0.34);
  const doors = [];
  for (const sx of [-1, 1]) {
    const d = new THREE.Mesh(doorGeo, paintMat);
    d.position.set(sx * (W / 2 + 0.02), 0.62, L * 0.05);
    d.castShadow = true;
    group.add(d);
    doors.push(d);
  }
  return { group, name: model.name, paintMat, wheels, doors, doorT: 0, model, speed: 0 };
}

export function openDoors(car) { car.doorT = 0.25; }
export function updateDoors(car, dt) {
  if (car.doorT > 0) {
    car.doorT = Math.max(0, car.doorT - dt);
    const open = car.doorT > 0 ? 0.7 : 0;
    car.doors.forEach((d, i) => { d.rotation.y = (i === 0 ? -1 : 1) * open * 0.9; });
  } else {
    car.doors.forEach((d) => { d.rotation.y = 0; });
  }
}

// ---- traffic: waypoint followers on the road grid ----
export class Traffic {
  constructor(scene, rng, colliders) {
    this.cars = [];
    this.colliders = colliders;
    for (let i = 0; i < TRAFFIC_COUNT; i++) {
      const model = CAR_MODELS[rng.int(0, CAR_MODELS.length - 1)];
      const car = buildCar(model, model.color);
      // start on a random road, facing along it
      const horizontal = rng.chance(0.5);
      const road = ROADS[rng.int(0, ROADS.length - 1)];
      const along = rng.range(-170, 170);
      const x = horizontal ? along : road + rng.range(-2, 2);
      const z = horizontal ? road + rng.range(-2, 2) : along;
      car.group.position.set(x, 0, z);
      car.group.rotation.y = horizontal ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
      car.speed = rng.range(6, 11);
      car.dir = horizontal ? (car.group.rotation.y > 0 ? 1 : -1) : 0;
      car.axis = horizontal ? 'x' : 'z';
      car.sign = horizontal ? (Math.sin(car.group.rotation.y) > 0 ? 1 : -1) : (Math.cos(car.group.rotation.y) > 0 ? 1 : -1);
      car.target = this.nextWaypoint(car, rng);
      scene.add(car.group);
      this.cars.push(car);
    }
  }
  nextWaypoint(car, rng) {
    // pick a nearby intersection, then head for it
    const p = car.group.position;
    const rx = ROADS[Math.floor(rng.next() * ROADS.length)];
    const rz = ROADS[Math.floor(rng.next() * ROADS.length)];
    return { x: rx, z: rz };
  }
  update(dt, rng, playerPos) {
    for (const car of this.cars) {
      const p = car.group.position;
      const t = car.target;
      const dx = t.x - p.x, dz = t.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 4) { car.target = this.nextWaypoint(car, rng); continue; }
      // steer toward the waypoint, snapped to the road grid
      const want = Math.atan2(dx, dz);
      let cur = car.group.rotation.y;
      let diff = want - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cur += clamp(diff, -1.6 * dt, 1.6 * dt);
      car.group.rotation.y = cur;
      // slow for a car ahead
      let sp = car.speed;
      for (const o of this.cars) {
        if (o === car) continue;
        const ox = o.group.position.x - p.x, oz = o.group.position.z - p.z;
        const ahead = ox * Math.sin(cur) + oz * Math.cos(cur);
        const side = Math.abs(ox * Math.cos(cur) - oz * Math.sin(cur));
        if (ahead > 0 && ahead < 9 && side < 2.4) { sp = Math.min(sp, 2.5); break; }
      }
      // slow near the player so it never rams them at full speed
      if (playerPos) {
        const pd = Math.hypot(playerPos.x - p.x, playerPos.z - p.z);
        if (pd < 7) sp = Math.min(sp, 3);
      }
      const step = sp * dt;
      p.x += Math.sin(cur) * step;
      p.z += Math.cos(cur) * step;
      // keep inside the city
      p.x = clamp(p.x, -CITY_HALF + 4, CITY_HALF - 4);
      p.z = clamp(p.z, -CITY_HALF + 4, CITY_HALF - 4);
      car.wheels.forEach((w) => { w.rotation.x += (sp * dt) / 0.36; });
    }
  }
}

// ---- parked (stealable) cars, along road edges ----
export function buildParked(scene, rng) {
  const parked = [];
  const used = new Set();
  let guard = 0;
  while (parked.length < PARKED_COUNT && guard++ < 400) {
    const road = ROADS[rng.int(0, ROADS.length - 1)];
    const horizontal = rng.chance(0.5);
    const along = rng.range(-170, 170);
    const key = `${horizontal ? 'h' : 'v'}${road}:${Math.round(along / 12)}`;
    if (used.has(key)) continue;
    used.add(key);
    const model = CAR_MODELS[rng.int(0, CAR_MODELS.length - 1)];
    const car = buildCar(model, model.color);
    const side = rng.chance(0.5) ? 1 : -1;
    const x = horizontal ? along : road + side * 7.5;
    const z = horizontal ? road + side * 7.5 : along;
    car.group.position.set(x, 0, z);
    car.group.rotation.y = horizontal ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    car.parked = true;
    scene.add(car.group);
    parked.push(car);
  }
  return parked;
}
