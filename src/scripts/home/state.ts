import { PerspectiveCamera } from 'three';
import type { Seg, Stop } from './types';

export interface Drag { x: number; lx: number; moved: boolean }

/** Shared mutable state of the home scene (one scene per page, so a module singleton is enough). */
export const S = {
  scroll: 0, target: 0, speed: 0, lastInput: 0, hoverX: -1e5,
  mx: -1, my: -1, inside: false, drag: null as Drag | null,
  W: 1, H: 1, CAMZ: 600,
  camera: new PerspectiveCamera(26, 1, 10, 6000),
  segs: [] as Seg[], stops: [] as Stop[],
  cur: null as Stop | null,
  busy: false,
};
