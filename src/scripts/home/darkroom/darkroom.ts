// The darkroom: full-screen WebGL scene where the clicked frame is printed, developed and lit, then zoomed into.
// Timings (DR_T), uniforms and layout maths are ported unchanged from the prototype.
import { CanvasTexture, LinearSRGBColorSpace, Mesh, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, WebGLRenderer } from 'three';
import { clamp } from '../../../lib/rng';
import { TAU } from '../constants';
import { cvs } from '../draw';
import type { Roll } from '../types';
import { DR_FS } from './shader';

const T = { entry0: 0.3, entry1: 0.85, ring: 0.55, dev0: 0.9, dev1: 4.2, agit: [1.5, 3.0], light: 4.6, zoom0: 5.5, zoom1: 6.3 };
const REPEAT_SPEED = 1.8; // from the second time in a session the same beats play faster (open decision in SPEC § 7)
const SEEN_KEY = 'rc.darkroom';

type PrintSource = ImageBitmap | HTMLCanvasElement;
interface Dr {
  r: WebGLRenderer; U: Record<string, { value: any }>; sc: Scene; cam: OrthographicCamera;
  tex: CanvasTexture | null; raf: number;
}

const $ = (id: string) => document.getElementById(id)!;
let dr: Dr | null = null;
let live: { start: number; off: number; speed: number; done: boolean; finish: (ok: boolean) => void; token: number } | null = null;
let token = 0;

function init(): Dr | null {
  if (dr) return dr;
  let r: WebGLRenderer;
  try { r = new WebGLRenderer({ canvas: $('drgl') as HTMLCanvasElement, antialias: false }); } catch { return null; }
  r.setPixelRatio(Math.min(devicePixelRatio, 1.5)); r.outputColorSpace = LinearSRGBColorSpace;
  const U = {
    tPrint: { value: null }, uRes: { value: new Vector2() }, uPaperHalf: { value: new Vector2() }, uImgHalf: { value: new Vector2() },
    uPrintPos: { value: new Vector2(0.03, -0.02) }, uRingPos: { value: new Vector2() },
    uPortrait: { value: 0 }, uScale: { value: 1.3 }, uT: { value: 0 }, uDev: { value: 0 }, uLight: { value: 0 }, uEntry: { value: 0 }, uZoom: { value: 0 }, uZoomK: { value: 0.6 },
    uSeiche: { value: 0 }, uSeiche2: { value: 0 }, uRingT: { value: 99 }, uBW: { value: 0 }, uFade: { value: 0 }, uPrintRot: { value: 0 },
  };
  const mat = new ShaderMaterial({
    uniforms: U, vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
    fragmentShader: DR_FS, depthTest: false, depthWrite: false,
  });
  const sc = new Scene(); sc.add(new Mesh(new PlaneGeometry(2, 2), mat));
  buildDial();
  dr = { r, U, sc, cam: new OrthographicCamera(-1, 1, 1, -1, 0, 1), tex: null, raf: 0 };
  addEventListener('resize', () => { if (live) layout(); });
  $('darkroom').addEventListener('click', skip);
  addEventListener('keydown', () => { if (live) skip(); });
  return dr;
}

/** Hand timer with phosphorescent numbers. */
function buildDial() {
  let svg = '<circle cx="50" cy="50" r="47" fill="#0b0908" stroke="#2c2520" stroke-width="2"/>';
  for (let k = 0; k < 60; k++) {
    const a = (k / 60) * TAU, r1 = k % 5 ? 41 : 38;
    svg += `<line x1="${50 + Math.sin(a) * r1}" y1="${50 - Math.cos(a) * r1}" x2="${50 + Math.sin(a) * 44}" y2="${50 - Math.cos(a) * 44}" stroke="#a8f5a0" stroke-opacity="${k % 5 ? 0.35 : 0.8}" stroke-width="${k % 5 ? 0.7 : 1.4}"/>`;
  }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    svg += `<text x="${50 + Math.sin(a) * 29}" y="${50 - Math.cos(a) * 29 + 3}" text-anchor="middle" font-family="IBM Plex Mono" font-size="8" fill="#b9ffae" fill-opacity=".85">${k * 5}</text>`;
  }
  svg += '<g id="hand"><line x1="50" y1="58" x2="50" y2="12" stroke="#d4ffc4" stroke-width="1.6" stroke-linecap="round"/><circle cx="50" cy="50" r="3" fill="#d4ffc4"/></g>';
  $('dial').innerHTML = `<defs><filter id="lum"><feGaussianBlur stdDeviation="1.1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g filter="url(#lum)">${svg}</g>`;
}

