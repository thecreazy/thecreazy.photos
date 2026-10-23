// 2D painting of a film segment: the positive picture (the shader inverts it into a negative)
// plus a "marks" layer for grease pencil and marker that must not invert. Ported from the prototype.
import { FH, FW, INK, MARK, MM, PEN, PITCH, STRIP_H, TAU, WAX } from './constants';
import type { Seg } from './types';

// roundRect needs Safari 16 / Chrome 99 / Firefox 112: older browsers get square corners instead of a dead render loop
if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x: number, y: number, w: number, h: number) { this.rect(x, y, w, h); };

export const cvs = (w: number, h: number) => Object.assign(document.createElement('canvas'), { width: Math.round(w), height: Math.round(h) });

let grain: HTMLCanvasElement | null = null;
const GRAIN = () => {
  if (grain) return grain;
  const c = (grain = cvs(128, 128)), x = c.getContext('2d')!, d = x.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 120; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0);
  return c;
};

const waxCache: Record<string, HTMLCanvasElement> = {};
function wax(ctx: CanvasRenderingContext2D, color: string) {
  if (!waxCache[color]) {
    const c = cvs(96, 96), x = c.getContext('2d')!;
    x.fillStyle = color; x.fillRect(0, 0, 96, 96);
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 560; i++) { x.globalAlpha = Math.random() * 0.7; x.fillRect(Math.random() * 96, Math.random() * 96, Math.random() * 2.2 + 0.4, Math.random() * 1.1 + 0.3); }
    waxCache[color] = c;
  }
  return ctx.createPattern(waxCache[color], 'repeat')!;
}

/** Hand-drawn ellipse as a point list (slightly open, wobbly), for circling picks in grease pencil. */
export function ellipsePts(cx: number, cy: number, rx: number, ry: number, r: () => number): [number, number][] {
  const pts: [number, number][] = [], a0 = r() * TAU, sw = TAU + 0.3 + r() * 0.45, ph = r() * 9, n = 72;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = a0 + sw * t, k = 1 + 0.035 * Math.sin(a * 2 + ph) + 0.05 * (t - 0.5);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}
/** A slightly bowed line between two points, as drawn freehand. */
export function bowPts(x0: number, y0: number, x1: number, y1: number, r: () => number, bow = 4): [number, number][] {
  const pts: [number, number][] = [], n = 16, nx = -(y1 - y0), ny = x1 - x0, L = Math.hypot(nx, ny) || 1, b = (r() - 0.5) * bow;
  for (let i = 0; i <= n; i++) {
    const t = i / n, c = 4 * t * (1 - t) * b;
    pts.push([x0 + (x1 - x0) * t + (nx / L) * c, y0 + (y1 - y0) * t + (ny / L) * c]);
  }
  return pts;
}
/** Grease-pencil stroke: a strong line plus a fainter offset one. */
export function waxLine(x: CanvasRenderingContext2D, pts: [number, number][], color: string, w: number) {
  x.save(); x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = wax(x, color);
  for (const [off, lw, a] of [[0, w, 0.9], [w * 0.25, w * 0.55, 0.45]]) {
    x.lineWidth = lw; x.globalAlpha = a; x.beginPath();
    pts.forEach((p, i) => (i ? x.lineTo(p[0] + off, p[1] - off) : x.moveTo(p[0] + off, p[1] - off)));
    x.stroke();
  }
  x.restore();
}

function hand(x: CanvasRenderingContext2D, t: string, px: number, py: number, size: number, font: string, rot = 0, color = INK, waxy = false) {
  x.save(); x.translate(px, py); x.rotate(rot); x.font = `${size}px "${font}"`; x.textAlign = 'left';
  x.fillStyle = waxy ? wax(x, color) : color; x.fillText(t, 0, 0); x.restore();
}

