// The pointer: a photographer's loupe. A thin ring that trails the mouse, closes down to a red pencil dot over things you can click,
// and says what a click will do over the frame in the light, a print and the darkroom. Mouse only: touch and reduced-motion keep it simple.
import { t } from '../i18n/en';

const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (fine) {
  const root = document.documentElement;
  const el = document.createElement('div');
  el.id = 'cur';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<i></i><u></u><b></b>';
  document.body.append(el);
  const label = el.querySelector('b')!;

  const HOT = 'a, button, [role="button"], summary, label, .next-env, [data-hot]';
  let x = -100, y = -100, cx = x, cy = y, seen = false, state = '', text = '';

  const read = (target: Element | null) => {
    if (document.getElementById('darkroom')?.classList.contains('on')) return ['skip', t.cursor.skip];
    const home = target?.id === 'gl' ? root.dataset.cursor : ''; // set by the home roll for what is under the pointer on its canvas
    if (home === 'develop') return ['label', t.cursor.develop];
    if (home === 'hot') return ['hot', ''];
    if (home === 'drag') return ['drag', ''];
    if (target?.closest('#lb')) return target.closest('button') ? ['hot', ''] : ['', ''];
    if (target?.closest('.b-prints .print, body:not(.ct) .env .print.hero')) return ['label', t.cursor.view];
    if (target?.closest(HOT)) return ['hot', ''];
    return ['', ''];
  };
  const apply = (target: Element | null) => {
    const [s, l] = read(target);
    if (s !== state) { state = s; el.dataset.state = s; }
    if (l !== text) { text = l; label.textContent = l; }
  };

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    if (!seen) { seen = true; cx = x; cy = y; root.classList.add('cur'); el.classList.add('on'); }
    apply(e.target as Element | null);
  }, { passive: true });
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') el.classList.add('down'); });
  addEventListener('pointerup', () => el.classList.remove('down'));
  document.documentElement.addEventListener('pointerleave', () => el.classList.remove('on'));
  document.documentElement.addEventListener('pointerenter', () => { if (seen) el.classList.add('on'); });
  addEventListener('blur', () => el.classList.remove('on'));

  const tick = () => {
    const k = reduced ? 1 : 0.28;
    cx += (x - cx) * k; cy += (y - cy) * k;
    el.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
    if (seen) apply(document.elementFromPoint(x, y)); // the darkroom and the roll change what is under a still pointer
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
