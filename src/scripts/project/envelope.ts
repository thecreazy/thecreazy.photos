import { clamp, lerp, smooth } from '../../lib/rng';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ───── the envelope: opens by itself, then the hero print comes out as you scroll ───── */
export function envelope() {
  const env = $('.env'), flap = $('.env-flap'), hint = $('.b-hint'), hero = $('.print.hero'), stage = $('.b-hero');
  if (!env || !flap || !hint || !hero || !stage) return;
  const img = hero.querySelector('img')!;
  // the shape comes from the width/height attributes (the real photo's size, written at build time), never from the rendered image:
  // before it has loaded the image is 0×0 and the box would be sized for a made-up ratio, leaving half of the photo outside its border
  const iw = +(img.getAttribute('width') ?? 0), ih = +(img.getAttribute('height') ?? 0);
  const a = iw && ih ? iw / ih : img.naturalWidth / img.naturalHeight || 1.5;
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
    if (handedOff) hand(); // the keyframes hold pixel distances: sample them again for the new size
    request();
  };

  /** Everything the envelope shows for a scroll progress `pp` (0..1 over the first 1.3 screens). */
  const state = (pp: number) => {
    const f = smooth(0, 0.12, pp), r = smooth(0.08, 0.45, pp), hz = smooth(0.42, 0.9, pp), d = smooth(0.45, 0.95, pp);
    const envY = d * G.vh * 0.95;
    // the print slides out of the envelope, then goes to the centre and grows
    const envTop = (G.vh - G.eh) / 2 + G.vh * 0.04 + envY, printTop0 = envTop + G.eh * 0.05;
    const outY = printTop0 - r * G.ph + G.ph / 2;
    const cy = lerp(outY, G.vh / 2, hz) - (printTop0 + G.ph / 2), s = lerp(1, G.sc, hz);
    return {
      f, r, fade: 1 - d * 0.9, hint: 1 - smooth(0.15, 0.3, pp),
      flap: `rotateX(${(f * 178).toFixed(1)}deg)`,
      env: `translateY(${(G.vh * 0.04 + envY).toFixed(1)}px)`,
      hero: `translateY(${cy.toFixed(1)}px) scale(${s.toFixed(4)}) rotate(${((1 - hz) * -1.2).toFixed(2)}deg)`,
    };
  };

  /* Once the intro has played, the scroll-driven part is handed to the browser: the same motion as CSS animations tied to the page's scroll
     position, which run on the compositor, off the main thread, so a finger scroll can't stutter on JavaScript, style recalculation or repaint.
     The curves are sampled from state() into keyframes, so the motion is exactly the one below. Browsers without scroll timelines keep the JS below. */
  const scrollTimelines = CSS.supports('animation-timeline: scroll()');
  const sheet = document.createElement('style');
  let handedOff = false;
  const hand = () => {
    const N = 64, R = G.vh * 1.3;
    const frames = (css: (s: ReturnType<typeof state>) => string) => {
      let o = '';
      for (let i = 0; i <= N; i++) o += `${((i / N) * 100).toFixed(2)}%{${css(state(Math.max(0.2, i / N)))}}`;
      return o;
    };
    const rule = (sel: string, name: string) => `.b-hero.sd ${sel}{animation:${name} linear both;animation-timeline:scroll(root block);animation-range:0px ${R.toFixed(0)}px}`;
    sheet.textContent =
      `@keyframes sd-flap{${frames((s) => `transform:${s.flap};opacity:${s.fade.toFixed(3)}`)}}` +
      `@keyframes sd-env{${frames((s) => `transform:${s.env}`)}}` +
      `@keyframes sd-fade{${frames((s) => `opacity:${s.fade.toFixed(3)}`)}}` +
      `@keyframes sd-hero{${frames((s) => `transform:${s.hero}`)}}` +
      `@keyframes sd-hint{${frames((s) => `opacity:${s.hint.toFixed(3)}`)}}` +
      rule('.env-flap', 'sd-flap') + rule('.env', 'sd-env') + rule('.env-front,.b-hero.sd .env-back', 'sd-fade') + rule('.print.hero', 'sd-hero') + rule('.b-hint', 'sd-hint');
    if (!sheet.isConnected) document.head.append(sheet);
    stage.classList.add('sd');
  };

  const tick = (now: number) => {
    queued = false;
    const intro = reduced ? 0.2 : Math.min(0.2, smooth(0, 1, (now - t0 - 500) / 1400) * 0.2);
    const pp = Math.max(intro, clamp(scrollY / (G.vh * 1.3), 0, 1));
    const s = state(pp);
    flap.classList.toggle('open', s.f > 0.5);
    hero.classList.toggle('out', s.r > 0.92);
    if (handedOff) return; // the animations draw the rest; the two class switches above are all that's left for script to do on scroll
    flap.style.transform = s.flap;
    env.style.transform = s.env;
    const fade = String(s.fade);
    front.style.opacity = fade;
    back.style.opacity = fade;
    flap.style.opacity = fade;
    hero.style.transform = s.hero;
    hint.style.opacity = String((intro >= 0.2 ? 1 : 0) * s.hint);
    if (!reduced && now - t0 < 1950) request(); // the intro runs by itself, afterwards only scrolling and resizing redraw
    else if (scrollTimelines) { handedOff = true; hand(); }
  };
  layout();
  addEventListener('resize', layout);
  addEventListener('scroll', request, { passive: true });
  addEventListener('pageshow', (e) => e.persisted && request());
  request();
}
