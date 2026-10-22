// pnpm redirects — redirects.csv (old,new) + the old section pages → the `redirects` list in vercel.json.
// The old Adobe Portfolio site had one page per shooting at /<slug>; the new one lives at /<section>/<slug>/.
// Everything else in vercel.json (headers, trailingSlash…) is kept as it is.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// old section pages have no direct equivalent: the Archive lists every shoot by section
const SECTION_PAGES = { '/models': '/archive/', '/projects': '/archive/', '/work': '/archive/', '/erotic': '/archive/' };

const rows = (await readFile('redirects.csv', 'utf8')).trim().split('\n').slice(1).map((l) => l.split(','));
const pairs = [...rows.map(([from, to]) => [from, to.endsWith('/') ? to : `${to}/`]), ...Object.entries(SECTION_PAGES)];

const bad = pairs.filter(([, to]) => to !== '/archive/' && !existsSync(`src/content/shooting/${to.split('/')[2]}/index.md`));
if (bad.length) { console.error('targets without a shooting:', bad); process.exit(1); }

const config = existsSync('vercel.json') ? JSON.parse(await readFile('vercel.json', 'utf8')) : {};
config.redirects = pairs.map(([source, destination]) => ({ source, destination, permanent: true }));
await writeFile('vercel.json', JSON.stringify(config, null, 2) + '\n');
console.log(`${pairs.length} redirects → vercel.json`);
