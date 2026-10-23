import type { Mesh, ShaderMaterial } from 'three';

export type Section = 'models' | 'projects' | 'travels' | 'erotic';

/** Serialised by index.astro into <script id="rolls">. One entry per shooting on the home roll. */
export interface RollData {
  slug: string;
  href: string;
  section: Section;
  name: string;
  title?: string;
  date: string;
  stock?: string;
  bw: boolean;
  n: number;
  shown: number[]; // 0-based indices of the frames on the roll (the `selected` ones)
  film: string[]; // 700px urls, same order as `shown`
  large: string[]; // 1400px urls for the darkroom print, same order
  port: boolean[]; // portrait flag, same order as `shown`
}
export interface HomeData { rolls: RollData[] }

export interface Roll extends RollData {
  mask: [number, number, number];
  imgs: Map<number, ImageBitmap>;
  loading: boolean;
  tries: Map<number, number>; // failed fetches per frame
  retryAt: number; // performance.now() before which no retry is made
  seg?: Seg;
}
export interface Zone { id: string; label: string }
export interface Seg {
  roll: Roll | null;
  frames: number[];
  head: string;
  sub?: string;
  top?: string;
  zone?: Zone;
  contact?: boolean;
  L: number;
  len: number;
  x0: number;
  canvas?: HTMLCanvasElement;
  marks?: HTMLCanvasElement;
  mat: ShaderMaterial;
  mesh: Mesh;
  tl?: HTMLElement;
  active: boolean;
}
export interface Stop { x: number; seg: Seg; k: number; fi: number }
