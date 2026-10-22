import { MathUtils } from 'three';
import { STRIP_H } from './constants';
import { jumpTo, nearestStop } from './motion';
import { S } from './state';
import { t } from '../../i18n/en';

const $ = (id: string) => document.getElementById(id)!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
let titleKey = '';

export function buildNav() {
  const sections = [...new Set(S.segs.map((s) => s.zone?.id).filter(Boolean))] as string[];
  const nav = $('nav');
  nav.replaceChildren(
    ...sections.map((id) => {
      const a = document.createElement('a');
      a.dataset.id = id; a.textContent = t.sections[id as keyof typeof t.sections]; a.href = `#${id}`;
      a.onclick = (e) => { e.preventDefault(); jumpTo(S.stops.find((s) => s.seg.zone?.id === id)); };
      return a;
    }),
    ...[['archive', t.nav.archive, '/archive/'], ['contact', t.nav.contact, '/contact/']].map(([id, label, href]) => {
      const a = document.createElement('a'); a.dataset.id = id; a.textContent = label; a.href = href; return a;
    }),
  );
}

export function buildTimeline() {
  const tl = $('timeline');
  tl.querySelectorAll('i').forEach((i) => i.remove());
  let lastZ: string | null = null;
  for (const seg of S.segs) {
    if (seg.contact) continue;
    const i = document.createElement('i');
    i.style.flex = String(seg.len);
    if (lastZ && seg.zone!.id !== lastZ) i.className = 'sec';
    lastZ = seg.zone!.id; i.title = seg.roll!.name;
    i.onclick = (e) => { e.stopPropagation(); jumpTo(S.stops.find((s) => s.seg === seg)); };
    seg.tl = i; tl.append(i);
  }
}

export function layoutHUD() {
  const visH = 2 * S.CAMZ * Math.tan(MathUtils.degToRad(S.camera.fov / 2)), px = (S.H / visH) * STRIP_H;
  // vertical roll: title and data sit in the free bands at the top and bottom (see html.vert in home.css)
  $('title').style.bottom = S.vertical ? '' : S.H / 2 + px / 2 + 34 + 'px';
  $('meta').style.top = S.vertical ? '' : S.H / 2 + px / 2 + 26 + 'px';
}

export function updateHUD() {
  const st = nearestStop(S.scroll);
  if (!st) return;
  const seg = st.seg, key = seg.roll ? seg.roll.slug : 'end';
  if (key !== titleKey) {
    titleKey = key;
    const title = $('title');
    title.classList.add('out');
    setTimeout(() => {
      if (seg.roll) {
        const n = String(S.segs.filter((s) => s.zone === seg.zone).indexOf(seg) + 1).padStart(2, '0');
        $('tSec').textContent = `${seg.zone!.label} · ${n}`;
        $('tName').innerHTML = `${esc(seg.roll.name)}${seg.roll.title ? ` <em>— ${esc(seg.roll.title)}</em>` : ''}`;
      } else { $('tSec').textContent = t.home.endTitle; $('tName').textContent = t.home.endName; }
      title.classList.remove('out');
    }, 200);
    document.querySelectorAll<HTMLElement>('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.id === (seg.contact ? 'contact' : seg.zone!.id)));
    S.segs.forEach((s) => s.tl?.classList.toggle('on', s === seg));
  }
  if (st !== S.cur) {
    S.cur = st;
    if (seg.roll) {
      const r = seg.roll;
      $('meta').innerHTML = `<b>${esc(r.stock ?? '35 mm')}</b>${r.date ? ' · ' + esc(r.date) : ''} · ${t.home.frame} <b>${st.fi + 1}</b>/${r.n} · <span class="sel">${t.home.picked}</span>`;
    } else $('meta').innerHTML = t.home.toContact;
  }
  const rect = $('timeline').getBoundingClientRect(), el = seg.tl;
  if (el) {
    const r2 = el.getBoundingClientRect(), f = Math.min(1, Math.max(0, (S.scroll - seg.x0) / seg.len));
    $('tlMark').style.left = r2.left - rect.left + f * r2.width + 'px';
  }
}
