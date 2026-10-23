// pnpm check [--strict] — fails the build (prebuild) when content, photo data and deploy config disagree:
//  · every shooting: valid frontmatter, every listed photo has metadata in src/data/photos/<slug>.json and a film frame in public/film,
//    `selected`/`hero` in range, text inside the Latin font subset
//  · vercel.json: redirect targets exist, the CSP names Base.astro's inline script and the photo CDN
// Warnings (legacy un-hashed file names, missing local variants) don't fail unless --strict is given.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { cdnOrigin, scriptHash } from './lib/headers.mjs';

const STRICT = process.argv.includes('--strict');
const SECTIONS = ['models', 'projects', 'travels', 'erotic'];
const errors = [], warnings = [];
const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
// what the latin subsets of the site fonts cover that we use (Latin-1, general punctuation, €, ™)
const latin = (s) => [...s].every((c) => { const n = c.codePointAt(0); return n <= 0xff || (n >= 0x2000 && n <= 0x206f) || n === 0x20ac || n === 0x2122; });
const unq = (v) => v.trim().replace(/^(["'])(.*)\1$/, '$2');

function frontmatter(slug) {
  const md = readFileSync(`src/content/shooting/${slug}/index.md`, 'utf8');
  const body = md.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const lines = body.split('\n').filter((l) => !l.startsWith('#'));
  const fm = { photos: [] };
  let inPhotos = false;
  for (const l of lines) {
    if (/^photos:\s*$/.test(l)) { inPhotos = true; continue; }
    const item = l.match(/^\s+-\s+(.+)$/);
    if (inPhotos && item) { fm.photos.push(unq(item[1])); continue; }
    inPhotos = false;
    const kv = l.match(/^(\w+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2];
  }
  return fm;
}

let legacy = 0, total = 0, noVariants = 0;
const slugs = readdirSync('src/content/shooting', { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
for (const slug of slugs) {
  const at = (m) => `${slug}: ${m}`;
  const fm = frontmatter(slug);
  if (!fm.name) err(at('missing name'));
  if (!/^["']?\d{4}(-\d{2})?["']?$/.test(fm.date ?? '')) err(at(`date "${fm.date}" must be YYYY or YYYY-MM`));
  if (!SECTIONS.includes(unq(fm.section ?? ''))) err(at(`section "${fm.section}" is not one of ${SECTIONS.join(', ')}`));
  if (fm.noindex !== undefined && !/^(true|false)$/.test(fm.noindex)) err(at('noindex must be true or false'));
  for (const k of ['name', 'title', 'note']) if (fm[k] && !latin(fm[k])) err(at(`${k} has characters outside the Latin font subset (add the latin-ext imports in Base.astro, then relax this check)`));
  if (!fm.photos.length) err(at('no photos'));
  if (new Set(fm.photos).size !== fm.photos.length) err(at('duplicate photos in the list'));
  const sel = fm.selected ? [...fm.selected.matchAll(/\d+/g)].map((m) => +m[0]) : [];
  if (fm.selected && (sel.length < 1 || sel.length > 3)) err(at('selected must have 1 to 3 entries'));
  if (sel.some((i) => i < 1 || i > fm.photos.length)) err(at('selected: index out of range'));
  if (fm.hero && (+fm.hero < 1 || +fm.hero > fm.photos.length)) err(at('hero: index out of range'));

  const dataPath = `src/data/photos/${slug}.json`;
  if (!existsSync(dataPath)) { err(at(`no ${dataPath} (run pnpm foto ${slug})`)); continue; }
  const meta = JSON.parse(readFileSync(dataPath, 'utf8')).photos;
  for (const f of fm.photos) {
    total++;
    const m = meta[f];
    if (!m) { err(at(`${f} has no metadata in ${dataPath} (run pnpm foto ${slug})`)); continue; }
    const stem = f.replace(/\.[^.]+$/, '');
    if (existsSync(`public/film/${slug}/${stem}-${m.hash.slice(0, 8)}-film.webp`)) { /* hashed: current layout */ }
    else if (existsSync(`public/film/${slug}/${stem}-film.webp`)) legacy++;
    else err(at(`no film frame for ${f} in public/film/${slug}/ (run pnpm foto ${slug})`));
    if (existsSync(`public/photos/${slug}`) && !existsSync(`public/photos/${slug}/${stem}-${m.hash.slice(0, 8)}-1400.webp`)) noVariants++;
  }
}
if (legacy) {
  const m = `${legacy} of ${total} film frames still have the old un-hashed name: run \`pnpm hashnames\` (the site now links the hashed names)`;
  STRICT ? err(m) : warn(m);
}

if (noVariants) warn(`${noVariants} photos have no hashed 1400px variant in the local public/photos (pnpm hashnames, or pnpm foto): local images would 404`);

// deploy config
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
for (const r of vercel.redirects ?? []) {
  const to = r.destination, slug = to.split('/')[2];
  const ok = to === '/archive/' || to === '/sitemap-index.xml' || existsSync(`src/content/shooting/${slug}/index.md`);
  if (!ok) err(`vercel.json: redirect ${r.source} → ${to} points at nothing (pnpm redirects)`);
}
const csp = vercel.headers?.flatMap((h) => h.headers).find((h) => /^Content-Security-Policy/.test(h.key))?.value;
if (!csp) err('vercel.json: no Content-Security-Policy(-Report-Only) header (pnpm headers)');
else {
  if (!csp.includes(`'${scriptHash()}'`)) err("vercel.json: CSP script hash doesn't match the inline script in Base.astro (pnpm headers)");
  const origin = cdnOrigin();
  if (origin && !csp.includes(origin)) err(`vercel.json: CSP doesn't allow the photo CDN ${origin} (pnpm headers)`);
}

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);
console.log(`check: ${slugs.length} shootings, ${total} photos, ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
