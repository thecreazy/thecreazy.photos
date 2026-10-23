// Builds the roll: one segment per shooting (leader + its frames), then an end leader.
// Segments only own canvases/textures while they are near the light; images are fetched a little earlier.
import { CanvasTexture, Mesh, PlaneGeometry, ShaderMaterial, Vector3, type Scene } from 'three';
import { ACTIVE_MM, CURVE, FW, GATE, LOAD_MM, PITCH, STRIP_H } from './constants';
import { drawSegment, leaderLen } from './draw';
import { FILM_FS, FILM_VS } from './shaders';
import type { Roll, RollData, Seg, Stop, Zone } from './types';
import { t } from '../../i18n/en';

const ZONE_ORDER = ['models', 'projects', 'travels', 'erotic'] as const;
const blank = () => { const c = document.createElement('canvas'); c.width = c.height = 1; return new CanvasTexture(c); };

export function makeRolls(data: RollData[]): Roll[] {
  return data.map((d) => ({
    ...d,
    mask: d.bw ? [0.86, 0.86, 0.84] : [1, 0.64, 0.4],
    imgs: new Map(),
    loading: false,
    tries: new Map(),
    retryAt: 0,
  }));
}

export function buildFilm(scene: Scene, rolls: Roll[]) {
  const segs: Seg[] = [], stops: Stop[] = [];
  let x = 0, lastZone: string | null = null;
  const zones = new Map<string, Zone>();
  const mk = (p: Omit<Seg, 'mat' | 'mesh' | 'active' | 'x0' | 'len' | 'L'> & { L?: number; lenFrames: number }): Seg => {
    const L = p.contact ? leaderLen(p) + 40 : leaderLen(p);
    const len = p.contact ? L : L + 3 + p.lenFrames * PITCH + 1;
    const geo = new PlaneGeometry(len, STRIP_H, Math.max(8, Math.ceil(len / 6)), 4);
    geo.translate(len / 2, 0, 0);
    const mat = new ShaderMaterial({
      uniforms: {
        map: { value: blank() }, tMarks: { value: blank() }, uMask: { value: new Vector3(...(p.roll?.mask ?? [1, 0.64, 0.4])) },
        uGate: { value: GATE }, uDevK: { value: 1 }, uHideX: { value: -1e5 }, uHide: { value: 0 }, uSegX: { value: x },
        uScroll: { value: 0 }, uCurve: { value: CURVE }, uTime: { value: 0 }, uHoverX: { value: -1e5 }, uSpeed: { value: 0 },
      },
      vertexShader: FILM_VS, fragmentShader: FILM_FS, transparent: true,
    });
    const mesh = new Mesh(geo, mat);
    mesh.frustumCulled = false; mesh.renderOrder = 10; scene.add(mesh);
    const { lenFrames: _l, ...rest } = p;
    return { ...rest, L, len, x0: x, mat, mesh, active: false };
  };

  for (const zid of ZONE_ORDER) {
    for (const roll of rolls.filter((r) => r.section === zid)) {
      const zone = zones.get(zid) ?? zones.set(zid, { id: zid, label: t.sections[zid] }).get(zid)!;
      const first = zid !== lastZone; lastZone = zid;
      const seg = mk({
        roll, frames: roll.shown, head: roll.name.toUpperCase(), sub: roll.title,
        top: (first ? `— ${zone.label.toUpperCase()} — ` : '') + roll.date, zone, lenFrames: roll.shown.length,
      });
      roll.seg = seg; segs.push(seg); x += seg.len;
    }
  }
  const end = mk({ roll: null, frames: [], head: t.home.endHead, sub: t.home.endSub, top: `— ${t.nav.contact.toUpperCase()} —`, contact: true, lenFrames: 0 });
  segs.push(end); x += end.len;

  for (const seg of segs) {
    seg.frames.forEach((fi, k) => stops.push({ x: seg.x0 + seg.L + 3 + k * PITCH + FW / 2, seg, k, fi }));
    if (seg.contact) stops.push({ x: seg.x0 + seg.L / 2, seg, k: -1, fi: -1 });
  }
  return { segs, stops, filmLen: x };
}

export function redraw(seg: Seg) {
  if (!seg.active) return;
  if (seg.roll) seg.sub = seg.roll.title;
  drawSegment(seg);
  const u = seg.mat.uniforms;
  u.map.value.dispose(); u.tMarks.value.dispose();
  const tex = new CanvasTexture(seg.canvas!), mtex = new CanvasTexture(seg.marks!);
  tex.anisotropy = mtex.anisotropy = 8;
  u.map.value = tex; u.tMarks.value = mtex;
}
function release(seg: Seg) {
  seg.active = false; seg.canvas = seg.marks = undefined;
  const u = seg.mat.uniforms;
  u.map.value.dispose(); u.tMarks.value.dispose();
  u.map.value = blank(); u.tMarks.value = blank();
}

const MAX_TRIES = 3; // per frame, then it stays fogged
const BITMAP_PX = 420; // long side of the stored bitmap: the frame is painted at 252×168 px, so this is still ~1.7× oversampled

async function loadImages(seg: Seg) {
  const roll = seg.roll;
  if (!roll || roll.loading || performance.now() < roll.retryAt) return;
  const todo = roll.shown.filter((fi) => !roll.imgs.has(fi) && (roll.tries.get(fi) ?? 0) < MAX_TRIES);
  if (!todo.length) return;
  roll.loading = true;
  let got = 0, failed = 0;
  await Promise.all(todo.map(async (fi) => {
    const k = roll.shown.indexOf(fi);
    try {
      const r = await fetch(roll.film[k]);
      if (!r.ok) throw new Error(String(r.status));
      const size = roll.port[k] ? { resizeHeight: BITMAP_PX } : { resizeWidth: BITMAP_PX };
      roll.imgs.set(fi, await createImageBitmap(await r.blob(), { ...size, resizeQuality: 'high' }));
      got++;
    } catch { roll.tries.set(fi, (roll.tries.get(fi) ?? 0) + 1); failed++; } // leave the frame fogged, retry a couple of times
  }));
  roll.loading = false;
  if (failed) roll.retryAt = performance.now() + 2000 * 2 ** Math.max(...[...roll.tries.values()], 1);
  if (got) redraw(seg); // nothing new → nothing to repaint
}

function dropImages(roll: Roll) {
  if (!roll.imgs.size) return;
  for (const b of roll.imgs.values()) b.close();
  roll.imgs.clear();
}

/** Called every frame: activate segments near the light, release the far ones. */
export function updateActive(segs: Seg[], scroll: number) {
  for (const s of segs) {
    const d = Math.max(s.x0 - scroll, scroll - (s.x0 + s.len), 0);
    if (d < LOAD_MM && s.roll) void loadImages(s);
    if (d < ACTIVE_MM && !s.active) { s.active = true; redraw(s); }
    else if (d > ACTIVE_MM * 2.2 && s.active) release(s);
    if (d > LOAD_MM * 2 && !s.active && s.roll && !s.roll.loading) dropImages(s.roll); // far away: free the decoded frames
  }
}
