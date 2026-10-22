// pnpm migrate [--site https://photos.canellariccardo.it]
// One-off: scrapes the current Adobe Portfolio site → draft src/content/shooting/<slug>/index.md + redirects.csv
// Same logic as scrapeSite() in reference/rullino.html. Never invents film/notes: those stay empty.
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as cheerio from 'cheerio';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SITE = arg('--site', 'https://photos.canellariccardo.it').replace(/\/$/, '');
const SECTIONS = [['models', '/models'], ['projects', '/projects'], ['travels', '/work'], ['erotic', '/erotic']];
// manual fixes by old slug: { name, title, date, section, hide }
const OVERRIDES = {};

const titleCase = (s) => s.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
function parseTitle(raw) {
  let t = raw.replace(/\s*\d{4}\s*$/, '').trim(), date = '';
  const parts = t.split(/\s[-–—]\s/);
  if (parts.length > 1 && /^\d{4}$/.test(parts[0].trim())) date = parts.shift().trim();
  let name = parts.shift().trim(); const title = parts.join(' — ').trim();
  if (name.length > 3 && name === name.toUpperCase() && /[A-Z]/.test(name)) name = titleCase(name);
  return { name, title, date };
}
const get = async (u) => { const r = await fetch(new URL(u, SITE)); if (!r.ok) throw new Error(`${r.status} ${u}`); return cheerio.load(await r.text()); };
const q = (s) => JSON.stringify(s);

const lists = {};
for (const [sec, path] of SECTIONS) {
  const $ = await get(path);
  lists[sec] = $('a.project-cover').map((_, a) => ({
    href: $(a).attr('href'),
    title: ($(a).find('.title').text() || $(a).text()).trim().replace(/\s+/g, ' '),
    date: $(a).find('.date').text().trim(),
  })).get();
}
const ero = new Set(lists.erotic.map((p) => p.href));
lists.models = lists.models.filter((p) => !ero.has(p.href)); // in both Models and Erotics → Erotics

const all = SECTIONS.flatMap(([sec]) => lists[sec].map((p) => ({ ...p, section: sec })));
const redirects = ['old,new'];
let n = 0;
for (const p of all) {
  const slug = p.href.replace(/^\//, '');
  const o = OVERRIDES[slug] ?? {};
  if (o.hide) continue;
  let imgs = [];
  try {
    const $ = await get(p.href); const seen = new Set();
    $('img[data-src]').each((_, im) => {
      if ($(im).closest('.project-covers, a.project-cover').length) return;
      const s = $(im).attr('data-src'); if (!s || seen.has(s) || !s.includes('myportfolio')) return; seen.add(s); imgs.push(s);
    });
  } catch (e) { console.warn(`! ${slug}: ${e.message}`); }
  if (!imgs.length) continue;
  const t = parseTitle(p.title);
  const name = o.name ?? t.name, title = o.title ?? t.title, section = o.section ?? p.section;
  const raw = o.date ?? (p.date || t.date); const date = /^\d{4}(-\d{2})?$/.test(raw) ? raw : (raw.match(/\d{4}/)?.[0] ?? '');
  const dir = `src/content/shooting/${slug}`, file = `${dir}/index.md`;
  if (existsSync(file)) { console.log(`= ${slug} (exists, kept)`); continue; }
  await mkdir(dir, { recursive: true });
  const fm = [
    `name: ${q(name)}`, title ? `title: ${q(title)}` : '# title:', `date: ${q(date || 'FIXME')}`, `section: ${section}`,
    '# stock:', '# bw:', 'home: true', `order: ${100 + n++}`, '# selected: [1, 2, 3]', '# hero: 1',
    'photos:', ...imgs.map((_, i) => `  - ${String(i + 1).padStart(2, '0')}.jpg`), '# note: ""',
  ].join('\n');
  await writeFile(file, `---\n${fm}\n---\n`);
  redirects.push(`${p.href},/${section}/${slug}`);
  console.log(`+ ${section}/${slug}  (${imgs.length} photos)`);
}
await writeFile('redirects.csv', redirects.join('\n') + '\n');
console.log(`\n${n} drafts written. Masters go in masters/<slug>/01.jpg … in the order above, then run: pnpm foto`);
