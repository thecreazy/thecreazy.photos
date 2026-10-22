// pnpm foto [slug...]  — masters/<slug>/*.jpg → public/photos/<slug>/ + src/data/photos/<slug>.json
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { encode } from 'blurhash';

const MASTERS = 'masters', OUT = 'public/photos', DATA = 'src/data/photos';
const WIDTHS = [800, 1400, 2200], FILM = 700;
const BW_THRESHOLD = 0.05; // same as isBW() in the prototype: mean (max-min)/255 over a 24×24 thumb

const slugs = process.argv.slice(2).length
  ? process.argv.slice(2)
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
  await mkdir(outDir, { recursive: true }); await mkdir(DATA, { recursive: true });
  const photos = {};
  for (const f of files) {
    const buf = await readFile(join(dir, f));
    const hash = createHash('sha1').update(buf).digest('hex').slice(0, 12);
    const base = f.replace(/\.[^.]+$/, '');
    const wanted = [...WIDTHS.flatMap((w) => [[w, 'avif'], [w, 'webp']]), [FILM, 'webp']].map(([w, e]) => [w === FILM ? 'film' : w, w, e]);
    if (prev[f]?.hash === hash && wanted.every(([n, , e]) => existsSync(join(outDir, `${base}-${n}.${e}`)))) { photos[f] = prev[f]; continue; }
    const img = sharp(buf).rotate();
    const { width, height } = await img.metadata().then(async (m) => (m.orientation >= 5 ? { width: m.height, height: m.width } : { width: m.width, height: m.height }));
    for (const [n, w, e] of wanted) {
      const p = img.clone().resize({ width: w, withoutEnlargement: true });
      await (e === 'avif' ? p.avif({ quality: 55, effort: 4 }) : p.webp({ quality: 80 })).toFile(join(outDir, `${base}-${n}.${e}`));
    }
    photos[f] = { w: width, h: height, portrait: height > width * 1.05, hash, ...(await analyse(buf)) };
    console.log(`${slug}/${f}`);
  }
  await writeFile(dataPath, JSON.stringify({ photos }, null, 2) + '\n');
  console.log(`✓ ${slug}: ${files.length} photos`);
}
