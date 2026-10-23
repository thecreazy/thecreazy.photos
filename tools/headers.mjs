// pnpm headers — rewrites the `headers` list of vercel.json (security headers, CSP Report-Only, cache rules).
// The CSP names the photo CDN from PUBLIC_PHOTO_BASE_URL (env, else .env.example) and the sha256 of Base.astro's inline script.
// Re-run after changing either. Everything else in vercel.json (redirects, trailingSlash…) is kept as it is.
import { readFile, writeFile } from 'node:fs/promises';
import { cdnOrigin, headers } from './lib/headers.mjs';

const config = JSON.parse(await readFile('vercel.json', 'utf8'));
config.headers = headers();
await writeFile('vercel.json', JSON.stringify(config, null, 2) + '\n');
console.log(`headers → vercel.json (photo CDN origin: ${cdnOrigin() || 'none, same-origin photos'})`);
