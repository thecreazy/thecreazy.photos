import { MathUtils, Raycaster, Vector2 } from 'three';
import { CURVE, FH, FW, PITCH, STRIP_H } from './constants';
import { goTo, nudge, step } from './motion';
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

  canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (!S.busy) nudge((Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 0.32); }, { passive: false });
  canvas.addEventListener('pointerdown', (e) => {
    S.mx = e.clientX; S.my = e.clientY; S.inside = true;
    S.drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    S.mx = e.clientX; S.my = e.clientY; S.inside = true;
    const d = S.drag;
    if (!d) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) d.moved = true;
    if (d.moved) {
      nudge(-(S.vertical ? e.clientY - d.ly : e.clientX - d.lx) * mmPerPx()); // finger up = film moves up = next frame
      d.lx = e.clientX; d.ly = e.clientY;
    }
  });
  canvas.addEventListener('pointerup', () => { if (S.drag && !S.drag.moved) click(); S.drag = null; });
  canvas.addEventListener('pointerleave', () => { S.inside = false; });
  addEventListener('keydown', (e) => {
    if (S.busy) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') step(1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') step(-1);
    if (e.key === 'Enter' && S.cur && S.cur.fi >= 0) {
      const roll = S.cur.seg.roll!;
      hooks.open(roll, S.cur.fi);
    } else if (e.key === 'Enter' && S.cur?.seg.contact) hooks.contact();
  });
}
