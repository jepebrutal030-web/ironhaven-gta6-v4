// People: the player (Dario, a smooth humanoid with articulated limbs and
// a walk cycle) plus pedestrians and mission hostiles. No capsules, no
// 8-bit blocks — head, torso, arms and legs, all animated.
import * as THREE from 'three';
import { PED_COUNT, PLAYER } from './config.js';
import { clamp } from './util.js';

const SKIN = [0xd9a066, 0x8a5a3b, 0x5a3a28, 0xe8b98a];
const SHIRTS = [0x2e5fa3, 0x7a2e2e, 0x2e7a4a, 0x6a5acd, 0xc96a1e, 0x3a3a3a, 0x8a2e6a, 0x2e8a8a];
const PANTS = [0x2b3a4a, 0x3a2b2b, 0x243024, 0x4a4a4a];

export function buildHumanoid({ skin = 0xd9a066, shirt = 0xc0392b, pants = 0x2b3a4a, hair = 0x1a1a1a, scale = 1 } = {}) {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.95 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.6 });
  // legs (pivot at hip so they swing)
  const legGeo = new THREE.BoxGeometry(0.16, 0.78, 0.18);
  legGeo.translate(0, -0.39, 0);
  const legL = new THREE.Mesh(legGeo, pantsMat); legL.position.set(-0.11, 0.82, 0);
  const legR = new THREE.Mesh(legGeo, pantsMat); legR.position.set(0.11, 0.82, 0);
  // shoes
  const shoeGeo = new THREE.BoxGeometry(0.17, 0.1, 0.32);
  const shoeL = new THREE.Mesh(shoeGeo, shoeMat); shoeL.position.set(0, -0.78, 0.05); legL.add(shoeL);
  const shoeR = new THREE.Mesh(shoeGeo, shoeMat); shoeR.position.set(0, -0.78, 0.05); legR.add(shoeR);
  // torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.26), shirtMat);
  torso.position.y = 1.14;
  // arms (pivot at shoulder)
  const armGeo = new THREE.BoxGeometry(0.13, 0.62, 0.15);
  armGeo.translate(0, -0.31, 0);
  const armL = new THREE.Mesh(armGeo, shirtMat); armL.position.set(-0.3, 1.42, 0);
  const armR = new THREE.Mesh(armGeo, shirtMat); armR.position.set(0.3, 1.42, 0);
  // hands
  const handGeo = new THREE.SphereGeometry(0.07, 8, 6);
  const handL = new THREE.Mesh(handGeo, skinMat); handL.position.set(0, -0.62, 0); armL.add(handL);
  const handR = new THREE.Mesh(handGeo, skinMat); handR.position.set(0, -0.62, 0); armR.add(handR);
  // head + hair + face
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 12), skinMat);
  head.position.y = 1.66; head.scale.set(1, 1.15, 0.95);
  const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.195, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hairMesh.position.y = 1.68;
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), eyeMat);
    eye.position.set(sx * 0.07, 1.68, 0.17);
    g.add(eye);
  }
  for (const m of [legL, legR, torso, armL, armR, head, hairMesh]) { m.castShadow = true; g.add(m); }
  g.scale.setScalar(scale);
  return { group: g, legL, legR, armL, armR, head, torso, walkPhase: 0 };
}

export function animateWalk(h, phase, speed) {
  h.walkPhase = phase;
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const amp = clamp(speed / 6, 0.15, 1) * 0.55;
  h.legL.rotation.x = s * amp;
  h.legR.rotation.x = -s * amp;
  h.armL.rotation.x = -s * amp * 0.8;
  h.armR.rotation.x = s * amp * 0.8;
  h.torso.position.y = 1.14 + Math.abs(c) * 0.03 * amp;
}

export function animateIdle(h, t) {
  h.armL.rotation.x = Math.sin(t * 1.4) * 0.05;
  h.armR.rotation.x = -Math.sin(t * 1.4) * 0.05;
  h.legL.rotation.x = 0; h.legR.rotation.x = 0;
  h.torso.position.y = 1.14 + Math.sin(t * 1.4) * 0.01;
}

