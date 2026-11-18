// Wanted 0-5, police cars (chase + ram) and foot cops (arrest -> BUSTED).
// Wanted decays one star after 8 s unseen. A police car with hold=true
// stays put for screenshot roadblocks (its light bar still flashes).
import * as THREE from 'three';
import { WANTED_MAX, SIGHT_CAR, SIGHT_FOOT, DECAY_TIME, ARREST_DIST, ARREST_TIME, CITY_HALF } from './config.js';
import { buildCar, openDoors } from './vehicles.js';
import { buildHumanoid, animateWalk } from './people.js';
import { clamp, dist2 } from './util.js';

function policeCarModel() {
  return { name: 'Interceptor', color: 0x111418, top: 0.6, len: 4.7, w: 1.95 };
}

export class Wanted {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.wanted = 0;
    this.lastSeenT = 0;
    this.policeCars = [];
    this.footCops = [];
    this.sirenT = 0;
    this.onBusted = null;   // callback()
    this.onWasted = null;
  }
  get count() { return this.policeCars.length + this.footCops.length; }

  set(n) {
    this.wanted = clamp(Math.round(n), 0, WANTED_MAX);
    this.lastSeenT = 0;
    this.syncSpawns();
  }
  clearAll() {
    for (const c of this.policeCars) this.scene.remove(c.group);
    for (const c of this.footCops) this.scene.remove(c.h.group);
    this.policeCars = []; this.footCops = [];
  }
  syncSpawns() {
    // desired police cars: 1 per star (cap 3), foot cops: 1 per star above 1
    const wantCars = this.wanted === 0 ? 0 : Math.min(3, this.wanted);
    const wantFoot = this.wanted <= 1 ? 0 : Math.min(2, this.wanted - 1);
    while (this.policeCars.length > wantCars) {
      const c = this.policeCars.pop(); this.scene.remove(c.group);
    }
    while (this.footCops.length > wantFoot) {
      const c = this.footCops.pop(); this.scene.remove(c.h.group);
    }
    // spawn new ones near the player (set by update; here just create them)
    while (this.policeCars.length < wantCars) this.policeCars.push(this.makePoliceCar());
    while (this.footCops.length < wantFoot) this.footCops.push(this.makeFootCop());
  }
  makePoliceCar(at) {
    const car = buildCar(policeCarModel(), 0x111418);
    // black-and-white livery: white doors
    car.paintMat.color.setHex(0x1a1d22);
    const p = at || { x: 0, z: 0 };
    car.group.position.set(p.x, 0, p.z);
    car.speed = 0; car.stuckT = 0; car.hold = false;
    // light bar (red/blue, flashes)
    const barMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2020, emissiveIntensity: 2 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.3), barMat);
    bar.position.set(0, 1.48, -0.1);
    car.group.add(bar);
    car.lightBar = bar; car.lightMat = barMat;
    // white door stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 2.4), new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.5 }));
    stripe.position.set(-0.99, 0.62, 0); car.group.add(stripe);
    const stripe2 = stripe.clone(); stripe2.position.x = 0.99; car.group.add(stripe2);
    this.scene.add(car.group);
    return car;
  }
  makeFootCop(at) {
    const h = buildHumanoid({ skin: 0xd9a066, shirt: 0x1a2a4a, pants: 0x1a2a4a, hair: 0x1a1a1a });
    const p = at || { x: 0, z: 0 };
    h.group.position.set(p.x, 0, p.z);
    this.scene.add(h.group);
    return { h, group: h.group, arrestT: 0, phase: 0, speed: 4.2 };
  }
  spawnFootCop(at) {
    const c = this.makeFootCop(at);
    // An explicitly placed cop stays where the caller put it — placeNear
    // must not teleport it away on the next frame (that breaks a scripted
    // arrest, where the cop is spawned beside the player).
    c.placed = true;
    this.footCops.push(c);
    return c;
  }
  // place police near the player when they (re)spawn
  placeNear(playerPos) {
    for (const c of this.policeCars) {
      if (c.placed) continue;
      const a = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(35, 55);
      c.group.position.set(
        clamp(playerPos.x + Math.sin(a) * r, -CITY_HALF + 6, CITY_HALF - 6),
        0,
        clamp(playerPos.z + Math.cos(a) * r, -CITY_HALF + 6, CITY_HALF - 6),
      );
      c.placed = true;
    }
    for (const c of this.footCops) {
      if (c.placed) continue;
      const a = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(12, 22);
      c.group.position.set(playerPos.x + Math.sin(a) * r, 0, playerPos.z + Math.cos(a) * r);
      c.placed = true;
    }
  }

  update(dt, player, driving, playerCar, colliders, treeCircles, audio) {
    const pp = player.pos;
    this.placeNear(pp);
    // ---- sight: can any police see the player? ----
    let seen = false;
    for (const c of this.policeCars) {
      const d2 = dist2(c.group.position.x, c.group.position.z, pp.x, pp.z);
      if (d2 < SIGHT_CAR * SIGHT_CAR) { seen = true; break; }
    }
    if (!seen) for (const c of this.footCops) {
      const d2 = dist2(c.group.position.x, c.group.position.z, pp.x, pp.z);
      if (d2 < SIGHT_FOOT * SIGHT_FOOT) { seen = true; break; }
    }
    if (seen) this.lastSeenT = 0;
    else {
      this.lastSeenT += dt;
      if (this.lastSeenT >= DECAY_TIME && this.wanted > 0) {
        this.wanted -= 1;
        this.lastSeenT = 0;
        this.syncSpawns();
      }
    }
    // ---- police cars chase / ram ----
    this.sirenT += dt;
    for (const c of this.policeCars) {
      // light bar flashes either way, even when held for a roadblock
      const phase = Math.floor(this.sirenT * 4) % 2 === 0;
      c.lightMat.emissive.setHex(phase ? 0xff2020 : 0x2040ff);
      if (c.hold) { c.speed = 0; continue; }
      const p = c.group.position;
      const dx = pp.x - p.x, dz = pp.z - p.z;
      const d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let cur = c.group.rotation.y;
      let diff = want - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cur += clamp(diff, -2.2 * dt, 2.2 * dt);
      c.group.rotation.y = cur;
      const target = d > 60 ? 16 : d > 25 ? 13 : 9;
      c.speed = clamp(c.speed + (target - c.speed) * dt * 0.8, 0, 17);
      const step = c.speed * dt;
      const nx = p.x + Math.sin(cur) * step, nz = p.z + Math.cos(cur) * step;
      // ram the player (or their car): push + damage on contact.
      // The shove is a gentle nudge, not a launch — a foot cop must be able
      // to stay within arrest range while police cars are ramming.
      const pd = Math.hypot(pp.x - nx, pp.z - nz);
      if (pd < 2.6) {
        if (driving && playerCar) {
          playerCar.group.position.x += Math.sin(cur) * 1.2;
          playerCar.group.position.z += Math.cos(cur) * 1.2;
        } else {
          player.health -= 6 * dt;
          player.pos.x += Math.sin(cur) * 3 * dt;
          player.pos.z += Math.cos(cur) * 3 * dt;
        }
        if (audio) audio.crash();
        c.speed *= 0.5;
      }
      p.x = clamp(nx, -CITY_HALF + 4, CITY_HALF - 4);
      p.z = clamp(nz, -CITY_HALF + 4, CITY_HALF - 4);
      c.wheels.forEach((w) => { w.rotation.x += (c.speed * dt) / 0.36; });
      // stuck detection: if barely moving while chasing, nudge
      if (c.speed < 1 && d > 8) { c.stuckT += dt; if (c.stuckT > 2) { c.group.rotation.y += Math.PI / 2; c.stuckT = 0; } }
      else c.stuckT = 0;
    }
    // ---- foot cops chase + arrest ----
    for (const c of this.footCops) {
      const p = c.group.position;
      const dx = pp.x - p.x, dz = pp.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < ARREST_DIST && !driving) {
        c.arrestT += dt;
        // latch: once a cop is on the player, it stays glued to them so a
        // police-car ram shove cannot break the arrest.
        const la = Math.atan2(p.x - pp.x, p.z - pp.z);
        p.x = pp.x + Math.sin(la) * 1.2;
        p.z = pp.z + Math.cos(la) * 1.2;
        if (c.arrestT >= ARREST_TIME && this.onBusted) { this.onBusted(); return; }
      } else c.arrestT = 0;
      if (d > 0.5) {
        const want = Math.atan2(dx, dz);
        let diff = want - c.group.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        c.group.rotation.y += clamp(diff, -3 * dt, 3 * dt);
        const sp = Math.min(c.speed, d > 12 ? c.speed : c.speed * 0.7);
        p.x += Math.sin(c.group.rotation.y) * sp * dt;
        p.z += Math.cos(c.group.rotation.y) * sp * dt;
        c.phase += dt * sp * 2.2;
        animateWalk(c.h, c.phase, sp);
      }
    }
  }
}
