// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // canonical URLs, sitemap and Open Graph all need the public address
  site: process.env.SITE_URL ?? 'https://photos.canellariccardo.it',
  integrations: [sitemap({ filter: (page) => !page.endsWith('/404/') })],
});
