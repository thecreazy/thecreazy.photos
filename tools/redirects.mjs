// pnpm redirects — redirects.csv (old,new) + the old section pages → the `redirects` list in vercel.json.
// The old Adobe Portfolio site had one page per shooting at /<slug>; the new one lives at /<section>/<slug>/.
// With `trailingSlash: true` Vercel may or may not match a slash-less source after its own slash redirect, so every
// page-like source is emitted in both forms (/old and /old/). Everything else in vercel.json (headers…) is kept as it is.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// old section pages have no direct equivalent: the Archive lists every shoot by section
const SECTION_PAGES = { '/models': '/archive/', '/projects': '/archive/', '/work': '/archive/', '/erotic': '/archive/' };
// files the old site served that the new one names differently (no slash variants: they are files)
const FILES = { '/sitemap.xml': '/sitemap-index.xml' };

const rows = (await readFile('redirects.csv', 'utf8')).trim().split('\n').slice(1).map((l) => l.split(','));
const pairs = [...rows.map(([from, to]) => [from, to.endsWith('/') ? to : `${to}/`]), ...Object.entries(SECTION_PAGES)];

const bad = pairs.filter(([, to]) => to !== '/archive/' && !existsSync(`src/content/shooting/${to.split('/')[2]}/index.md`));
if (bad.length) { console.error('targets without a shooting:', bad); process.exit(1); }

const both = pairs.flatMap(([from, to]) => { const bare = from.replace(/\/$/, ''); return [[bare, to], [`${bare}/`, to]]; });
const config = existsSync('vercel.json') ? JSON.parse(await readFile('vercel.json', 'utf8')) : {};
config.redirects = [...both, ...Object.entries(FILES)].map(([source, destination]) => ({ source, destination, permanent: true }));
await writeFile('vercel.json', JSON.stringify(config, null, 2) + '\n');
console.log(`${config.redirects.length} redirects → vercel.json (${pairs.length} pages in both slash forms + ${Object.keys(FILES).length} file)`);
