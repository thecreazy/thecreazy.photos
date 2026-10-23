import { LinearSRGBColorSpace, Scene, WebGLRenderer, MathUtils } from 'three';
import { clamp, lerp } from '../../lib/rng';
import { buildFilm, makeRolls, updateActive } from './film';
import { addLight } from './shaders';
import { MARK, PEN } from './constants';
import { initInput, pickFilm } from './input';
import { buildNav, buildTimeline, layoutHUD, updateHUD } from './hud';
import { minX, nearestStop } from './motion';
import { S } from './state';
import { cvs } from './draw';
import { developPrint, resetDarkroom } from './darkroom/darkroom';
import type { HomeData, Roll } from './types';

const $ = (id: string) => document.getElementById(id)!;
const FIRST_VIEW_MM = 420; // frames within this distance of the light must be in before the loader goes
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const data: HomeData = JSON.parse($('rolls-data').textContent!);

function webgl(canvas: HTMLCanvasElement) {
  try { return new WebGLRenderer({ canvas, antialias: true }); } catch { return null; }
}

async function main() {
  const canvas = $('gl') as HTMLCanvasElement;
  const renderer = webgl(canvas);
  if (!renderer) return plainList(); // no WebGL: the HTML list takes over
  progress(0.15); // the script and three.js have arrived
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x0b0908);
  renderer.outputColorSpace = LinearSRGBColorSpace;

  // animated grain overlay
  { const c = cvs(220, 220), x = c.getContext('2d')!, d = x.createImageData(220, 220);
    for (let i = 0; i < d.data.length; i += 4) { d.data[i] = d.data[i + 1] = d.data[i + 2] = Math.random() * 255; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0); $('grain').style.background = `url(${c.toDataURL()})`; }

  const scene = new Scene();
  const { gateMat } = addLight(scene);

  const resize = () => {
    S.W = innerWidth; S.H = innerHeight;
    renderer.setSize(S.W, S.H, false);
    S.camera.aspect = S.W / S.H;
    S.vertical = S.W < 760 && S.H > S.W;
    document.documentElement.classList.toggle('vert', S.vertical);
    const visW = S.vertical ? 58 : S.W < 760 ? 190 : 250; // visible mm across the screen's width (vertical: the strip's height fits it)
    S.CAMZ = visW / (2 * Math.tan(MathUtils.degToRad(S.camera.fov / 2)) * S.camera.aspect);
    S.camera.updateProjectionMatrix();
    layoutHUD();
  };
  addEventListener('resize', resize);
  resize();

  await Promise.race([
    Promise.all([`40px "${MARK}"`, `40px "${PEN}"`, '40px "Instrument Serif"', '500 20px "IBM Plex Mono"'].map((f) => document.fonts.load(f))),
    new Promise((r) => setTimeout(r, 3000)),
  ]);
  progress(0.4);

  const rolls = makeRolls(data.rolls);
  const film = buildFilm(scene, rolls);
  S.segs = film.segs; S.stops = film.stops;
  buildNav(); buildTimeline();

  // start: at the roll named in the hash (coming back from a project page), else the film slides in from the right
  const startRoll = rolls.find((r) => r.slug === safeHash());
  const startStop = startRoll && S.stops.find((s) => s.seg.roll === startRoll);
  if (startStop) S.scroll = S.target = startStop.x; else { S.scroll = minX() - 260; S.target = minX(); }
  updateActive(S.segs, S.scroll);

  const fade = $('fade');
  const open = (href: string) => {
    if (S.busy) return;
    S.busy = true;
    if (reduced) { location.href = href; return; }
    fade.classList.add('on');
    setTimeout(() => (location.href = href), 260);
  };
  /** Frame in the light → darkroom → project page. No WebGL / reduced motion / frame not loaded: plain fade. */
  const develop = async (roll: Roll, fi: number) => {
    if (S.busy) return;
    if (reduced) { open(roll.href); return; }
    S.busy = true;
    prefetch(roll.href); // warm the page while the darkroom plays, so the dissolve doesn't wait on the network
    const ok = await developPrint(roll, fi);
    if (ok) { handoff = true; location.href = roll.href; } // the darkroom overlay stays up; the cross-document view transition fades it into the page
    else { S.busy = false; open(roll.href); }
  };
  let handoff = false;
  addEventListener('pageswap', (e) => { if (handoff) (e as any).viewTransition?.types.add('develop'); }); // darkroom → page gets the slow dissolve (tokens.css)
  addEventListener('pageshow', (e) => { if (e.persisted) { handoff = false; S.busy = false; fade.classList.remove('on'); resetDarkroom(); } }); // back button (bfcache)
  initInput(canvas, {
    open: (roll, fi) => {
      try { sessionStorage.setItem('rc.pick', `${roll.slug}:${fi + 1}`); } catch { /* ignore */ }
      void develop(roll, fi);
    },
    contact: () => open('/contact/'),
  });

  document.documentElement.classList.add('gl');
  document.querySelector('.roll-list')?.setAttribute('inert', ''); // off-screen list: out of the tab order and the click targets

  const darkroomEl = $('darkroom');
  let last = performance.now(), flickT = 3, lastCursor = '';
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const time = now / 1000;
    // inertia + snap to the nearest frame
    if (now - S.lastInput > 160 && !S.drag) { const st = nearestStop(S.target); if (st) S.target += (st.x - S.target) * (1 - Math.exp(-dt * 10)); }
    const prev = S.scroll;
    S.scroll += (S.target - S.scroll) * (1 - Math.exp(-dt * 7));
    S.speed = lerp(S.speed, Math.abs(S.scroll - prev) / Math.max(dt, 1e-3), 0.25);
    updateActive(S.segs, S.scroll);
    // hover
    const p = pickFilm();
    const hx = p?.stop ? p.stop.x - S.scroll : p?.leader ? p.gx : -1e5;
    S.hoverX = hx < -1e4 ? -1e5 : S.hoverX < -1e4 ? hx : lerp(S.hoverX, hx, 0.3);
    const cursor = p && (p.stop || p.leader || p.seg.contact) ? 'pointer' : S.drag?.moved ? 'grabbing' : 'grab';
    if (cursor !== lastCursor) { canvas.style.cursor = cursor; lastCursor = cursor; }
    // neon flicker
    flickT -= dt;
    let fl = 1;
    if (flickT < 0) flickT = 5 + Math.random() * 10; else if (flickT < 0.16) fl = 0.88 + 0.12 * Math.sin(flickT * 110);
    gateMat.uniforms.uFlick.value = reduced ? 1 : fl;
    const devK = 1 - clamp((S.speed - 70) / 380, 0, 1); // too fast → the frame doesn't develop
    for (const s of S.segs) {
      const u = s.mat.uniforms;
      u.uScroll.value = S.scroll; u.uTime.value = reduced ? 0 : time; // reduced motion: the film doesn't flutter u.uHoverX.value = S.hoverX; u.uSpeed.value = S.speed; u.uDevK.value = devK * fl;
    }
    // slight parallax
    if (S.inside && !reduced) { par.x = lerp(par.x, (S.mx / S.W - 0.5) * 2, 0.05); par.y = lerp(par.y, (S.my / S.H - 0.5) * 2, 0.05); }
    S.camera.position.set(par.x * 10, -par.y * 6 + (reduced ? 0 : Math.sin(time * 0.5) * 0.8), S.CAMZ);
    S.camera.up.set(S.vertical ? -1 : 0, S.vertical ? 0 : 1, 0); // vertical: +x (the next frames) points down the screen
    S.camera.lookAt(0, 0, -30);
    updateHUD();
    if (!darkroomEl.classList.contains('on')) renderer.render(scene, S.camera); // the darkroom covers the roll: keep the state moving, skip the draw
    requestAnimationFrame(tick);
  };
  const par = { x: 0, y: 0 };
  requestAnimationFrame(tick);

  // keep the loader up until the frames around the light are there (or a few seconds have passed), so the roll never opens on blank film
  await framesReady((f) => progress(0.4 + f * 0.6), 6000);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); // let the textures reach the GPU
  progress(1);
  $('loader').classList.add('done');
}

