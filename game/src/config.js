// IRONHAVEN — open-world crime game. All-original city, characters, vehicles,
// names, story, art, sound and music. Nothing from Rockstar Games.
export const CITY_HALF = 196;            // city spans -196..196 m on each axis
export const ROAD_SPACING = 56;          // roads every 56 m -> 7x7 blocks
export const ROAD_WIDTH = 10;            // drivable road surface width
export const ROADS = [-168, -112, -56, 0, 56, 112, 168];
export const BLOCK = 56;                 // block pitch
export const HIDEOUT = { x: -162, z: -158 }; // mission 1 destination (radius 12)
export const PLAZA = { x: 0, z: 0, r: 24 };  // Founders Plaza, open, no buildings
export const HARBOR = { x: 172, z: 28 };     // golden car / harbor job
export const WAREHOUSE = { x: 140, z: 28 };  // warehouse to clear in mission shot
export const SEA_X = 204;                // sea plane starts east of the city

export const MISSIONS = [
  { name: 'Homecoming',  pay: 300,  desc: 'Steal a car and bring it to the hideout.' },
  { name: 'Pickup',      pay: 500,  desc: 'Pick up the courier and drop them off.' },
  { name: 'Getaway',     pay: 700,  desc: 'Grab the package and lose the heat.' },
  { name: 'Shakedown',   pay: 1000, desc: 'Clear the crew at the depot.' },
  { name: 'Harbor Job',  pay: 1500, desc: 'Take the golden Manta from the harbor.' },
];

export const CAR_MODELS = [
  { name: 'Comet',   color: 0xc0392b, top: 0.62, len: 4.4, w: 1.9, sport: true },
  { name: 'Falcon',  color: 0x2c3e50, top: 0.58, len: 4.6, w: 1.9 },
  { name: 'Manta',   color: 0xd4af37, top: 0.60, len: 4.8, w: 2.0, sport: true },
  { name: 'Marlin',  color: 0x1f6f8b, top: 0.55, len: 4.5, w: 1.85 },
  { name: 'Pickup',  color: 0x5d6d7e, top: 0.55, len: 5.0, w: 2.0 },
  { name: 'Vulture', color: 0x7d3c98, top: 0.58, len: 4.4, w: 1.9 },
  { name: 'Taxi',    color: 0xf1c40f, top: 0.55, len: 4.5, w: 1.9 },
  { name: 'Van',     color: 0x95a5a6, top: 0.62, len: 5.2, w: 2.1 },
];

export const TRAFFIC_COUNT = 22;
export const PED_COUNT = 36;
export const PARKED_COUNT = 14;

export const PLAYER = {
  walkSpeed: 5.2, sprintSpeed: 8.5, jumpSpeed: 7.5,
  health: 100, ammo: 12, magSize: 12, reloadTime: 1.4, fireInterval: 0.28,
  damage: 34, // per pistol hit
};

export const WANTED_MAX = 5;
export const SIGHT_CAR = 60;   // police car sight range (m)
export const SIGHT_FOOT = 40;  // foot cop sight range (m)
export const DECAY_TIME = 8;    // seconds unseen before wanted drops one star
export const ARREST_DIST = 1.8; // foot cop arrest range (m)
export const ARREST_TIME = 2.0; // seconds inside range to get BUSTED

export const SAVE_KEY = 'ironhaven-save-v4';
export const MUSIC_BPM = 100;
