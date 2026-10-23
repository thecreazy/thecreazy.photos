import { clamp, hashStr, lerp, smooth } from '../../lib/rng';
import { t } from '../../i18n/en';
import { sleeveSheet } from './sleeve';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* each part starts on its own: a failure in one must not leave the others (or the prints, invisible until `.laid`) dead */
const safe = (f: () => void, onError?: () => void) => { try { f(); } catch (e) { console.error(e); onError?.(); } };
safe(pickedFrame);
safe(envelope);
safe(prints, () => document.querySelectorAll('.b-prints .print').forEach((f) => f.classList.add('laid')));
safe(lightbox);
safe(negatives);
safe(nextEnvelope);

/* the frame clicked on the home roll takes the hero's place: swap the two prints before anything is measured */
function pickedFrame() {
  let pick = '';
  try { pick = sessionStorage.getItem('rc.pick') ?? ''; sessionStorage.removeItem('rc.pick'); } catch { /* ignore */ }
  const [slug, n] = pick.split(':');
  const hero = $('.print.hero'), neg = $('#negatives');
  if (!hero || !neg || neg.dataset.slug !== slug || !n || hero.dataset.i === n) return;
  const other = document.querySelector<HTMLElement>(`.print[data-i="${CSS.escape(n)}"]:not(.hero)`);
  if (!other) return;
  const a = hero.querySelector('picture')!, b = other.querySelector('picture')!;
  // the hero stays the eager, high-priority image (LCP): the clone takes its loading hints, the original gets the lazy ones
  const c = b.cloneNode(true) as HTMLElement, ci = c.querySelector('img')!, ai = a.querySelector('img')!;
  ci.loading = 'eager'; ci.setAttribute('fetchpriority', 'high');
  ai.loading = 'lazy'; ai.removeAttribute('fetchpriority');
  a.replaceWith(c); b.replaceWith(a);
  for (const k of ['i', 'full'] as const) { const v = hero.dataset[k]!; hero.dataset[k] = other.dataset[k]; other.dataset[k] = v; }
  const port = hero.classList.contains('port');
  hero.classList.toggle('port', other.classList.contains('port')); other.classList.toggle('port', port);
}

/* ───── the envelope: opens by itself, then the hero print comes out as you scroll ───── */
function envelope() {
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

/* ───── the prints: laid down one at a time, lift toward the cursor, drift at different depths ───── */
function prints() {
  const list = [...document.querySelectorAll<HTMLElement>('.b-prints .print')];
  if (reduced) { list.forEach((f) => f.classList.add('laid')); return; }
  for (const f of list) {
    f.addEventListener('pointermove', (e) => {
      const r = f.getBoundingClientRect(), nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      f.classList.add('lift');
      f.style.setProperty('--ry', (nx * 7).toFixed(2) + 'deg');
      f.style.setProperty('--rx', (-ny * 7).toFixed(2) + 'deg');
      f.style.setProperty('--gx', (50 + nx * 40).toFixed(1) + '%');
      f.style.setProperty('--gy', (50 + ny * 40).toFixed(1) + '%');
      f.style.setProperty('--ox', (-nx * 14).toFixed(1));
      f.style.setProperty('--oy', (-ny * 10).toFixed(1));
    });
    f.addEventListener('pointerleave', () => {
      f.classList.remove('lift');
      f.style.setProperty('--rx', '0deg');
      f.style.setProperty('--ry', '0deg');
    });
  }
  const io = new IntersectionObserver(
    (es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const sib = [...e.target.parentElement!.querySelectorAll('.print')].indexOf(e.target);
      setTimeout(() => e.target.classList.add('laid'), 120 + sib * 220);
    }),
    { threshold: 0.18 },
  );
  list.forEach((f) => io.observe(f));
  const parallax = () => {
    const vh = innerHeight;
    for (const f of list) {
      const r = f.parentElement!.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      f.style.setProperty('--py', (-(r.top + r.height / 2 - vh / 2) * +f.dataset.depth!).toFixed(1) + 'px');
    }
  };
  let q = 0;
  addEventListener('scroll', () => { if (!q) q = requestAnimationFrame(() => { q = 0; parallax(); }); }, { passive: true });
  parallax();
}