function prefetch(href: string) {
  const l = document.createElement('link');
  l.rel = 'prefetch'; l.href = href;
  document.head.append(l);
}

/** Loader bar, 0..1 (never goes backwards). */
function progress(v: number) {
  const bar = document.querySelector<HTMLElement>('#bar i');
  if (bar) bar.style.width = `${Math.max(parseFloat(bar.style.width) || 0, v * 100)}%`;
}

/** Resolves when every frame of the rolls near the light has arrived, or after `max` ms. */
function framesReady(on: (fraction: number) => void, max: number) {
  return new Promise<void>((resolve) => {
    const near = S.segs.filter((s) => s.roll && Math.max(s.x0 - S.scroll, S.scroll - (s.x0 + s.len), 0) < FIRST_VIEW_MM).map((s) => s.roll!);
    const total = near.reduce((n, r) => n + r.shown.length, 0);
    const t0 = performance.now();
    const check = () => {
      const have = near.reduce((n, r) => n + r.imgs.size + [...r.tries.values()].filter((v) => v >= 3).length, 0), f = total ? have / total : 1;
      on(f);
      if (f >= 1 || performance.now() - t0 > max) resolve(); else setTimeout(check, 80);
    };
    check();
  });
}

function safeHash() {
  try { return decodeURIComponent(location.hash.slice(1)); } catch { return ''; }
}

/** No WebGL, or something broke while booting: drop the loader and show the HTML list. */
function plainList() {
  document.documentElement.classList.remove('gl');
  document.querySelector('.roll-list')?.removeAttribute('inert');
  document.documentElement.classList.add('nogl');
}

main().catch(plainList);
setTimeout(() => { if (!document.documentElement.classList.contains('gl')) plainList(); }, 15000); // never leave the loader up forever
