// IRONHAVEN entrypoint. Boots the game and exposes the window.IRONHAVEN
// API the play-tests and the screenshot staging use:
//   state() teleport(x,z) setWanted(n) aimAt(x,y,z) shoot() startMission(n) save()
// plus game { player, playerCar, parked, peds, wanted, missions, renderer }.
import { Game } from './game.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);

window.IRONHAVEN = {
  game,
  ready: false,
  state: () => game.state(),
  teleport: (x, z) => game.teleport(x, z),
  setWanted: (n) => game.setWanted(n),
  aimAt: (x, y, z) => game.aimAt(x, y, z),
  shoot: () => game.shoot(),
  startMission: (n) => game.startMission(n),
  save: () => game.save(),
};

// A ?shot= URL auto-starts straight into a staged scene (screenshots).
// Otherwise the start screen waits for NEW GAME / CONTINUE.
if (!game.autoStart()) {
  game.start();
} else {
  game.start();
}