// ---- the player ----
export class PlayerChar {
  constructor(scene) {
    this.h = buildHumanoid({ shirt: 0xc0392b, pants: 0x2b3a4a, hair: 0x1a1a1a });
    this.group = this.h.group;
    this.pos = { x: 8, z: 2 };
    this.yaw = 0;            // facing (radians, atan2 convention)
    this.y = 0;              // jump height
    this.vy = 0;
    this.health = PLAYER.health;
    this.ammo = PLAYER.ammo;
    this.fireT = 0;          // seconds until the gun can fire again
    this.reloading = 0;      // seconds left reloading
    this.aimYaw = 0;         // where the gun points
    this.aimPitch = 0;
    this.speed = 0;
    this.group.position.set(this.pos.x, 0, this.pos.z);
    scene.add(this.group);
    // pistol in the right hand
    const gun = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.34), new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.4, metalness: 0.7 }));
    barrel.position.set(0, 0, 0.14);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.08), new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.8 }));
    grip.position.set(0, -0.08, -0.02);
    gun.add(barrel); gun.add(grip);
    gun.position.set(0, -0.62, 0.08);
    this.h.armR.add(gun);
    this.gun = gun;
  }
}

// ---- pedestrians + hostiles ----
export class Peds {
  constructor(scene, rng) {
    this.list = [];
    this.hostiles = [];
    for (let i = 0; i < PED_COUNT; i++) {
      const h = buildHumanoid({
        skin: SKIN[rng.int(0, SKIN.length - 1)],
        shirt: SHIRTS[rng.int(0, SHIRTS.length - 1)],
        pants: PANTS[rng.int(0, PANTS.length - 1)],
        hair: 0x1a1a1a,
        scale: rng.range(0.94, 1.06),
      });
      const road = [-168, -112, -56, 0, 56, 112, 168][rng.int(0, 6)];
      const along = rng.range(-180, 180);
      const horizontal = rng.chance(0.5);
      const x = horizontal ? along : road + (rng.chance(0.5) ? 7 : -7);
      const z = horizontal ? road + (rng.chance(0.5) ? 7 : -7) : along;
      h.group.position.set(x, 0, z);
      h.group.rotation.y = rng.range(0, Math.PI * 2);
      scene.add(h.group);
      this.list.push({
        h, x, z, yaw: h.group.rotation.y,
        speed: rng.range(0.8, 1.6), phase: rng.range(0, 6),
        target: null, state: 'walk',
      });
    }
  }
  spawnHostiles(scene, rng, spots) {
    // clear old hostiles
    for (const h of this.hostiles) scene.remove(h.h.group);
    this.hostiles = [];
    for (const s of spots) {
      const h = buildHumanoid({ skin: SKIN[rng.int(0, SKIN.length - 1)], shirt: 0x222222, pants: 0x1a1a1a, hair: 0x111111 });
      h.group.position.set(s.x, 0, s.z);
      scene.add(h.group);
      const gun = new THREE.Group();
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.3), new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.4, metalness: 0.7 }));
      barrel.position.set(0, 0, 0.12);
      gun.add(barrel);
      gun.position.set(0, -0.62, 0.08);
      h.armR.add(gun);
      this.hostiles.push({
        h, state: 'alive', health: 100,
        target: { x: s.x, z: s.z }, speed: 0, shootT: rng.range(1, 3),
        group: h.group,
      });
    }
    return this.hostiles;
  }
  update(dt, rng, colliders, playerPos) {
    for (const p of this.list) {
      if (!p.target || Math.hypot(p.target.x - p.x, p.target.z - p.z) < 3) {
        // pick a new sidewalk waypoint
        const road = [-168, -112, -56, 0, 56, 112, 168][rng.int(0, 6)];
        const along = rng.range(-180, 180);
        const horizontal = rng.chance(0.5);
        p.target = horizontal
          ? { x: along, z: road + (rng.chance(0.5) ? 7 : -7) }
          : { x: road + (rng.chance(0.5) ? 7 : -7), z: along };
      }
      const dx = p.target.x - p.x, dz = p.target.z - p.z;
      const d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let diff = want - p.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.yaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      p.x += Math.sin(p.yaw) * p.speed * dt;
      p.z += Math.cos(p.yaw) * p.speed * dt;
      p.phase += dt * p.speed * 2.2;
      p.h.group.position.set(p.x, 0, p.z);
      p.h.group.rotation.y = p.yaw;
      animateWalk(p.h, p.phase, p.speed);
    }
  }
}
