// Response headers for vercel.json, shared by tools/headers.mjs (writes them) and tools/check.mjs (verifies them).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const IMMUTABLE = 'public, max-age=31536000, immutable';
const DAY = 'public, max-age=86400, stale-while-revalidate=604800';

/** The inline <script is:inline> of Base.astro: its sha256 goes into the CSP (the rest of the scripts are external files). */
export function inlineScript() {
  const m = readFileSync('src/layouts/Base.astro', 'utf8').match(/<script is:inline>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no <script is:inline> found in src/layouts/Base.astro');
  return m[1];
}
export const scriptHash = () => `sha256-${createHash('sha256').update(inlineScript()).digest('base64')}`;

/** Origin of the photo CDN: PUBLIC_PHOTO_BASE_URL from the environment, else the one in .env.example. Empty when photos are same-origin. */
export function cdnOrigin() {
  let url = process.env.PUBLIC_PHOTO_BASE_URL;
  if (!url && existsSync('.env.example')) url = readFileSync('.env.example', 'utf8').match(/^PUBLIC_PHOTO_BASE_URL=(\S+)/m)?.[1];
  try { return new URL(url ?? '').origin; } catch { return ''; }
}

export function csp(origin = cdnOrigin()) {
  const cdn = origin ? ` ${origin}` : '';
  return [
    "default-src 'self'",
    `script-src 'self' '${scriptHash()}'`,
    "style-src 'self' 'unsafe-inline'", // inline style="" attributes and the runtime textures set as CSS variables
    `img-src 'self' data: blob:${cdn}`,
    "font-src 'self'",
    `connect-src 'self'${cdn}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function headers() {
  const h = (key, value) => ({ key, value });
  return [
    {
      source: '/(.*)',
      headers: [
        h('X-Content-Type-Options', 'nosniff'),
        h('Referrer-Policy', 'strict-origin-when-cross-origin'),
        h('X-Frame-Options', 'DENY'),
        h('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()'),
        // Report-Only first: watch the browser console on a preview deploy, then rename the key to Content-Security-Policy (docs/GO-LIVE.md)
        h('Content-Security-Policy-Report-Only', csp()),
      ],
    },
    { source: '/_astro/(.*)', headers: [h('Cache-Control', IMMUTABLE)] }, // hashed by Vite
    { source: '/film/(.*)', headers: [h('Cache-Control', IMMUTABLE)] }, // hashed by tools/foto.mjs
    { source: '/og/(.*)', headers: [h('Cache-Control', DAY)] },
  ];
}
