// Open Graph images (1200×630), generated at build time from the 700px film frames in public/film.
// satori turns the layout into SVG (text becomes paths, so no fonts are needed at render time), sharp rasterises it.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import { SITE_FRAMES } from '../config';
import { t } from '../i18n/en';
import { filmPath, type Shooting } from './shooting';

const W = 1200, H = 630;
const COL = { bg: '#0b0908', paper: '#f4efe6', light: '#efe7da', dim: '#8a8074', soft: '#a89e91', red: '#c4162a' };

const font = (pkg: string, file: string) => readFile(join(process.cwd(), 'node_modules/@fontsource', pkg, 'files', file));
let fonts: Promise<Parameters<typeof satori>[1]['fonts']> | null = null;
const loadFonts = () => (fonts ??= Promise.all([
  font('instrument-serif', 'instrument-serif-latin-400-normal.woff'),
  font('instrument-serif', 'instrument-serif-latin-400-italic.woff'),
  font('ibm-plex-mono', 'ibm-plex-mono-latin-500-normal.woff'),
]).then(([serif, serifItalic, mono]) => [
  { name: 'Serif', data: serif, weight: 400 as const, style: 'normal' as const },
  { name: 'Serif', data: serifItalic, weight: 400 as const, style: 'italic' as const },
  { name: 'Mono', data: mono, weight: 500 as const, style: 'normal' as const },
]));

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node =>
  ({ type, props: { style: { display: 'flex', ...style }, children, ...extra } });

/** A framed print of a film frame, fitted into a box. */
async function print(slug: string, file: string, box: [number, number], rotate: number, pos: Record<string, unknown> = {}) {
  const film = (p: string) => join(process.cwd(), 'public/film', p);
  // content-hashed name (tools/foto.mjs); the plain name only exists until `pnpm hashnames` has run
  const path = existsSync(film(filmPath(slug, file))) ? film(filmPath(slug, file)) : film(`${slug}/${file.replace(/\.[^.]+$/, '')}-film.webp`);
  const buf = await readFile(path);
  const { width = 3, height = 2 } = await sharp(buf).metadata();
  const k = Math.min(box[0] / width, box[1] / height), w = Math.round(width * k), hh = Math.round(height * k);
  const png = await sharp(buf).resize(w * 2, hh * 2).jpeg({ quality: 88 }).toBuffer();
  return h('div', {
    padding: 13, background: COL.paper, transform: `rotate(${rotate}deg)`,
    boxShadow: '0 18px 40px rgba(0,0,0,.6), 0 2px 6px rgba(0,0,0,.5)', ...pos,
  }, h('img', { width: w, height: hh }, undefined, { src: `data:image/jpeg;base64,${png.toString('base64')}`, width: w, height: hh }));
}

/** An undeveloped frame on a strip of film: used where the picture itself shouldn't be the preview. */
function blankStrip(rotate: number) {
  const perf = (side: 'left' | 'right') => h('div', { flexDirection: 'column', justifyContent: 'space-between', padding: '14px 0', [side]: 0 },
    Array.from({ length: 11 }, () => h('div', { width: 18, height: 30, background: '#f1ece1', borderRadius: 3 })));
  return h('div', {
    width: 400, height: 500, background: '#7a4524', transform: `rotate(${rotate}deg)`, padding: '0 12px', justifyContent: 'space-between',
    boxShadow: '0 18px 40px rgba(0,0,0,.6)',
  }, [
    perf('left'),
    h('div', { margin: '34px 6px', flex: 1, backgroundImage: 'radial-gradient(circle at 50% 42%, #d3a77f, #8e5a37 78%)', borderRadius: 3 }),
    perf('right'),
  ]);
}

function textColumn(eyebrow: string, name: string, title?: string, size = 92) {
  return h('div', { flexDirection: 'column', justifyContent: 'space-between', width: 460, height: 470, marginLeft: 50, flexShrink: 0 }, [
    h('div', { flexDirection: 'column', width: 460 }, [
      h('div', { fontFamily: 'Mono', fontSize: 22, letterSpacing: 5, color: COL.dim, textTransform: 'uppercase' }, eyebrow),
      h('div', { fontFamily: 'Serif', fontSize: size, lineHeight: 1.0, color: COL.light, marginTop: 26, letterSpacing: -1 }, name),
      title ? h('div', { fontFamily: 'Serif', fontStyle: 'italic', fontSize: 46, lineHeight: 1.1, color: COL.soft, marginTop: 14 }, title) : h('div', {}),
      h('div', { width: 130, height: 6, background: COL.red, borderRadius: 3, marginTop: 34, transform: 'rotate(-1.5deg)' }),
    ]),
    h('div', { alignItems: 'baseline' }, [
      h('div', { fontFamily: 'Serif', fontSize: 34, color: COL.light }, t.brand),
      h('div', { fontFamily: 'Mono', fontSize: 17, letterSpacing: 4, color: COL.dim, marginLeft: 16, textTransform: 'uppercase' }, t.brandSub),
    ]),
  ]);
}

async function render(left: Node | Node[], right: Node): Promise<Buffer> {
  const tree = h('div', {
    width: W, height: H, alignItems: 'center', background: COL.bg,
    backgroundImage: 'radial-gradient(circle at 30% 45%, #2a221c, #0b0908 75%)',
  }, [h('div', { width: 570, height: 520, marginLeft: 70, flexShrink: 0, alignItems: 'center', justifyContent: 'center', position: 'relative' }, left), right]);
  const svg = await satori(tree as never, { width: W, height: H, fonts: await loadFonts() });
  return sharp(Buffer.from(svg)).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
}

/** One preview per shooting. Erotics never show the picture: an undeveloped frame stands in. */
export async function shootingOg(s: Shooting): Promise<Buffer> {
  const left = s.section === 'erotic'
    ? blankStrip(-3)
    : await print(s.slug, s.photos[s.hero - 1], [440, 480], -2.5);
  const name = s.name.length > 16 ? 70 : 92;
  return render(left, textColumn(`${t.sections[s.section]} · ${s.date}`, s.name, s.title, name));
}

/** Frames (slug, 1-based photo number) fanned on the site-wide preview: safe, varied, from the work itself. */

export async function siteOg(all: Shooting[]): Promise<Buffer> {
  const frames = SITE_FRAMES.map(([slug, n]) => ({ slug, file: all.find((s) => s.slug === slug)?.photos[n - 1] })).filter((f) => f.file);
  const spots: [number, [number, number], number, Record<string, unknown>][] = [
    [-8, [260, 330], 0, { position: 'absolute', left: 10, top: 130 }],
    [2, [270, 330], 0, { position: 'absolute', left: 130, top: 40 }],
    [9, [260, 330], 0, { position: 'absolute', left: 210, top: 150 }],
  ];
  const prints = await Promise.all(frames.map((f, i) => print(f.slug, f.file!, spots[i][1], spots[i][0], spots[i][3])));
  return render(prints, textColumn(t.og.eyebrow, t.brand, t.og.tagline, 96));
}
