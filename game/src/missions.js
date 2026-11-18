// The story: five jobs for Dario, from stealing his first car to the
// Harbor Job. Each mission has steps; beginStep() sets the current step up
// (markers, hostiles, cars). Completing a mission pays out and advances.
import { MISSIONS, HIDEOUT } from './config.js';
import { dist2 } from './util.js';

const SPOTS = {
  courier: { x: 112, z: -56 },
  dropoff: { x: -56, z: 168 },
  package: { x: 168, z: 112 },
  safehouse: { x: -168, z: 168 },
  depot: { x: -112, z: 112 },
  harbor: { x: 172, z: 28 },
  warehouse: { x: 140, z: 28 },
};

export class Missions {
  constructor(ctx) {
    this.ctx = ctx;           // { game } — set by Game after construction
    this.current = 0;         // mission index 0..4 (5 = story done)
    this.step = 0;
    this.objective = '';
    this.target = null;       // {x, z, r, label}
    this.timer = 0;           // seconds left (0 = no timer)
    this.done = false;
    this.beginStep();
  }

  startMission(n) {
    this.current = n;
    this.step = 0;
    this.done = false;
    this.beginStep();
  }

  beginStep() {
    const g = this.ctx.game;
    const m = this.current;
    this.target = null; this.timer = 0;
    if (m >= MISSIONS.length) { this.objective = 'Story complete.'; this.done = true; return; }
    if (m === 0) {
      if (this.step === 0) { this.objective = 'Steal a car — any car. Walk up to one and press E.'; }
      else { this.objective = 'Drive the car to the hideout.'; this.target = { ...HIDEOUT, r: 12, label: 'Hideout' }; }
    } else if (m === 1) {
      if (this.step === 0) { this.objective = 'Pick up the courier at the east plaza.'; this.target = { ...SPOTS.courier, r: 8, label: 'Courier' }; }
      else { this.objective = 'Drop the courier at the north docks.'; this.target = { ...SPOTS.dropoff, r: 8, label: 'Dropoff' }; }
    } else if (m === 2) {
      if (this.step === 0) { this.objective = 'Grab the package on the east side.'; this.target = { ...SPOTS.package, r: 8, label: 'Package' }; }
      else { this.objective = 'Lose the heat — get your wanted level to zero.'; g.wanted.set(3); }
    } else if (m === 3) {
      if (this.step === 0) { this.objective = 'Go to the depot on the west side.'; this.target = { ...SPOTS.depot, r: 10, label: 'Depot' }; }
      else if (this.step === 1) {
        this.objective = 'Eliminate the depot crew.';
        // spawn hostiles around the depot
        const spots = [
          { x: SPOTS.depot.x - 8, z: SPOTS.depot.z - 6 },
          { x: SPOTS.depot.x + 6, z: SPOTS.depot.z - 8 },
          { x: SPOTS.depot.x + 8, z: SPOTS.depot.z + 6 },
          { x: SPOTS.depot.x - 6, z: SPOTS.depot.z + 8 },
        ];
        g.peds.spawnHostiles(g.scene, g.rng, spots);
      } else { this.objective = 'Head back to the hideout.'; this.target = { ...HIDEOUT, r: 12, label: 'Hideout' }; }
    } else if (m === 4) {
      if (this.step === 0) { this.objective = 'Go to the harbor and find the golden Manta.'; this.target = { ...SPOTS.harbor, r: 10, label: 'Harbor' }; }
      else if (this.step === 1) { this.objective = 'Steal the golden Manta.'; this.target = { ...SPOTS.harbor, r: 6, label: 'Golden Manta' }; }
      else { this.objective = 'Deliver the Manta to the warehouse.'; this.target = { ...SPOTS.warehouse, r: 10, label: 'Warehouse' }; }
    }
    if (g.hud) g.hud.setObjective(this.objective, this.target);
  }

  completeStep(g) {
    this.step += 1;
    if (g.audio) g.audio.pickup();
    const lastStep = (this.current === 0 && this.step > 1) ||
      (this.current === 1 && this.step > 1) ||
      (this.current === 2 && this.step > 1) ||
      (this.current === 3 && this.step > 2) ||
      (this.current === 4 && this.step > 2);
    if (lastStep) this.completeMission(g);
    else this.beginStep();
  }

  completeMission(g) {
    const m = MISSIONS[this.current];
    g.money += m.pay;
    g.hud.flash(`+$${m.pay} — ${m.name} complete`);
    this.current += 1;
    this.step = 0;
    if (this.current >= MISSIONS.length) {
      this.done = true;
      this.objective = 'Story complete. Ironhaven is yours.';
      g.mode = 'ended';
      if (g.hud) g.hud.showEnd();
    } else this.beginStep();
  }

  // Called every frame. Handles: entering a car (mission 0 step 0),
  // reaching a target, eliminating hostiles (mission 3 step 1),
  // losing the heat (mission 2 step 1), stealing the Manta (mission 4 step 1).
  update(dt, g) {
    if (this.done || g.mode !== 'playing') return;
    const m = this.current;
    // mission 0 step 0: stealing any car advances to the hideout step
    if (m === 0 && this.step === 0 && g.driving) { this.completeStep(g); return; }
    // mission 4 step 1: entering the golden Manta advances
    if (m === 4 && this.step === 1 && g.driving && g.playerCar && g.playerCar.golden) { this.completeStep(g); return; }
    // mission 3 step 1: all hostiles down advances
    if (m === 3 && this.step === 1) {
      const alive = g.peds.hostiles.some((h) => h.state !== 'fallen');
      if (g.peds.hostiles.length > 0 && !alive) { this.completeStep(g); return; }
    }
    // mission 2 step 1: wanted back to zero advances
    if (m === 2 && this.step === 1 && g.wanted.wanted === 0) { this.completeStep(g); return; }
    // reaching a target advances (on foot or driving)
    if (this.target) {
      const p = g.player.pos;
      if (dist2(p.x, p.z, this.target.x, this.target.z) < this.target.r * this.target.r) {
        this.completeStep(g);
      }
    }
  }
}