function coverDraw(ctx: CanvasRenderingContext2D, img: ImageBitmap, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height), iw = img.width * s, ih = img.height * s;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}
/** Portrait frames stay rotated 90° on the strip, like on a real negative. */
function paintPhoto(ctx: CanvasRenderingContext2D, w: number, h: number, img: ImageBitmap) {
  ctx.save();
  if (img.height > img.width && w > h) { ctx.translate(w / 2, h / 2); ctx.rotate(-Math.PI / 2); coverDraw(ctx, img, -h / 2, -w / 2, h, w); }
  else coverDraw(ctx, img, 0, 0, w, h);
  ctx.restore();
}
function fogFrame(x: CanvasRenderingContext2D, w: number, h: number) {
  x.fillStyle = '#5a5653'; x.fillRect(0, 0, w, h);
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(0,0,0,.25)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'overlay'; x.globalAlpha = 0.7; x.fillStyle = x.createPattern(GRAIN(), 'repeat')!; x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
}

const measure = cvs(10, 10).getContext('2d')!;
export function leaderLen(seg: Pick<Seg, 'head' | 'sub'>) {
  measure.font = `${10 * MM}px "${MARK}"`;
  const a = measure.measureText(seg.head).width / MM;
  measure.font = `${9 * MM}px "${PEN}"`;
  const b = seg.sub ? measure.measureText(seg.sub).width / MM : 0;
  return Math.max(64, Math.max(a, b) + 22);
}

export function drawSegment(seg: Seg) {
  const roll = seg.roll, L = seg.L, nf = seg.frames.length, len = seg.len;
  const c = seg.canvas ?? (seg.canvas = cvs(len * MM, STRIP_H * MM)), x = c.getContext('2d')!;
  const m = seg.marks ?? (seg.marks = cvs(len * MM, STRIP_H * MM)), mx = m.getContext('2d')!;
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height); mx.setTransform(1, 0, 0, 1, 0, 0); mx.clearRect(0, 0, m.width, m.height);
  x.setTransform(MM, 0, 0, MM, 0, 0); mx.setTransform(MM, 0, 0, MM, 0, 0);
  x.fillStyle = '#0a0908'; x.fillRect(0, 0, len, STRIP_H);
  x.globalCompositeOperation = 'destination-out'; x.beginPath();
  for (let hx = 1.4; hx < len - 2.8; hx += 4.75) { x.roundRect(hx, 1.3, 2.8, 2, 0.45); x.roundRect(hx, STRIP_H - 3.3, 2.8, 2, 0.45); }
  x.fill(); x.globalCompositeOperation = 'source-over';
  // edge printing (latent, so it inverts like the picture)
  x.fillStyle = 'rgba(196,184,156,0.85)'; x.font = '500 1.55px "IBM Plex Mono", monospace';
  if (roll) for (let k = 0; k < nf; k++) {
    const fx = L + 3 + k * PITCH, num = seg.frames[k] + 1;
    x.fillText('▸' + num, fx + 1.5, 31.15); x.fillText(num + 'A', fx + FW - 2.4, 31.15);
    if (k % 2 === 0 && roll.stock) x.fillText(roll.stock, fx + 9, 5.05);
  }
  // frames
  if (roll) for (let k = 0; k < nf; k++) {
    const i = seg.frames[k];
    x.save(); x.setTransform(1, 0, 0, 1, (L + 3 + k * PITCH) * MM, 5.5 * MM);
    x.beginPath(); x.roundRect(0, 0, FW * MM, FH * MM, 0.5 * MM); x.clip();
    const img = roll.imgs.get(i);
    if (!img) fogFrame(x, FW * MM, FH * MM); else paintPhoto(x, FW * MM, FH * MM, img);
    x.restore();
  }
  // leader: white marker on blank film
  if (seg.top) hand(mx, seg.top, 6, 9.2, 4.2, 'IBM Plex Mono', 0, '#d9d0bf', false);
  hand(mx, seg.head, 6, 21, 10, MARK, -0.015, WAX, true);
  if (seg.sub) hand(mx, seg.sub, 7, 29.4, 9, PEN, -0.01, WAX, true);
}
