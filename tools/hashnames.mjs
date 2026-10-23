// pnpm hashnames [--dry] — one-off migration: renames the existing variants to the content-hashed names `foto` now writes,
//   public/photos/<slug>/01-1400.avif  →  01-<hash8>-1400.avif      public/film/<slug>/01-film.webp  →  01-<hash8>-film.webp
// where <hash8> is the first 8 chars of the master's sha1 stored in src/data/photos/<slug>.json. Nothing is re-encoded and
// nothing else is touched. Idempotent: files already renamed (or missing) are skipped, so it can be run again safely.
// Run it BEFORE `pnpm foto` (otherwise foto re-encodes everything under the new names) and before the build.
import { existsSync } from 'node:fs';
import { readdir, readFile, rename } from 'node:fs/promises';
import { join } from 'node:path';

const DRY = process.argv.includes('--dry');
const WIDTHS = [800, 1400, 2200];
let moved = 0, already = 0, missing = 0;

for (const file of (await readdir('src/data/photos')).filter((f) => f.endsWith('.json'))) {
  const slug = file.replace(/\.json$/, '');
  const { photos } = JSON.parse(await readFile(join('src/data/photos', file), 'utf8'));
  for (const [name, meta] of Object.entries(photos)) {
    const base = name.replace(/\.[^.]+$/, ''), h = meta.hash.slice(0, 8);
    const pairs = [
      ...WIDTHS.flatMap((w) => ['avif', 'webp'].map((e) => ['public/photos', `${base}-${w}.${e}`, `${base}-${h}-${w}.${e}`])),
      ['public/film', `${base}-film.webp`, `${base}-${h}-film.webp`],
    ];
    for (const [root, from, to] of pairs) {
      const a = join(root, slug, from), b = join(root, slug, to);
      if (existsSync(b)) { already++; continue; }
      if (!existsSync(a)) { missing++; continue; } // e.g. public/photos is not on this machine
      if (!DRY) await rename(a, b);
      moved++;
    }
  }
}
console.log(`${DRY ? 'would rename' : 'renamed'} ${moved}, already hashed ${already}, not found ${missing}`);