let cur: { src: PrintSource; bw: boolean } | null = null;
const isPortrait = () => innerWidth / innerHeight < 0.85;

function setPrintImage(src: PrintSource, bw: boolean) {
  cur = { src, bw };
  const d = dr!, a = src.width / src.height, max = 2048;
  d.U.uPortrait.value = isPortrait() ? 1 : 0;
  const w = a >= 1 ? max : Math.round(max * a), h = a >= 1 ? Math.round(max / a) : max;
  const c = cvs(w, h); c.getContext('2d')!.drawImage(src, 0, 0, w, h);
  d.tex?.dispose(); d.tex = new CanvasTexture(c); d.tex.anisotropy = 8; d.U.tPrint.value = d.tex;
  const bx = 0.6, by = 0.42, ih = a > bx / by ? [bx, bx / a] : [by * a, by]; // half extents of the picture, as seen on screen
  // portrait screens turn the scene a quarter: the picture's width runs along the scene's y axis, its height along x
  const portrait = d.U.uPortrait.value > 0.5, sx = portrait ? by : bx, sy = portrait ? bx : by;
  const pa = portrait ? (a >= sx / sy ? [sx, sx / a] : [sy * a, sy]) : ih; // half width, half height on screen, fitted into the limits
  const half = portrait ? [pa[1], pa[0]] : pa; // scene extents (x, y)
  d.U.uImgHalf.value.set(half[0], half[1]); d.U.uPaperHalf.value.set(half[0] + 0.034, half[1] + 0.034); d.U.uBW.value = bw ? 1 : 0;
}

function layout() {
  const d = dr!, W = innerWidth, H = innerHeight, asp = W / H;
  d.r.setSize(W, H, false); d.U.uRes.value.set(W * d.r.getPixelRatio(), H * d.r.getPixelRatio());
  const portrait = isPortrait(), turned = d.U.uPortrait.value !== (portrait ? 1 : 0);
  d.U.uPortrait.value = portrait ? 1 : 0;
  if (turned && cur) setPrintImage(cur.src, cur.bw); // the screen was rotated: refit the paper
  // portrait: the tray (turned to run top to bottom) is as wide as the screen; landscape: as before
  const sc = portrait ? 1.34 / asp : Math.max(1.42, 2.0 / asp); d.U.uScale.value = sc;
  const ph = d.U.uPaperHalf.value;
  d.U.uZoomK.value = portrait
    ? Math.min(1, Math.max((ph.x * 1.06) / (0.5 * sc), (ph.y * 1.06) / (0.5 * asp * sc)))
    : Math.min(1, Math.max((ph.y * 1.06) / (0.5 * sc), (ph.x * 1.06) / (0.5 * asp * sc)));
}

const damped = (t: number, t0s: number[], A: number, per: number, tau: number) =>
  t0s.reduce((h, t0) => (t > t0 ? h + A * Math.exp(-(t - t0) / tau) * Math.sin((TAU * (t - t0)) / per) : h), 0);
const lightAt = (k: number) => (k < 0 ? 0 : k < 0.06 ? 0.7 : k < 0.16 ? 0.04 : k < 0.2 ? 0.9 : k < 0.34 ? 0.08 : Math.min(1, 0.82 + (k - 0.34) * 1.4));
const sm = (a: number, b: number, x: number) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };

