// Combat: hitscan pistol with aim correction. aimAt(x,y,z) points the
// player's gun (and the third-person camera) at a world point; shoot()
// fires one round toward that aim point and reports what it hit.
import * as THREE from 'three';
import { PLAYER } from './config.js';

export class Weapons {
  constructor(scene) {
    this.scene = scene;
    this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 });
    this.tracers = [];
  }

  // Aim the player (and camera) at a world point. y is the target height.
  aimAt(player, x, y, z) {
    const dx = x - player.pos.x, dz = z - player.pos.z;
    player.aimYaw = Math.atan2(dx, dz);
    const d = Math.hypot(dx, dz);
    player.aimPitch = Math.atan2((y - 1.4), Math.max(0.5, d));
    player.yaw = player.aimYaw;
  }

  // Fire one round. `targets` is an array of {group, health, state} (hostiles
  // and peds). Returns the hit target or null. Aim-corrected: the ray is cast
  // from the muzzle toward the aim point, with a small spread that still
  // lands on a humanoid torso at the ranges the game is played at.
  shoot(player, targets, audio) {
    if (player.reloading > 0 || player.fireT > 0) return null;
    if (player.ammo <= 0) { player.reloading = PLAYER.reloadTime; if (audio) audio.reload(); return null; }
    player.ammo -= 1;
    player.fireT = PLAYER.fireInterval;
    if (audio) audio.shoot();
    const origin = new THREE.Vector3(player.pos.x, 1.4, player.pos.z);
    const dir = new THREE.Vector3(
      Math.sin(player.aimYaw) * Math.cos(player.aimPitch),
      Math.sin(player.aimPitch),
      Math.cos(player.aimYaw) * Math.cos(player.aimPitch),
    ).normalize();
    // find the nearest target whose torso the ray passes within 1.1 m of
    let best = null, bestT = 60;
    for (const t of targets) {
      if (!t || t.state === 'fallen') continue;
      const tp = t.group ? t.group.position : t;
      const to = new THREE.Vector3(tp.x - origin.x, 1.2 - origin.y, tp.z - origin.z);
      const along = to.dot(dir);
      if (along < 0.5 || along > bestT) continue;
      const closest = origin.clone().addScaledVector(dir, along);
      const perp = Math.hypot(closest.x - tp.x, closest.z - tp.z) + Math.abs(closest.y - 1.2) * 0.5;
      if (perp < 1.4) { best = t; bestT = along; }
    }
    // tracer
    const end = origin.clone().addScaledVector(dir, best ? bestT : 40);
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const line = new THREE.Line(geo, this.tracerMat);
    this.scene.add(line);
    this.tracers.push({ line, t: 0.06 });
    if (best) {
      best.health -= PLAYER.damage;
      if (audio) audio.hit();
      if (best.health <= 0) {
        best.state = 'fallen';
        if (best.h) {
          best.h.group.rotation.x = -Math.PI / 2;
          best.h.group.position.y = 0.25;
        }
        return { hit: best, killed: true };
      }
      return { hit: best, killed: false };
    }
    return null;
  }

  update(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.t -= dt;
      if (tr.t <= 0) { this.scene.remove(tr.line); tr.line.geometry.dispose(); this.tracers.splice(i, 1); }
    }
  }
}
