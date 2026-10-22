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

export const PHOTO_BASE = import.meta.env.PUBLIC_PHOTO_BASE_URL ?? '/photos';
export const WIDTHS = [800, 1400, 2200] as const;

const dataFiles = import.meta.glob<PhotoData>('../data/photos/*.json', { eager: true, import: 'default' });
const dataFor = (slug: string): PhotoData | undefined => dataFiles[`../data/photos/${slug}.json`];

export const photoUrl = (slug: string, file: string, w: number | 'film', ext: 'avif' | 'webp') =>
  `${PHOTO_BASE}/${slug}/${file.replace(/\.[^.]+$/, '')}-${w}.${ext}`;

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
