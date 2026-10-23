import { getCollection, type CollectionEntry } from 'astro:content';
import { SECTIONS } from '../content.config';
import { t } from '../i18n/en';

export interface PhotoMeta {
  w: number;
  h: number;
  portrait: boolean;
  bw: boolean;
  blurhash: string;
  hash: string;
}
export interface PhotoData {
  photos: Record<string, PhotoMeta>;
}

const rawBase = import.meta.env.PUBLIC_PHOTO_BASE_URL;
// a production build without the variable would silently point every image at /photos, which is not in git
if (import.meta.env.PROD && !rawBase) {
  throw new Error('PUBLIC_PHOTO_BASE_URL is not set: set it to the photo CDN (or /photos to serve public/photos) before building.');
}
export const PHOTO_BASE = (rawBase ?? '/photos').replace(/\/+$/, '');
export const WIDTHS = [800, 1400, 2200] as const;

const dataFiles = import.meta.glob<PhotoData>('../data/photos/*.json', { eager: true, import: 'default' });
const dataFor = (slug: string): PhotoData | undefined => dataFiles[`../data/photos/${slug}.json`];

/**
 * File stem of a photo's variants: `01` → `01-<first 8 chars of the master's sha1>`. Names change when the master does,
 * so the CDN and browsers can cache variants for a year (see tools/foto.mjs). Photos without metadata keep the plain stem.
 */
export function variantStem(slug: string, file: string) {
  const stem = file.replace(/\.[^.]+$/, '');
  const hash = dataFor(slug)?.photos[file]?.hash;
  return hash ? `${stem}-${hash.slice(0, 8)}` : stem;
}

export const photoUrl = (slug: string, file: string, w: number, ext: 'avif' | 'webp') =>
  `${PHOTO_BASE}/${slug}/${variantStem(slug, file)}-${w}.${ext}`;

/** Path of the 700px frame inside `public/film` (also read by og.ts). */
export const filmPath = (slug: string, file: string) => `${slug}/${variantStem(slug, file)}-film.webp`;

/** 700px frame for the roll and the negatives sheet: always same-origin (`public/film`), because their pixels are read on a canvas. */
export const filmUrl = (slug: string, file: string) => `/film/${filmPath(slug, file)}`;

const placeholders = new Map<string, Promise<string | undefined>>();
/**
 * Inline `style` for a print's <img>: a ~100-byte blurred version of the photo (from the stored blurhash) as its background,
 * so the paper isn't blank while the real file loads. Empty when the photo has no blurhash.
 * Usage in PrintFigure.astro: `<img style={await blurStyle(s.slug, file)} … />`.
 */
export function blurStyle(slug: string, file: string): Promise<string | undefined> {
  const key = `${slug}/${file}`;
  let p = placeholders.get(key);
  if (!p) {
    const bh = dataFor(slug)?.photos[file]?.blurhash;
    p = bh ? blurDataUrl(bh).then((u) => `background:#d9d4c8 url(${u}) center/cover`) : Promise.resolve(undefined);
    placeholders.set(key, p);
  }
  return p;
}
async function blurDataUrl(hash: string) {
  const [{ decode }, { default: sharp }] = await Promise.all([import('blurhash'), import('sharp')]);
  const w = 16, h = 16;
  const webp = await sharp(Buffer.from(decode(hash, w, h)), { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 40 }).toBuffer();
  return `data:image/webp;base64,${webp.toString('base64')}`;
}

/** Fills in defaults so the frontmatter only states what Riccardo chose. */
export function resolveShooting(entry: CollectionEntry<'shooting'>) {
  const d = entry.data;
  const meta = dataFor(entry.id)?.photos ?? {};
  const files = d.photos;
  const selected = (d.selected ?? [1, 2, 3]).filter((i) => i <= files.length);
  const bw = d.bw ?? (files[selected[0] - 1] ? meta[files[selected[0] - 1]]?.bw : undefined);
  return {
    slug: entry.id,
    ...d,
    selected,
    hero: d.hero ?? selected[0],
    bw,
    // never invent film data: only fall back to the B&W/COLOR deduction when the photos are known
    stockLabel: d.stock ?? (bw === undefined ? undefined : bw ? t.stock.bw : t.stock.color),
    meta,
  };
}
export type Shooting = ReturnType<typeof resolveShooting>;

/** All shootings, ordered by section then `order`, then newest first. */
export async function getShootings(): Promise<Shooting[]> {
  const all = (await getCollection('shooting')).map(resolveShooting);
  return all.sort(
    (a, b) =>
      SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) ||
      a.order - b.order ||
      b.date.localeCompare(a.date),
  );
}
