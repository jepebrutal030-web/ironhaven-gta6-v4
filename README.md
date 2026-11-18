# IRONHAVEN — open-world crime game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/jepebrutal030-web/ironhaven-gta6-v4/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/jepebrutal030-web/ironhaven-gta6-v4/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built for [make.fun's gta6-01](https://make.fun/bounty/gta6-01) — playable offline in a desktop browser from static files, no network request.

**Ironhaven** is a sun-soaked modern city of your own: 7×7 blocks, downtown towers, a residential west side, and a harbor with the sea to the east. You play Dario, a driver fresh out of the life, running five jobs from stealing his first car to taking the golden Manta off the docks.

## What is in the game

- **A city on foot and by car** — 392×392 m, traffic (22 cars), pedestrians (36), 14 stealable parked cars, 8 car models
- **Wanted 0–5** — police cars that chase and ram, foot cops that arrest you (BUSTED), and a WASTED screen when your health runs out; the heat decays when you stay hidden
- **5 story missions** — Homecoming ($300), Pickup ($500), Getaway ($700), Shakedown ($1,000), Harbor Job ($1,500), with an ending screen
- **Combat** — aim-corrected pistol, reload, hitmarkers, hostile crews that shoot back
- **HUD + live minimap** — health, money, wanted stars, objective with distance, speedometer, ammo, crosshair, damage vignette
- **Start screen, pause menu, autosave** (localStorage) — pick up where you left off
- **Sound, synthesized** — a ~100 BPM A-minor loop plus effects, all WebAudio, zero audio files

## Controls

| Key | Action |
| --- | --- |
| WASD | move / drive |
| Mouse | look (click to lock) |
| Click | shoot |
| R | reload |
| E | enter / exit car |
| Shift | sprint / boost |
| Space | jump / handbrake |
| P | pause / save |
| M | mute |

## Play it

```sh
node serve.ts   # serves game/ on http://localhost:8080
```

Then open `http://localhost:8080` in a desktop browser. No build step, no network request — every file the game loads is under `game/`, with three.js vendored as `game/vendor/three/three.module.min.js`.

## Tech

- Three.js 0.187.0 (vendored, minified), WebGL, PCF shadows, ACES tone mapping
- Procedural everything: canvas-textured facades (window grids, brick, glass), textured roads with markings, trees, lamps, traffic lights, sea
- ES modules, no build step

## License

MIT — see [LICENSE](LICENSE). All city, characters, vehicles, names, story, art, sound and music are original. Nothing from Rockstar Games.
