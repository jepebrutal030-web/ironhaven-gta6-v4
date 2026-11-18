// IRONHAVEN — the Game. Owns the renderer, the loop, the player, the car,
// collisions, the state machine (menu / playing / paused / busted / wasted /
// ended), save/load, the click router, and the window.IRONHAVEN test API.
import * as THREE from 'three';
import { CITY_HALF, ROADS, ROAD_WIDTH, SAVE_KEY, PLAYER, HIDEOUT } from './config.js';
import { clamp, lerp, dist2, collideCircle } from './util.js';
import { makeRng } from './random.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { buildWorld } from './world.js';
import { buildParked, Traffic, openDoors, updateDoors } from './vehicles.js';
import { PlayerChar, Peds, animateWalk, animateIdle } from './people.js';
import { Wanted } from './police.js';
import { Weapons } from './weapons.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { shotKind, stageShot } from './shots.js';

const SAVE_VERSION = 4;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    const q = new URLSearchParams(window.location.search);
    const seed = parseInt(q.get('seed') || '1', 10) || 1;
    this.rng = makeRng(seed);
    this.seed = seed;
    this.mode = 'menu';          // menu | playing | paused | busted | wasted | ended
    this.money = 0;
    this.kills = 0;
    this.driving = false;
    this.playerCar = null;
    this.carSpeed = 0;           // m/s
    this.speedMph = 0;
    this.cameraMode = 'foot';    // foot | chase | mission
    this.missionCam = null;
    this.cruise = false;         // screenshot staging: hold W so the car drives
    this.time = 0;
    this.camYaw = 0;
    this.camPitch = 0.32;

    // ---- renderer (ACES, antialias, PCF shadows) ----
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b5d9);
    this.scene.fog = new THREE.Fog(0x9fc3dd, 220, 520);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(8, 6, 14);

    this.input = new Input(canvas);
    this.audio = new AudioSys();
    this.world = buildWorld(this.scene, this.rng);
    this.parked = buildParked(this.scene, this.rng);
    this.traffic = new Traffic(this.scene, this.rng, this.world.colliders);
    this.player = new PlayerChar(this.scene);
    this.peds = new Peds(this.scene, this.rng);
    this.wanted = new Wanted(this.scene, this.rng);
    this.wanted.onBusted = () => this.toBusted();
    this.weapons = new Weapons(this.scene);
    this.hud = new HUD();
    this.missions = new Missions({ game: this });

    // golden Manta for the Harbor Job (mission 4 step 1)
    this.golden = this.parked[this.parked.length - 1];
    this.golden.golden = true;
    this.golden.paintMat.color.setHex(0xd4af37);
    this.golden.group.position.set(172, 0, 28);
    this.golden.group.rotation.y = Math.PI / 4;

    this._bindUI();
    this._clickRouter();
    this._loadSave();
    window.addEventListener('resize', () => this._resize());
    this._clock = { last: performance.now() };
    this._raf = null;
    this.loop = this.loop.bind(this);
  }

  // ---------- UI ----------
  _bindUI() {
    const $ = (id) => document.getElementById(id);
    const show = (id) => {
      for (const s of document.querySelectorAll('.screen')) s.classList.remove('visible');
      const el = $(id); if (el) el.classList.add('visible');
    };
    this._show = show;
    $('btn-new')?.addEventListener('click', () => { this.audio.ensure(); this.newGame(); });
    $('btn-continue')?.addEventListener('click', () => { this.audio.ensure(); this.continueGame(); });
    $('btn-resume')?.addEventListener('click', () => this.resume());
    $('btn-busted')?.addEventListener('click', () => this.respawn());
    $('btn-wasted')?.addEventListener('click', () => this.respawn());
    $('btn-again')?.addEventListener('click', () => { this.newGame(); });
    $('btn-menu')?.addEventListener('click', () => { this.mode = 'menu'; show('screen-start'); this._refreshMenu(); });
    this._refreshMenu();
    if (this.hasSave()) show('screen-start'); else show('screen-start');
  }
  _refreshMenu() {
    const c = document.getElementById('btn-continue');
    if (c) c.style.display = this.hasSave() ? '' : 'none';
  }
  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (_) { return false; } }

  // Headless SwiftShader's compositor swallows overlay-button clicks (the
  // WebGL canvas receives pointer events even when an overlay is shown).
  // Route window clicks: when a click lands on the canvas while a screen is
  // visible, map it by coordinates to the visible overlay button and click it.
  _clickRouter() {
    window.addEventListener('click', (e) => {
      if (e.target !== this.canvas) return;
      const vis = document.querySelector('.screen.visible');
      if (!vis) return;
      for (const b of vis.querySelectorAll('button')) {
        const r = b.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          b.click();
          return;
        }
      }
    });
  }

  _resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ---------- state ----------
  newGame() {
    this.money = 0; this.kills = 0;
    this.player.health = PLAYER.health;
    this.player.ammo = PLAYER.ammo;
    this.player.pos.x = 8; this.player.pos.z = 2; this.player.yaw = 0;
    this.wanted.set(0); this.wanted.clearAll();
    this.driving = false; this.playerCar = null; this.carSpeed = 0;
    this.missions.current = 0; this.missions.step = 0; this.missions.done = false;
    this.missions.beginStep();
    this.mode = 'playing';
    this._show(null);
    this.save();
  }
  continueGame() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!s || s.v !== SAVE_VERSION) { this.newGame(); return; }
      this.money = s.money; this.kills = s.kills || 0;
      this.player.health = s.health; this.player.ammo = s.ammo;
      this.player.pos.x = s.x; this.player.pos.z = s.z;
      this.missions.current = s.mission; this.missions.step = s.step;
      this.missions.beginStep();
      this.wanted.set(0);
      this.driving = false; this.playerCar = null;
      this.mode = 'playing';
      this._show(null);
    } catch (_) { this.newGame(); }
  }
  pause() { if (this.mode !== 'playing') return; this.mode = 'paused'; this._show('screen-pause'); this.save(); }
  resume() { if (this.mode !== 'paused') return; this.mode = 'playing'; this._show(null); }
  toBusted() {
    if (this.mode !== 'playing') return;
    this.mode = 'busted';
    this.audio.busted();
    this.money = Math.max(0, this.money - 100);
    this._show('screen-busted');
  }
  toWasted() {
    if (this.mode !== 'playing') return;
    this.mode = 'wasted';
    this._show('screen-wasted');
  }
  respawn() {
    this.player.health = PLAYER.health;
    this.player.pos.x = 8; this.player.pos.z = 2;
    this.player.y = 0; this.player.vy = 0;
    this.wanted.set(0); this.wanted.clearAll();
    this.driving = false; this.playerCar = null; this.carSpeed = 0;
    this.mode = 'playing';
    this._show(null);
    this.save();
  }
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: SAVE_VERSION, money: this.money, kills: this.kills,
        health: this.player.health, ammo: this.player.ammo,
        x: this.player.pos.x, z: this.player.pos.z,
        mission: this.missions.current, step: this.missions.step,
      }));
    } catch (_) {}
  }
  _loadSave() { this._refreshMenu(); }

  // ---------- test / external API ----------
  state() {
    return {
      mode: this.mode, mission: this.missions.current, missionStep: this.missions.step,
      money: this.money, driving: this.driving, speed: Math.abs(this.speedMph),
      player: { x: this.player.pos.x, z: this.player.pos.z },
      wanted: this.wanted.wanted, police: this.wanted.count, kills: this.kills,
      health: this.player.health, ammo: this.player.ammo,
    };
  }
  teleport(x, z) {
    this.player.pos.x = x; this.player.pos.z = z;
    if (this.driving && this.playerCar) {
      this.playerCar.group.position.x = x;
      this.playerCar.group.position.z = z;
    }
  }
  setWanted(n) { this.wanted.set(n); }
  startMission(n) { this.missions.startMission(n); }
  aimAt(x, y, z) { this.weapons.aimAt(this.player, x, y, z); }
  shoot() {
    const targets = [...this.peds.hostiles, ...this.peds.list.map((p) => ({ group: p.h.group, health: 100, state: 'walk' }))];
    const r = this.weapons.shoot(this.player, this.peds.hostiles, this.audio);
    if (r && r.killed) { this.kills += 1; this.hud.hitmark(); }
    else if (r) this.hud.hitmark();
    return r;
  }

  tryEnterCar() {
    const p = this.player.pos;
    let best = null, bd = 3.6;
    const all = [...this.parked, ...this.traffic.cars];
    for (const c of all) {
      const d = Math.hypot(c.group.position.x - p.x, c.group.position.z - p.z);
      if (d < bd) { bd = d; best = c; }
    }
    if (!best) return false;
    this.driving = true;
    this.playerCar = best;
    this.carSpeed = 0;
    best.parked = false;
    openDoors(best);
    this.audio.door();
    // entering a car is a crime if anyone is watching
    if (this.wanted.wanted < 1) this.wanted.set(1);
    this.cameraMode = 'chase';
    return true;
  }
  exitCar() {
    if (!this.driving || !this.playerCar) return;
    const c = this.playerCar;
    const a = c.group.rotation.y;
    this.player.pos.x = c.group.position.x - Math.sin(a) * 2.5;
    this.player.pos.z = c.group.position.z - Math.cos(a) * 2.5;
    this.player.yaw = a;
    openDoors(c);
    this.audio.door();
    this.driving = false;
    this.playerCar = null;
    this.carSpeed = 0;
    this.audio.engine(false);
    this.cameraMode = 'foot';
  }

  // ---------- collision ----------
  _collide(x, z, r, tx, tz) {
    // buildings (AABB)
    for (const b of this.world.colliders) {
      const cx = clamp(x, b.minX, b.maxX), cz = clamp(z, b.minZ, b.maxZ);
      const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 === 0) return { x: x + r, z };
        const d = Math.sqrt(d2);
        return { x: cx + (dx / d) * r, z: cz + (dz / d) * r };
      }
    }
    // trees (circles, lateral bias so cars slide around instead of wedging)
    for (const t of this.world.treeCircles) {
      const push = collideCircle(x, z, r, t.x, t.z, t.r, tx, tz);
      if (push) return { x: x + push.x, z: z + push.z };
    }
    return { x, z };
  }

  // ---------- keys ----------
  _handleKeys() {
    const inp = this.input;
    if (inp.wasPressed('KeyE')) {
      if (this.mode === 'playing') { if (this.driving) this.exitCar(); else this.tryEnterCar(); }
    }
    if (inp.wasPressed('KeyR')) {
      if (this.mode === 'playing' && !this.driving && this.player.reloading <= 0 && this.player.ammo < PLAYER.magSize) {
        this.player.reloading = PLAYER.reloadTime;
        this.audio.reload();
      }
    }
    if (inp.wasPressed('KeyP')) {
      if (this.mode === 'playing') this.pause();
      else if (this.mode === 'paused') this.resume();
    }
    if (inp.wasPressed('KeyM')) this.audio.toggleMute();
    if (inp.wasPressed('Digit1')) { /* pistol */ }
    if (inp.wasPressed('Digit2') || inp.wasPressed('Digit3')) { /* pistol only */ }
    if (inp.mouseClicked && this.mode === 'playing' && !this.driving) this.shoot();
  }

  // ---------- per-frame ----------
  _updatePlayer(dt) {
    const p = this.player;
    const inp = this.input;
    // mouse look
    if (inp.locked) {
      this.camYaw -= inp.mouseDX * 0.0032;
      this.camPitch = clamp(this.camPitch + inp.mouseDY * 0.0022, -0.15, 0.9);
    }
    p.aimYaw = this.camYaw;
    p.yaw = this.camYaw;
    const ax = inp.axes();
    const sprint = inp.down('ShiftLeft') || inp.down('ShiftRight');
    const sp = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    const sy = Math.sin(this.camYaw), cy = Math.cos(this.camYaw);
    let mx = (sy * ax.y + cy * ax.x), mz = (cy * ax.y - sy * ax.x);
    const ml = Math.hypot(mx, mz);
    if (ml > 0.01) { mx /= ml; mz /= ml; }
    const step = sp * dt;
    let nx = p.pos.x + mx * step, nz = p.pos.z + mz * step;
    const hit = this._collide(nx, nz, 0.55, mx, mz);
    nx = hit.x; nz = hit.z;
    nx = clamp(nx, -CITY_HALF + 2, CITY_HALF - 2);
    nz = clamp(nz, -CITY_HALF + 2, CITY_HALF - 2);
    p.pos.x = nx; p.pos.z = nz;
    p.speed = ml * sp;
    // jump + gravity
    if (inp.down('Space') && p.y <= 0) { p.vy = PLAYER.jumpSpeed; }
    p.vy -= 22 * dt;
    p.y = Math.max(0, p.y + p.vy * dt);
    if (p.y === 0) p.vy = 0;
    // timers
    if (p.fireT > 0) p.fireT -= dt;
    if (p.reloading > 0) {
      p.reloading -= dt;
      if (p.reloading <= 0) { p.ammo = PLAYER.magSize; }
    }
    // animate
    p.group.position.set(p.pos.x, p.y, p.pos.z);
    p.group.rotation.y = p.yaw;
    if (ml > 0.05) animateWalk(p.h, this.time * 9, p.speed);
    else animateIdle(p.h, this.time);
    // aiming pose: right arm points the gun where the camera looks
    p.h.armR.rotation.x = -Math.PI / 2 + p.aimPitch;
    if (p.health <= 0) this.toWasted();
  }

  _updateCar(dt) {
    const car = this.playerCar;
    if (!car) return;
    const inp = this.input;
    const ax = inp.axes();
    const boost = inp.down('ShiftLeft') || inp.down('ShiftRight');
    // cruise (screenshot staging) drives at a modest city speed so the car
    // is clearly moving but does not outrun the staged roadblock
    const top = this.cruise ? 8 : (boost ? 26 : 19);
    const accel = 14, brake = 26;
    // cruise (screenshot staging) holds the throttle so the car drives
    const ay = this.cruise ? 1 : ax.y;
    if (ay > 0) this.carSpeed += accel * dt;
    else if (ay < 0) this.carSpeed -= (this.carSpeed > 0.5 ? brake : 8) * dt;
    else this.carSpeed -= Math.sign(this.carSpeed) * 6 * dt;
    if (Math.abs(this.carSpeed) < 0.2 && ax.y === 0) this.carSpeed = 0;
    this.carSpeed = clamp(this.carSpeed, -8, top);
    if (inp.down('Space')) this.carSpeed *= Math.max(0, 1 - 4 * dt); // handbrake
    // steering (less at speed)
    const steer = ax.x * clamp(1.4 - Math.abs(this.carSpeed) * 0.03, 0.45, 1.4);
    car.group.rotation.y += (this.carSpeed >= 0 ? steer : -steer) * dt * Math.sign(this.carSpeed || 1) * 0.9;
    const a = car.group.rotation.y;
    let nx = car.group.position.x + Math.sin(a) * this.carSpeed * dt;
    let nz = car.group.position.z + Math.cos(a) * this.carSpeed * dt;
    const hit = this._collide(nx, nz, 1.6, Math.sin(a) * this.carSpeed, Math.cos(a) * this.carSpeed);
    if (hit.x !== nx || hit.z !== nz) {
      this.carSpeed *= 0.4;
      this.audio.crash();
      nx = hit.x; nz = hit.z;
    }
    nx = clamp(nx, -CITY_HALF + 3, CITY_HALF - 3);
    nz = clamp(nz, -CITY_HALF + 3, CITY_HALF - 3);
    car.group.position.x = nx;
    car.group.position.z = nz;
    this.player.pos.x = nx; this.player.pos.z = nz;
    this.player.yaw = a;
    this.speedMph = this.carSpeed * 2.237;
    this.audio.engine(true);
    this.audio.setEngine(Math.abs(this.carSpeed) / top);
    car.wheels.forEach((w) => { w.rotation.x += (this.carSpeed * dt) / 0.36; });
    updateDoors(car, dt);
    // hide the player mesh inside the car
    this.player.group.visible = false;
  }

  _updateCamera(dt) {
    const p = this.player;
    if (this.cameraMode === 'mission' && this.missionCam) {
      const mc = this.missionCam;
      this.camera.position.set(mc.x, mc.y, mc.z);
      this.camera.lookAt(mc.lookX, mc.lookY, mc.lookZ);
      return;
    }
    let dist, height, lookY;
    if (this.driving && this.playerCar) {
      const a = this.playerCar.group.rotation.y;
      dist = 9.5; height = 4.2; lookY = 1.2;
      const tx = this.playerCar.group.position.x - Math.sin(a) * dist;
      const tz = this.playerCar.group.position.z - Math.cos(a) * dist;
      this.camera.position.x = lerp(this.camera.position.x, tx, 1 - Math.pow(0.001, dt));
      this.camera.position.y = lerp(this.camera.position.y, height, 1 - Math.pow(0.001, dt));
      this.camera.position.z = lerp(this.camera.position.z, tz, 1 - Math.pow(0.001, dt));
      this.camera.lookAt(this.playerCar.group.position.x, lookY, this.playerCar.group.position.z);
      return;
    }
    // on foot: third person behind the player
    dist = 7; height = 3.4;
    const backX = p.pos.x - Math.sin(this.camYaw) * dist;
    const backZ = p.pos.z - Math.cos(this.camYaw) * dist;
    const ty = p.y + 1.6;
    this.camera.position.x = lerp(this.camera.position.x, backX, 1 - Math.pow(0.0005, dt));
    this.camera.position.y = lerp(this.camera.position.y, p.y + height, 1 - Math.pow(0.0005, dt));
    this.camera.position.z = lerp(this.camera.position.z, backZ, 1 - Math.pow(0.0005, dt));
    this.camera.lookAt(p.pos.x, ty, p.pos.z);
  }

  _update(dt) {
    this.time += dt;
    if (this.mode !== 'playing') return;
    this._handleKeys();
    if (this.driving) this._updateCar(dt);
    else {
      this.player.group.visible = true;
      this._updatePlayer(dt);
    }
    this.traffic.update(dt, this.rng, this.player.pos);
    this.peds.update(dt, this.rng, this.world.colliders, this.player.pos);
    // hostiles: walk toward the player and shoot back
    for (const h of this.peds.hostiles) {
      if (h.state === 'fallen') continue;
      const dx = this.player.pos.x - h.group.position.x;
      const dz = this.player.pos.z - h.group.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 14) {
        h.target = { x: this.player.pos.x, z: this.player.pos.z };
        h.speed = 3.2;
      } else if (d > 6) { h.speed = 2.2; }
      else h.speed = 0;
      if (h.speed > 0) {
        const want = Math.atan2(dx, dz);
        h.group.rotation.y = want;
        h.group.position.x += Math.sin(want) * h.speed * dt;
        h.group.position.z += Math.cos(want) * h.speed * dt;
        h.phase = (h.phase || 0) + dt * h.speed * 2.2;
        animateWalk(h.h, h.phase, h.speed);
      }
      h.shootT -= dt;
      if (h.shootT <= 0 && d < 26 && d > 2) {
        h.shootT = 2.4;
        // hostile return fire: small chance to hit
        if (this.rng.chance(0.3)) {
          this.player.health -= 6;
          this.hud.damage();
          if (this.player.health <= 0) this.toWasted();
        }
      }
    }
    this.wanted.update(dt, this.player, this.driving, this.playerCar, this.world.colliders, this.world.treeCircles, this.audio);
    this.missions.update(dt, this);
    this.weapons.update(dt);
    this.hud.update(dt, this);
    // autosave every ~20 s of play
    this._saveT = (this._saveT || 0) + dt;
    if (this._saveT > 20) { this._saveT = 0; this.save(); }
  }

  loop() {
    // Re-register so a direct call resumes the loop after setAnimationLoop(null).
    this.renderer.setAnimationLoop(this.loop);
    const now = performance.now();
    const dt = clamp((now - this._clock.last) / 1000, 0, 0.15);
    this._clock.last = now;
    this._update(dt);
    this._updateCamera(dt);
    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
    if (!this._ready) {
      this._ready = true;
      if (window.IRONHAVEN) window.IRONHAVEN.ready = true;
    }
  }
  start() {
    this.renderer.setAnimationLoop(this.loop);
  }

  // auto-start when a ?shot= URL is given (screenshot mode)
  autoStart() {
    const kind = shotKind();
    if (!kind) return false;
    this.audio.ensure();
    this.newGame();
    stageShot(this, kind);
    return true;
  }
}
