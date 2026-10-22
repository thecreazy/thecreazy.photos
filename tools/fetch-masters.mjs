// pnpm masters [slug...] [--site https://photos.canellariccardo.it]
// Stopgap: downloads the photos currently on the Adobe Portfolio site into masters/<slug>/NN.jpg
// (same order and dedupe as `pnpm migrate`, so the names match the `photos:` list in each index.md).
// Adobe serves up to 3840 px wide: more than the pipeline needs. Replace with real originals whenever available.
// Existing files are skipped, so it can be re-run.
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as cheerio from 'cheerio';

const argv = process.argv.slice(2);
const si = argv.indexOf('--site');
const SITE = (si >= 0 ? argv[si + 1] : 'https://photos.canellariccardo.it').replace(/\/$/, '');
const only = argv.filter((a, i) => !a.startsWith('--') && (si < 0 || i !== si + 1));
const slugs = only.length
  ? only
  : (await readdir('src/content/shooting', { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);

const CONCURRENCY = 4;

async function withRetry(fn, tries = 3) {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) { if (i >= tries) throw e; await new Promise((r) => setTimeout(r, 800 * i)); }
  }
}

async function pageImages(slug) {
  const html = await withRetry(async () => {
    const r = await fetch(`${SITE}/${slug}`);
    if (!r.ok) throw new Error(`${r.status} /${slug}`);
    return r.text();
  });
  const $ = cheerio.load(html), seen = new Set(), imgs = [];
  $('img[data-src]').each((_, im) => {
    if ($(im).closest('.project-covers, a.project-cover').length) return;
    const s = $(im).attr('data-src');
    if (!s || seen.has(s) || !s.includes('myportfolio')) return;
    seen.add(s); imgs.push(s);
  });
  return imgs;
}

let done = 0, skipped = 0, failed = 0;
for (const slug of slugs) {
  let imgs;
  try { imgs = await pageImages(slug); } catch (e) { console.warn(`! ${slug}: ${e.message}`); failed++; continue; }
  const dir = `masters/${slug}`;
  await mkdir(dir, { recursive: true });
  const jobs = imgs.map((url, i) => ({ url, file: `${dir}/${String(i + 1).padStart(2, '0')}.jpg` }));
  let next = 0, got = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < jobs.length) {
      const j = jobs[next++];
      if (existsSync(j.file)) { skipped++; continue; }
      try {
        const buf = await withRetry(async () => {
          const r = await fetch(j.url);
          if (!r.ok) throw new Error(`${r.status}`);
          return Buffer.from(await r.arrayBuffer());
        });
        await writeFile(j.file, buf); got++; done++;
      } catch (e) { console.warn(`! ${j.file}: ${e.message}`); failed++; }
    }
  }));
  console.log(`✓ ${slug}: ${imgs.length} photos (${got} new)`);
}
console.log(`\n${done} downloaded, ${skipped} already there, ${failed} failed. Next: pnpm foto, then pnpm upload`);
