// IRONHAVEN — entry program for make.fun gta6-01 (Node 22).
// Hands the game in: copies game/ and screenshots/ from this repository to
// the output directory and writes dossier.json with buildDossier from
// vendor/makefun-game.ts (the kit's library, unchanged).
//
//   node main.ts            writes to /output (the grader's directory)
//   MAKEFUN_OUTPUT_DIR=dir node main.ts   writes to dir instead
//
// The output is deterministic: the same game/ and screenshots/ always
// produce the same dossier.json bytes, so two runs are byte-identical.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)));
const OUT = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

// The sealed gate's caps for gta6-01 (reference/gate.json): game/ at most
// 993 entries and 48 MiB, paths at most 1,000 bytes, index.html at most
// 1 MiB; 3-4 screenshots of at most 256 KiB; dossier text at most 163,840
// bytes. buildDossier enforces them and throws DossierError otherwise.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

function main() {
  const gameSrc = join(REPO, 'game');
  const shotsSrc = join(REPO, 'screenshots');
  if (!existsSync(gameSrc)) throw new Error('main.ts: no game/ directory in the repository');
  if (!existsSync(join(gameSrc, 'index.html'))) throw new Error('main.ts: game/index.html is missing');
  if (!existsSync(shotsSrc)) throw new Error('main.ts: no screenshots/ directory in the repository');

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  cpSync(gameSrc, join(OUT, 'game'), { recursive: true });
  cpSync(shotsSrc, join(OUT, 'screenshots'), { recursive: true });

  const dossier = buildDossier(OUT, CAPS);
  writeFileSync(join(OUT, 'dossier.json'), dossier);
  const text = JSON.parse(new TextDecoder().decode(dossier));
  console.log(`wrote ${join(OUT, 'dossier.json')} (${dossier.length} bytes, text ${text.text.length} bytes)`);
  console.log(`game/: ${text.text.split('\n').find((l) => l.startsWith('Source files:')) ?? ''}`);
}

main();
