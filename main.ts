// Ember Canyon — the entry program (Node 22, standard library only).
// It hands the game in: it copies game/ and screenshots/ from beside
// this file into the output directory and writes dossier.json there,
// the summary the judge reads, built by the vendored make.fun
// library. It writes the same bytes every run: the copy is a plain
// file copy, and buildDossier is deterministic.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Copy one directory tree, files and empty directories alike. */
function copyTree(sourceDir, targetDir) {
  mkdirSync(targetDir, { recursive: true });
  for (const name of readdirSync(sourceDir)) {
    const from = join(sourceDir, name);
    const to = join(targetDir, name);
    const stat = lstatSync(from);
    if (stat.isDirectory()) {
      copyTree(from, to);
    } else if (stat.isFile()) {
      copyFileSync(from, to);
    }
  }
}

function requireDir(path, what) {
  if (!existsSync(path) || !lstatSync(path).isDirectory()) {
    throw new Error(`main.ts: ${what} is missing: expected a directory at ${path}`);
  }
}

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');
requireDir(gameDir, 'game/');
requireDir(shotsDir, 'screenshots/');

mkdirSync(outDir, { recursive: true });
copyTree(gameDir, join(outDir, 'game'));
copyTree(shotsDir, join(outDir, 'screenshots'));

// The scorer's own caps (from the competition's gate): only
// text_max_bytes shapes the bytes; the others make the program fail
// where the scorer would refuse the entry (more than 4 screenshots
// or one over 256 KiB; game/ past 993 files or 48 MiB, or a path
// over 1000 bytes: game/ counts beside /output's own 1000-entry cap).
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Ember Canyon handed in to ${outDir}`);
