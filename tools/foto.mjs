// pnpm foto [slug...] [--prune-film] — masters/<slug>/*.jpg → public/photos/<slug>/ + src/data/photos/<slug>.json
// Variant names carry the first 8 chars of the master's sha1 (`01-1a2b3c4d-1400.avif`, `01-1a2b3c4d-film.webp`), so a replaced
// photo gets new URLs and everything can be cached as immutable. Keep in sync with variantStem() in src/lib/shooting.ts.
// Files no longer wanted: public/photos (gitignored) is pruned automatically; public/film is committed, so orphans there are only
// reported unless --prune-film is given.
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { encode } from 'blurhash';

const MASTERS = 'masters', OUT = 'public/photos', FILM_OUT = 'public/film', DATA = 'src/data/photos';
// The 700px "film" frames live in public/film (committed, served from the site's own origin: the home roll and the
// negatives sheet read their pixels, which would need CORS on external storage). Everything else goes to public/photos.
const WIDTHS = [800, 1400, 2200], FILM = 700;
const BW_THRESHOLD = 0.05; // same as isBW() in the prototype: mean (max-min)/255 over a 24×24 thumb

const args = process.argv.slice(2);
const PRUNE_FILM = args.includes('--prune-film');
const only = args.filter((a) => !a.startsWith('--'));
const slugs = only.length
  ? only
  : (await readdir(MASTERS, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);

async function analyse(buf) {
  const { data } = await sharp(buf).rotate().resize(24, 24, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let s = 0;
  for (let i = 0; i < data.length; i += 3) s += Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
  const bw = s / 576 / 255 < BW_THRESHOLD;
  const bh = await sharp(buf).rotate().resize(32, 32, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const blurhash = encode(new Uint8ClampedArray(bh.data), bh.info.width, bh.info.height, 4, 3);
  return { bw, blurhash };
}

for (const slug of slugs) {
  const dir = join(MASTERS, slug);
  if (!existsSync(dir)) { console.warn(`skip ${slug}: no ${dir}`); continue; }
  const files = (await readdir(dir)).filter((f) => /\.jpe?g$/i.test(f)).sort();
  const dataPath = join(DATA, `${slug}.json`);
  const prev = existsSync(dataPath) ? JSON.parse(await readFile(dataPath, 'utf8')).photos : {};
  const outDir = join(OUT, slug);
  const filmDir = join(FILM_OUT, slug);
  await mkdir(outDir, { recursive: true }); await mkdir(filmDir, { recursive: true }); await mkdir(DATA, { recursive: true });
  const outPath = (base, hash, n, e) => join(n === 'film' ? filmDir : outDir, `${base}-${hash.slice(0, 8)}-${n}.${e}`);
  const photos = {}, keep = { photos: new Set(), film: new Set() };
  for (const f of files) {
    const buf = await readFile(join(dir, f));
    const hash = createHash('sha1').update(buf).digest('hex').slice(0, 12);
    const base = f.replace(/\.[^.]+$/, '');
    const wanted = [...WIDTHS.flatMap((w) => [[w, 'avif'], [w, 'webp']]), [FILM, 'webp']].map(([w, e]) => [w === FILM ? 'film' : w, w, e]);
    for (const [n, , e] of wanted) (n === 'film' ? keep.film : keep.photos).add(`${base}-${hash.slice(0, 8)}-${n}.${e}`);
    if (prev[f]?.hash === hash && wanted.every(([n, , e]) => existsSync(outPath(base, hash, n, e)))) { photos[f] = prev[f]; continue; }
    const img = sharp(buf).rotate();
    const { width, height } = await img.metadata().then(async (m) => (m.orientation >= 5 ? { width: m.height, height: m.width } : { width: m.width, height: m.height }));
    for (const [n, w, e] of wanted) {
      const p = img.clone().resize({ width: w, withoutEnlargement: true });
      await (e === 'avif' ? p.avif({ quality: 55, effort: 4 }) : p.webp({ quality: 80 })).toFile(outPath(base, hash, n, e));
    }
    photos[f] = { w: width, h: height, portrait: height > width * 1.05, hash, ...(await analyse(buf)) };
    console.log(`${slug}/${f}`);
  }
  await writeFile(dataPath, JSON.stringify({ photos }, null, 2) + '\n');
  // orphans: variants of photos that were removed or replaced (old hash)
  for (const [dirPath, wanted, kind] of [[outDir, keep.photos, 'photos'], [filmDir, keep.film, 'film']]) {
    const orphans = (await readdir(dirPath)).filter((n) => !wanted.has(n));
    if (!orphans.length) continue;
    if (kind === 'photos' || PRUNE_FILM) { await Promise.all(orphans.map((n) => rm(join(dirPath, n)))); console.log(`  pruned ${orphans.length} orphan file(s) from ${dirPath}`); }
    else console.log(`  ${orphans.length} orphan file(s) in ${dirPath} (committed; re-run with --prune-film to delete): ${orphans.slice(0, 4).join(', ')}${orphans.length > 4 ? '…' : ''}`);
  }
  console.log(`✓ ${slug}: ${files.length} photos`);
}
