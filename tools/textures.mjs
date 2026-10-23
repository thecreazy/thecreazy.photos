// Pre-renders the kraft / paper / grain textures to public/tex/*.jpg (committed).
// Port of makeTextures() from the prototype, but canvas-free (pure JS rasteriser + sharp) and seeded,
// so the output is deterministic. Run with `pnpm textures`; only needed when the recipe changes.
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { rng } from '../src/lib/rng.ts';

const TAU = Math.PI * 2;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Float RGB canvas. */
function canvas(w, h, fill) {
  const px = new Float32Array(w * h * 3);
  const [r, g, b] = hex(fill);
  for (let i = 0; i < w * h; i++) { px[i * 3] = r; px[i * 3 + 1] = g; px[i * 3 + 2] = b; }
  return { w, h, px };
}

const blend = (c, i, col, a) => { for (let k = 0; k < 3; k++) c.px[i * 3 + k] += (col[k] - c.px[i * 3 + k]) * a; };

/** Thin random strokes (paper fibres). */
function fibres(c, rand, n, col, maxA, len) {
  const rgb = hex(col);
  for (let s = 0; s < n; s++) {
    const a = rand() * maxA, lw = rand() * 1.3 + 0.3;
    const x0 = rand() * c.w, y0 = rand() * c.h, ang = rand() * TAU, l = rand() * len + 2;
    const dx = Math.cos(ang) * l, dy = Math.sin(ang) * l, ll = dx * dx + dy * dy || 1;
    const xa = Math.max(0, Math.floor(Math.min(x0, x0 + dx) - lw - 1)), xb = Math.min(c.w - 1, Math.ceil(Math.max(x0, x0 + dx) + lw + 1));
    const ya = Math.max(0, Math.floor(Math.min(y0, y0 + dy) - lw - 1)), yb = Math.min(c.h - 1, Math.ceil(Math.max(y0, y0 + dy) + lw + 1));
    for (let y = ya; y <= yb; y++)
      for (let x = xa; x <= xb; x++) {
        const t = Math.min(1, Math.max(0, ((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / ll));
        const d = Math.hypot(x + 0.5 - (x0 + dx * t), y + 0.5 - (y0 + dy * t));
        const cov = Math.min(1, Math.max(0, lw / 2 + 0.5 - d));
        if (cov > 0) blend(c, y * c.w + x, rgb, a * cov);
      }
  }
}

// Abramowitz–Stegun erf, for the profile of a disc blurred with a gaussian
const erf = (x) => {
  const s = Math.sign(x), t = 1 / (1 + 0.3275911 * Math.abs(x));
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
};

/** Soft, wrapping blotches (the original blurred discs with `blur(28px)`). */
function mottle(c, rand, col, n, maxA) {
  const rgb = hex(col), SIGMA = 28;
  for (let s = 0; s < n; s++) {
    const a = rand() * maxA, cx = rand() * c.w, cy = rand() * c.h, r = 30 + rand() * 90;
    const reach = Math.ceil(r + SIGMA * 3);
    for (let oy = -reach; oy <= reach; oy++)
      for (let ox = -reach; ox <= reach; ox++) {
        const d = Math.hypot(ox, oy);
        if (d > reach) continue;
        const cov = 0.5 * (1 - erf((d - r) / (SIGMA * Math.SQRT2)));
        if (cov < 0.002) continue;
        const x = (((Math.round(cx) + ox) % c.w) + c.w) % c.w, y = (((Math.round(cy) + oy) % c.h) + c.h) % c.h;
        blend(c, y * c.w + x, rgb, a * cov);
      }
  }
}

async function save(c, name, quality = 86) {
  const raw = Buffer.from(c.px.map((v) => Math.max(0, Math.min(255, Math.round(v)))));
  await sharp(raw, { raw: { width: c.w, height: c.h, channels: 3 } }).jpeg({ quality, mozjpeg: true }).toFile(`public/tex/${name}.jpg`);
  console.log(`public/tex/${name}.jpg`);
}

await mkdir('public/tex', { recursive: true });

const rand = rng(0x5eed);

const kraft = canvas(600, 600, '#b58f63');
mottle(kraft, rand, '#7a5634', 26, 0.18); mottle(kraft, rand, '#e0c49a', 18, 0.16);
fibres(kraft, rand, 5200, '#4a301a', 0.14, 16); fibres(kraft, rand, 1600, '#f3e1c0', 0.12, 12);
await save(kraft, 'kraft');

const paper = canvas(500, 500, '#f4f1ea');
mottle(paper, rand, '#d9d1c2', 10, 0.12); fibres(paper, rand, 900, '#8a7f6f', 0.07, 6);
await save(paper, 'paper');

const grain = canvas(256, 256, '#808080');
for (let i = 0; i < 256 * 256; i++) { const v = 128 + (rand() - 0.5) * 90; grain.px[i * 3] = grain.px[i * 3 + 1] = grain.px[i * 3 + 2] = v; }
await save(grain, 'grain', 90);
