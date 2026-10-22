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
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const data: HomeData = JSON.parse($('rolls-data').textContent!);

function webgl(canvas: HTMLCanvasElement) {
  try { return new WebGLRenderer({ canvas, antialias: true }); } catch { return null; }
}

async function main() {
  const canvas = $('gl') as HTMLCanvasElement;
  const renderer = webgl(canvas);
  if (!renderer) return; // no WebGL: the HTML list stays visible
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
    const visW = S.W < 760 ? (S.W > S.H ? 190 : 120) : 250; // visible mm across
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

  const rolls = makeRolls(data.rolls);
  const film = buildFilm(scene, rolls);
  S.segs = film.segs; S.stops = film.stops;
  buildNav(); buildTimeline();

  // start: at the roll named in the hash (coming back from a project page), else the film slides in from the right
  const startRoll = rolls.find((r) => r.slug === decodeURIComponent(location.hash.slice(1)));
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
    const ok = await developPrint(roll, fi);
    if (ok) location.href = roll.href; // the darkroom overlay stays up; the cross-document view transition fades it into the page
    else { S.busy = false; open(roll.href); }
  };
  addEventListener('pageshow', (e) => { if (e.persisted) { S.busy = false; fade.classList.remove('on'); resetDarkroom(); } }); // back button (bfcache)
  initInput(canvas, {
    open: (roll, fi) => {
      try { sessionStorage.setItem('rc.pick', `${roll.slug}:${fi + 1}`); } catch { /* ignore */ }
      void develop(roll, fi);
    },
    contact: () => open('/contact/'),
  });

  document.documentElement.classList.add('gl');
  $('loader').classList.add('done');

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
      u.uScroll.value = S.scroll; u.uTime.value = time; u.uHoverX.value = S.hoverX; u.uSpeed.value = S.speed; u.uDevK.value = devK * fl;
    }
    // slight parallax
    if (S.inside && !reduced) { par.x = lerp(par.x, (S.mx / S.W - 0.5) * 2, 0.05); par.y = lerp(par.y, (S.my / S.H - 0.5) * 2, 0.05); }
    S.camera.position.set(par.x * 10, -par.y * 6 + Math.sin(time * 0.5) * 0.8, S.CAMZ);
    S.camera.lookAt(0, 0, -30);
    updateHUD();
    renderer.render(scene, S.camera);
    requestAnimationFrame(tick);
  };
  const par = { x: 0, y: 0 };
  requestAnimationFrame(tick);
}

main();
