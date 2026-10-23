import { clamp, lerp, smooth } from '../../lib/rng';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ───── the envelope: opens by itself, then the hero print comes out as you scroll ───── */
export function envelope() {
  const env = $('.env'), flap = $('.env-flap'), hint = $('.b-hint'), hero = $('.print.hero'), stage = $('.b-hero');
  if (!env || !flap || !hint || !hero || !stage) return;
  const img = hero.querySelector('img')!;
  const a = img.width / img.height || 1.5;
  let G = { vw: 0, vh: 0, ew: 0, eh: 0, pw: 0, ph: 0, sc: 1 };

  const coarse = matchMedia('(pointer: coarse)').matches;
  const front = env.querySelector<HTMLElement>('.env-front')!, back = env.querySelector<HTMLElement>('.env-back')!;
  const ne = $('.next-env');
  const t0 = performance.now();
  let queued = false;
  const request = () => { if (!queued) { queued = true; requestAnimationFrame(tick); } };

  const layout = () => {
    const vw = innerWidth, vh = innerHeight;
    // phones fire `resize` when the URL bar collapses: keep the layout (it would jump the scroll mid-gesture)
    if (coarse && G.vw === vw && Math.abs(vh - G.vh) < 160) return;
    let eh = Math.min(vh * 0.7, 700), ew = eh * 0.76;
    if (ew > vw * 0.86) { ew = vw * 0.86; eh = ew / 0.76; }
    const bx = ew * 0.88, by = eh * 0.9;
    let pw = bx, ph = pw / a;
    if (ph > by) { ph = by; pw = ph * a; }
    const bord = Math.min(pw, ph) * 0.02;
    pw += bord * 2; ph += bord * 2;
    const hw = Math.min(vw * 0.86, vh * 0.84 * (pw / ph));
    G = { vw, vh, ew, eh, pw, ph, sc: hw / pw };
    env.style.cssText = `width:${ew}px;height:${eh}px;aspect-ratio:auto;--u:${ew / 100}px`;
    for (const [k, v] of Object.entries({ width: `${pw}px`, height: `${ph}px`, padding: `${bord}px`, left: `${(ew - pw) / 2}px`, top: `${eh * 0.05}px` })) hero.style.setProperty(k, v);
    stage.style.height = `${vh * 2.3}px`;
    if (ne) ne.style.cssText = `width:${ew}px;height:${eh}px;--u:${ew / 100}px`;
    request();
  };

  const tick = (now: number) => {
    queued = false;
    const intro = reduced ? 0.2 : Math.min(0.2, smooth(0, 1, (now - t0 - 500) / 1400) * 0.2);
    const pp = Math.max(intro, clamp(scrollY / (G.vh * 1.3), 0, 1));
    const f = smooth(0, 0.12, pp), r = smooth(0.08, 0.45, pp), hz = smooth(0.42, 0.9, pp), d = smooth(0.45, 0.95, pp);
    flap.style.transform = `rotateX(${(f * 178).toFixed(1)}deg)`;
    flap.classList.toggle('open', f > 0.5);
    const envY = d * G.vh * 0.95;
    env.style.transform = `translateY(${(G.vh * 0.04 + envY).toFixed(1)}px)`;
    const fade = String(1 - d * 0.9);
    front.style.opacity = fade;
    back.style.opacity = fade;
    flap.style.opacity = fade;
    // the print slides out of the envelope, then goes to the centre and grows
    const envTop = (G.vh - G.eh) / 2 + G.vh * 0.04 + envY, printTop0 = envTop + G.eh * 0.05;
    const outY = printTop0 - r * G.ph + G.ph / 2;
    const cy = lerp(outY, G.vh / 2, hz) - (printTop0 + G.ph / 2), s = lerp(1, G.sc, hz);
    hero.style.transform = `translateY(${cy.toFixed(1)}px) scale(${s.toFixed(4)}) rotate(${((1 - hz) * -1.2).toFixed(2)}deg)`;
    hero.classList.toggle('out', r > 0.92);
    hint.style.opacity = String((intro >= 0.2 ? 1 : 0) * (1 - smooth(0.15, 0.3, pp)));
    if (!reduced && now - t0 < 1950) request(); // the intro runs by itself, afterwards only scrolling and resizing redraw
  };
  layout();
  addEventListener('resize', layout);
  addEventListener('scroll', request, { passive: true });
  addEventListener('pageshow', (e) => e.persisted && request());
  request();
}
