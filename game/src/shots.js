// Screenshot staging for ?shot= URLs (chase | drive | foot | mission).
// Each shot composes the game so one frame shows the most of it: the city,
// a car, the HUD with its minimap, traffic, police, and a mission.
// The staged car is moved ONTO the road under the player before entering
// it, so the drive never starts wedged on a sidewalk. The police roadblock
// is placed AHEAD (+Z, the direction of travel) with hold=true.
import { HARBOR, WAREHOUSE } from './config.js';
import { CAR_MODELS } from './config.js';

export function shotKind() {
  const q = new URLSearchParams(window.location.search);
  return q.get('shot') || null;
}

export function stageShot(g, kind) {
  const parked = g.parked;
  if (!parked || parked.length === 0) return;
  // helpers
  const paint = (car, hex) => { car.paintMat.color.setHex(hex); };
  const putOnRoad = (car, x, z, yaw) => {
    car.group.position.set(x, 0, z);
    car.group.rotation.y = yaw;
  };
  const enterCar = (car) => {
    g.player.pos.x = car.group.position.x - Math.sin(car.group.rotation.y) * 3;
    g.player.pos.z = car.group.position.z - Math.cos(car.group.rotation.y) * 3;
    g.tryEnterCar();
  };

  if (kind === 'chase') {
    // cover: red car, police roadblock AHEAD (+Z), wanted 3
    const car = parked[0];
    paint(car, 0xd21f1f);
    putOnRoad(car, 56, 40, 0); // on road x=56, facing north (+Z? see note)
    // face north along road x=56: north is -Z in this map, so yaw = PI
    car.group.rotation.y = Math.PI;
    g.player.pos.x = 56; g.player.pos.z = 40;
    enterCar(car);
    g.cruise = true; // keep the car driving for the shot (speedometer reads > 0)
    g.wanted.set(3);
    // roadblock AHEAD of the direction of travel (+Z of travel = -Z world
    // when facing north, i.e. further along -Z). Place two held police cars
    // across the road ahead of the player.
    const ahead = 30;
    for (let i = 0; i < 2; i++) {
      const pc = g.wanted.makePoliceCar();
      pc.group.position.set(56 + (i === 0 ? -3.5 : 3.5), 0, 40 - ahead);
      pc.group.rotation.y = 0;
      pc.hold = true;
      pc.placed = true;
      g.wanted.policeCars.push(pc);
    }
    // a couple of traffic cars behind for depth
    g.cameraMode = 'chase';
  } else if (kind === 'drive') {
    // driving north along road x=56
    const car = parked[1 % parked.length];
    paint(car, 0xd21f1f);
    putOnRoad(car, 56, 80, Math.PI);
    g.player.pos.x = 56; g.player.pos.z = 80;
    enterCar(car);
    g.cruise = true; // keep the car driving for the shot (speedometer reads > 0)
    g.wanted.set(0);
    g.cameraMode = 'chase';
  } else if (kind === 'foot') {
    // on foot, third-person, on a city street near the plaza
    g.player.pos.x = 8; g.player.pos.z = 10;
    g.player.yaw = Math.PI * 0.15;
    g.wanted.set(0);
    g.cameraMode = 'foot';
  } else if (kind === 'mission') {
    // harbor job: golden Manta at (172,28), Dario beside it, no police.
    // Camera at car minus (9,7) looking at the car, clearing the
    // (140,28) warehouse, close enough that the car + Dario fill the frame.
    g.wanted.set(0);
    g.wanted.clearAll();
    const car = parked[2 % parked.length];
    paint(car, 0xd4af37);
    car.golden = true;
    putOnRoad(car, HARBOR.x, HARBOR.z, Math.PI / 4);
    g.player.pos.x = HARBOR.x - 2.5;
    g.player.pos.z = HARBOR.z + 2;
    g.player.yaw = Math.atan2(HARBOR.x - g.player.pos.x, HARBOR.z - g.player.pos.z);
    g.cameraMode = 'mission';
    g.missionCam = { x: HARBOR.x - 9, y: 7, z: HARBOR.z - 7, lookX: HARBOR.x, lookY: 1.2, lookZ: HARBOR.z };
    g.missions.startMission(4);
    g.missions.step = 1;
    g.missions.beginStep();
  }
  // make sure the HUD shows the objective for the shot
  if (g.hud) g.hud.setObjective(g.missions.objective, g.missions.target);
}