/** The large print is read on a canvas, which needs CORS on the photo host; the bucket sends none today, so the fetch would only waste bandwidth. */
const CORS = import.meta.env.PUBLIC_PHOTO_CORS === '1';

/** Click / key = jump to the moment the light comes on. */
function skip() {
  // a touch tap is followed by a synthetic click that lands on the darkroom just shown: ignore the first moments
  if (!live || performance.now() - live.start < 700) return;
  const t = ((performance.now() - live.start) / 1000) * live.speed + live.off;
  if (t < T.light - 0.1) live.off += T.light - 0.1 - t;
}

function tick(now: number) {
  const d = dr!, s = live;
  if (!s) return;
  const t = ((now - s.start) / 1000) * s.speed + s.off, U = d.U;
  U.uT.value = t; U.uFade.value = sm(0, 0.7, t);
  U.uEntry.value = sm(T.entry0, T.entry1, t); U.uRingT.value = T.ring;
  U.uDev.value = 1 - Math.pow(1 - clamp((t - T.dev0) / (T.dev1 - T.dev0), 0, 1), 1.5);
  U.uSeiche.value = damped(t, [T.ring, ...T.agit], 0.011, 1.5, 1.0);
  U.uSeiche2.value = damped(t, T.agit.map((x) => x + 0.1), 0.005, 1.1, 0.8);
  U.uLight.value = lightAt(t - T.light); U.uZoom.value = sm(T.zoom0, T.zoom1, t);
  $('darkroom').classList.toggle('lit', t > T.light + 0.1);
  $('hand').setAttribute('transform', `rotate(${((Math.min(t, T.light) / T.light) * 270).toFixed(1)} 50 50)`);
  d.r.render(d.sc, d.cam);
  if (t >= T.zoom1 && !s.done) { s.done = true; d.raf = 0; s.finish(true); return; } // the overlay stays up while the page loads
  d.raf = requestAnimationFrame(tick);
}

/**
 * Plays the darkroom for one frame. Resolves true when the zoom has finished (caller navigates),
 * false when it couldn't run (no WebGL, frame not loaded) so the caller can fall back.
 */
export function developPrint(roll: Roll, fi: number): Promise<boolean> {
  const src = roll.imgs.get(fi), d = init();
  if (!src || !d) return Promise.resolve(false);
  const k = roll.shown.indexOf(fi), big = k >= 0 ? roll.large[k] : undefined, my = ++token;
  setPrintImage(src, roll.bw);
  // the 700px frame is there instantly; the large version replaces it as soon as it arrives
  if (big && CORS) fetch(big).then((r) => r.blob()).then((b) => createImageBitmap(b, { resizeWidth: 1800, resizeQuality: 'high' }))
    .then((bm) => { if (token === my && dr) setPrintImage(bm, roll.bw); }).catch(() => { /* CORS or network: keep the small one */ });
  let seen = false;
  try { seen = sessionStorage.getItem(SEEN_KEY) === '1'; sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
  d.U.uPrintRot.value = (Math.random() < 0.5 ? -1 : 1) * (0.015 + Math.random() * 0.02);
  d.U.uRingPos.value.set(d.U.uPrintPos.value.x, d.U.uPrintPos.value.y + d.U.uPaperHalf.value.y * 0.6);
  layout();
  const el = $('darkroom'); el.classList.remove('lit'); el.classList.add('on');
  return new Promise((finish) => {
    live = { start: performance.now(), off: 0, speed: seen ? REPEAT_SPEED : 1, done: false, finish, token: my };
    cancelAnimationFrame(d.raf); d.raf = requestAnimationFrame(tick);
  });
}

/** Back button restored the page from the bfcache: put the darkroom away. */
export function resetDarkroom() {
  if (dr) { cancelAnimationFrame(dr.raf); dr.raf = 0; }
  live = null; token++;
  document.getElementById('darkroom')?.classList.remove('on', 'lit');
}