/* ───── lightbox: a modal dialog, reachable from the keyboard ───── */
function lightbox() {
  const L = t.project.lightbox;
  const figs = [...document.querySelectorAll<HTMLElement>('.print')].filter((f) => !f.closest('.next-env'));
  let lb: HTMLDivElement | null = null, img: HTMLImageElement, closeBtn: HTMLButtonElement;
  let at = -1, opener: HTMLElement | null = null, locked: { overflow: string; pad: string } | null = null;
  const dimmed: HTMLElement[] = [];

  for (const f of figs) { // prints become buttons once JS is there (without JS they are plain pictures)
    f.tabIndex = 0;
    f.setAttribute('role', 'button');
    f.setAttribute('aria-haspopup', 'dialog');
  }

  const btn = (cls: string, label: string, text: string, onclick: () => void) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.textContent = text;
    b.setAttribute('aria-label', label);
    b.onclick = (e) => { e.stopPropagation(); onclick(); };
    return b;
  };

  const show = (i: number) => {
    at = (i + figs.length) % figs.length;
    const fig = figs[at];
    img.src = fig.dataset.full!;
    img.alt = fig.querySelector('img')?.alt ?? '';
  };

  const build = () => {
    lb = document.createElement('div');
    lb.id = 'lb';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', L.label);
    lb.inert = true;
    img = new Image();
    closeBtn = btn('lb-close', L.close, '×', close);
    lb.append(img, closeBtn);
    if (figs.length > 1) lb.append(btn('lb-prev', L.prev, '←', () => show(at - 1)), btn('lb-next', L.next, '→', () => show(at + 1)));
    lb.onclick = (e) => { if (e.target === lb || e.target === img) close(); };
    document.body.append(lb);
  };

  const open = (i: number) => {
    if (!lb) build();
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    show(i);
    // everything behind the dialog is out of reach: not tabbable, not scrollable
    for (const el of document.body.children) if (el !== lb && el instanceof HTMLElement && !el.inert && el.tagName !== 'SCRIPT') { el.inert = true; dimmed.push(el); }
    const root = document.documentElement, sb = innerWidth - root.clientWidth;
    locked = { overflow: root.style.overflow, pad: document.body.style.paddingRight };
    root.style.overflow = 'hidden';
    if (sb > 0) document.body.style.paddingRight = `${sb}px`;
    lb!.inert = false;
    requestAnimationFrame(() => lb!.classList.add('on'));
    closeBtn.focus({ preventScroll: true });
  };

  function close() {
    if (!lb || !lb.classList.contains('on')) return;
    lb.classList.remove('on');
    lb.inert = true;
    for (const el of dimmed.splice(0)) el.inert = false;
    if (locked) { document.documentElement.style.overflow = locked.overflow; document.body.style.paddingRight = locked.pad; locked = null; }
    (figs[at] ?? opener)?.focus();
  }

  document.addEventListener('click', (e) => {
    const fig = (e.target as HTMLElement).closest<HTMLElement>('.print');
    if (fig && !fig.closest('.next-env')) open(figs.indexOf(fig));
  });

  addEventListener('keydown', (e) => {
    if (!lb?.classList.contains('on')) {
      const fig = e.target instanceof Element ? e.target.closest<HTMLElement>('.print') : null;
      if (fig && figs.includes(fig) && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(figs.indexOf(fig)); }
      return;
    }
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft' && figs.length > 1) show(at - 1);
    else if (e.key === 'ArrowRight' && figs.length > 1) show(at + 1);
    else if (e.key === 'Tab') { // focus stays inside the dialog
      const ctl = [...lb.querySelectorAll<HTMLElement>('button')], first = ctl[0], last = ctl[ctl.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

/* ───── negatives: built once the section is near, from the small "film" variants ───── */
function negatives() {
  const sec = $('#negatives'), host = $('#sleeve');
  if (!sec || !host) return;
  const film: string[] = JSON.parse(sec.dataset.film!);
  const bw = sec.dataset.bw === 'true';
  const selected: number[] = JSON.parse(sec.dataset.selected ?? '[]');
  const seed = hashStr(sec.dataset.slug ?? '');
  const per = innerWidth < 760 ? 3 : 6; // strips of three on phones, so the frames aren't tiny
  const io = new IntersectionObserver((es) => {
    if (!es[0].isIntersecting) return;
    io.disconnect();
    Promise.all(film.map((src) => new Promise<HTMLImageElement | null>((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    }))).then((imgs) => {
      if (!imgs.some(Boolean)) return;
      host.replaceChildren(sleeveSheet({ n: film.length, bw, imgs, selected, seed, per }, false), sleeveSheet({ n: film.length, bw, imgs, selected, seed, per }, true));
    });
  }, { rootMargin: '600px' });
  io.observe(sec);
}

/* ───── the next envelope rises to the centre and becomes the new page ───── */
function nextEnvelope() {
  const ne = $<HTMLAnchorElement>('.next-env');
  if (!ne) return;
  ne.addEventListener('click', (e) => {
    if (reduced || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    const r = ne.getBoundingClientRect(), dy = (innerHeight - r.height) / 2 + innerHeight * 0.04 - r.top;
    ne.classList.add('go');
    ne.style.transform = `translateX(-50%) translateY(${dy.toFixed(0)}px)`;
    document.querySelectorAll<HTMLElement>('.b-hero,.b-neg,.b-prints,.b-prev,.b-nextlab,.pt').forEach((el) => (el.style.opacity = '0'));
    setTimeout(() => (location.href = ne.href), 700);
  });
  // back button: the page comes back from the bfcache exactly as it was left, mid-transition
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    document.querySelectorAll<HTMLElement>('.b-hero,.b-neg,.b-prints,.b-prev,.b-nextlab,.pt').forEach((el) => el.style.removeProperty('opacity'));
    ne.classList.remove('go');
    ne.style.removeProperty('transform');
  });
}
