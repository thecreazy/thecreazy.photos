import { MathUtils, Raycaster, Vector2 } from 'three';
import { CURVE, FH, FW, PITCH, STRIP_H } from './constants';
import { goTo, nearestStop, nudge, settle, step } from './motion';
import { S } from './state';
import type { Roll, Stop } from './types';

export interface Hooks {
  open(roll: Roll, fi: number): void;
  contact(): void;
}

const ray = new Raycaster(), ndc = new Vector2();
const mmPerPx = () => (2 * S.CAMZ * Math.tan(MathUtils.degToRad(S.camera.fov / 2)) * S.camera.aspect) / S.W;

export interface Pick { seg: Stop['seg']; leader?: boolean; k?: number; stop?: Stop; gx: number }

/** Mouse → point on the curved film (z = -c·x²), two refinement steps. */
export function pickFilm(): Pick | null {
  if (!S.inside) return null;
  ndc.set((S.mx / S.W) * 2 - 1, -(S.my / S.H) * 2 + 1);
  ray.setFromCamera(ndc, S.camera);
  const o = ray.ray.origin, d = ray.ray.direction;
  let z = 0, x = 0, y = 0;
  for (let i = 0; i < 3; i++) { const t = (z - o.z) / d.z; x = o.x + d.x * t; y = o.y + d.y * t; z = -CURVE * x * x; }
  if (Math.abs(y) > STRIP_H / 2 + 2) return null;
  const g = x + S.scroll, seg = S.segs.find((s) => g >= s.x0 && g < s.x0 + s.len);
  if (!seg) return null;
  const lx = g - seg.x0;
  if (lx < seg.L) return { seg, leader: true, gx: x };
  const k = Math.floor((lx - seg.L - 3) / PITCH), fx = seg.L + 3 + k * PITCH;
  if (k >= 0 && k < seg.frames.length && lx >= fx && lx <= fx + FW && Math.abs(y) <= FH / 2 + 1)
    return { seg, k, stop: S.stops.find((s) => s.seg === seg && s.k === k), gx: x };
  return { seg, gx: x };
}

export function initInput(canvas: HTMLCanvasElement, hooks: Hooks) {
  let wheel: { from: Stop | null; dist: number; t: number } | null = null;
  let track: { t: number; v: number }[] = [], start: { stop: Stop | null; at: number } | null = null;
  const click = () => {
    if (S.busy) return;
    const p = pickFilm();
    if (!p) return;
    if (p.seg.contact) { hooks.contact(); return; }
    const roll = p.seg.roll!;
    if (p.leader) { goTo(S.stops.find((s) => s.seg === p.seg)); return; }
    if (!p.stop) return;
    if (Math.abs(p.stop.x - S.scroll) < 8) hooks.open(roll, p.stop.fi); else goTo(p.stop);
  };

  canvas.addEventListener('wheel', (e) => {
    if (e.ctrlKey) return; // pinch / ctrl+wheel zoom stays the browser's
    e.preventDefault();
    if (S.busy) return;
    const k = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? S.H : 1; // Firefox reports notched wheels in lines
    const mm = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * k * 0.32;
    if (!wheel) wheel = { from: nearestStop(S.target), dist: 0, t: 0 };
    wheel.dist += mm;
    nudge(mm);
    // a gesture ends when the wheel (or the trackpad's coasting) has been quiet for a moment: then it lands on a frame, in the direction it went
    clearTimeout(wheel.t);
    wheel.t = window.setTimeout(() => { const w = wheel!; wheel = null; settle(w.from, w.dist, 0); }, 140);
  }, { passive: false });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button) return; // primary button / touch only
    S.mx = e.clientX; S.my = e.clientY; S.inside = true;
    S.drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
    track = []; start = { stop: nearestStop(S.target), at: S.target };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    S.mx = e.clientX; S.my = e.clientY; S.inside = true;
    const d = S.drag;
    if (!d) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) d.moved = true;
    if (d.moved) {
      const mm = -(S.vertical ? e.clientY - d.ly : e.clientX - d.lx) * mmPerPx(); // finger up = film moves up = next frame
      nudge(mm);
      d.lx = e.clientX; d.ly = e.clientY;
      const now = performance.now();
      track.push({ t: now, v: mm / Math.max(8, now - (track.at(-1)?.t ?? now - 16)) }); // never divide by less than a frame: coalesced events would fake a huge speed
      track = track.filter((q) => now - q.t < 90);
    }
  });
  canvas.addEventListener('pointercancel', () => { S.drag = null; });
  canvas.addEventListener('pointerup', () => {
    const d = S.drag;
    S.drag = null;
    if (!d) return;
    if (!d.moved) { click(); return; }
    const vel = track.length ? track.reduce((a, q) => a + q.v, 0) / track.length : 0; // mm/ms over the last ~90 ms
    if (performance.now() - (track.at(-1)?.t ?? 0) > 120) { settle(start?.stop ?? null, S.target - (start?.at ?? S.target), 0); return; } // held still before letting go
    settle(start?.stop ?? null, S.target - (start?.at ?? S.target), vel);
  });
  canvas.addEventListener('pointerleave', () => { S.inside = false; });
  addEventListener('keydown', (e) => {
    if (S.busy || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    if ((e.target as HTMLElement | null)?.closest?.('a, button, input, select, textarea, [role="button"]')) return; // keys belong to the focused control
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') step(1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') step(-1);
    if (e.key === 'Enter' && S.cur && S.cur.fi >= 0) {
      const roll = S.cur.seg.roll!;
      hooks.open(roll, S.cur.fi);
    } else if (e.key === 'Enter' && S.cur?.seg.contact) hooks.contact();
  });
}
