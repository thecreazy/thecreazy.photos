import { clamp } from '../../lib/rng';
import { S } from './state';
import type { Stop } from './types';

export const nearestStop = (x: number) => {
  let best: Stop | null = null, bd = 1e9;
  for (const s of S.stops) { const d = Math.abs(s.x - x); if (d < bd) { bd = d; best = s; } }
  return best;
};
export const minX = () => S.stops[0]?.x ?? 0;
export const maxX = () => S.stops[S.stops.length - 1]?.x ?? 0;
export function goTo(st?: Stop | null) { if (!st) return; S.target = st.x; S.lastInput = performance.now() - 1000; }
export function nudge(d: number) { S.target = clamp(S.target + d, minX() - 20, maxX() + 20); S.lastInput = performance.now(); }
export function step(dir: number) {
  const st = nearestStop(S.target), i = S.stops.indexOf(st!);
  goTo(S.stops[clamp(i + dir, 0, S.stops.length - 1)]);
}
/** Long jumps (nav, timeline): dip to black and restart near the destination. */
export function jumpTo(st?: Stop | null) {
  if (!st) return;
  if (Math.abs(st.x - S.scroll) < 500) { goTo(st); return; }
  const f = document.getElementById('fade')!;
  f.classList.add('on');
  setTimeout(() => { S.scroll = st.x - Math.sign(st.x - S.scroll) * 150; S.target = st.x; S.lastInput = performance.now() - 1000; f.classList.remove('on'); }, 260);
}
