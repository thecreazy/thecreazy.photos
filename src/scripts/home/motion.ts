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
/**
 * End of a swipe or a wheel/trackpad gesture: carry the film on by the release speed and land on a frame, and never fall back to the
 * frame you started from when the gesture clearly went somewhere (a short flick is enough to turn the page).
 * `from` is the frame in the light when the gesture began, `dist` the film travelled in mm, `vel` mm per ms at release.
 */
export function settle(from: Stop | null, dist: number, vel: number) {
  if (!from) return;
  const dir = Math.sign(dist) || Math.sign(vel);
  const projected = clamp(S.target + vel * 260, minX() - 20, maxX() + 20); // coasting a quarter of a second further
  let st = nearestStop(projected);
  const i0 = S.stops.indexOf(from);
  if (st === from && dir && (Math.abs(dist) > 3.5 || Math.abs(vel) > 0.04)) st = S.stops[clamp(i0 + dir, 0, S.stops.length - 1)];
  const far = Math.abs(S.stops.indexOf(st!) - i0); // a hard flick can cross several frames, but not a whole roll
  if (far > 6) st = S.stops[clamp(i0 + dir * 6, 0, S.stops.length - 1)];
  goTo(st);
}

/** Long jumps (nav, timeline): dip to black and restart near the destination. */
export function jumpTo(st?: Stop | null) {
  if (!st) return;
  if (Math.abs(st.x - S.scroll) < 500) { goTo(st); return; }
  const f = document.getElementById('fade')!;
  f.classList.add('on');
  setTimeout(() => { S.scroll = st.x - Math.sign(st.x - S.scroll) * 150; S.target = st.x; S.lastInput = performance.now() - 1000; f.classList.remove('on'); }, 260);
}
