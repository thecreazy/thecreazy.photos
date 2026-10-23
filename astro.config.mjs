// @ts-check
import { readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const SITE = process.env.SITE_URL ?? 'https://photos.canellariccardo.it';
try { new URL(SITE); } catch { throw new Error(`SITE_URL is not a valid URL: "${SITE}"`); }

// shootings marked `noindex: true` in their frontmatter: the page gets a robots meta (Base.astro) and leaves the sitemap
const noindexPaths = new Set(
  readdirSync('src/content/shooting', { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => {
      const md = readFileSync(`src/content/shooting/${d.name}/index.md`, 'utf8');
      const section = md.match(/^section:\s*["']?(\w+)/m)?.[1];
      return /^noindex:\s*true\b/m.test(md) && section ? [`/${section}/${d.name}/`] : [];
    }),
);

// https://astro.build/config
export default defineConfig({
  trailingSlash: 'always', // same on Vercel (vercel.json): every page lives at /path/
  // canonical URLs, sitemap and Open Graph all need the public address
  site: SITE,
  integrations: [sitemap({ filter: (page) => !page.endsWith('/404/') && !noindexPaths.has(new URL(page).pathname) })],
});
