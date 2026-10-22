// "I negativi": archival sheet with every frame as a 35 mm negative (orange/grey mask); hover = positive.
// Ported from sleeveSheet() in the prototype — geometry and colours unchanged.
const TAU = Math.PI * 2;
const STRIP_H = 35, PITCH = 38, FW = 36, FH = 24, STRIP_W = 232;
const cvs = (w: number, h: number) => Object.assign(document.createElement('canvas'), { width: Math.round(w), height: Math.round(h) });

function coverDraw(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight), iw = img.naturalWidth * s, ih = img.naturalHeight * s;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

export interface SleeveInput { n: number; bw: boolean; imgs: (HTMLImageElement | null)[] }

export function sleeveSheet({ n: total, bw, imgs }: SleeveInput, pos: boolean) {
  const S = 5, per = 6, rows = Math.ceil(total / per), PH = 44, MX = 22, MY = 14;
  const w = (STRIP_W + MX * 2) * S, h = (rows * PH + MY * 2) * S;
  const c = cvs(w, h), x = c.getContext('2d')!;
  let g = x.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, w * 0.7);
  g.addColorStop(0, '#fbfaf6'); g.addColorStop(1, '#e9e6dd');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(120,125,130,.07)'; x.fillRect(MX * S * 0.4, MY * S * 0.4, w - MX * S * 0.8, h - MY * S * 0.8);
  x.fillStyle = '#d9d6cd';
  for (let k = 0; k < 3; k++) { x.beginPath(); x.arc(MX * S * 0.45, h * (0.2 + k * 0.3), 9, 0, TAU); x.fill(); }
  const mask = bw ? [214, 212, 205] : [208, 128, 72];
  const base = pos ? [16, 14, 12] : bw ? [190, 188, 182] : [186, 104, 52];
  const t = cvs(FW * S, FH * S), tx = t.getContext('2d', { willReadFrequently: true })!;
  for (let r = 0; r < rows; r++) {
    const y0 = (MY + r * PH) * S, sy = y0 + 4 * S, n = Math.min(per, total - r * per);
    const len = (n === per ? STRIP_W : 3 + n * PITCH + 1) * S;
    x.strokeStyle = 'rgba(0,0,0,.09)'; x.lineWidth = 2; x.beginPath();
    x.moveTo(MX * S * 0.5, y0 + PH * S - 2); x.lineTo(w - MX * S * 0.5, y0 + PH * S - 2); x.stroke();
    const sx = MX * S + Math.sin(r * 7.3) * 1.2 * S;
    x.fillStyle = `rgb(${base})`; x.fillRect(sx, sy, len, STRIP_H * S);
    x.fillStyle = '#f7f5ef';
    for (let hx = 1.4; hx < len / S - 3; hx += 4.75) {
      x.beginPath();
      x.roundRect(sx + hx * S, sy + 1.3 * S, 2.8 * S, 2 * S, 2);
      x.roundRect(sx + hx * S, sy + (STRIP_H - 3.3) * S, 2.8 * S, 2 * S, 2);
      x.fill();
    }
    x.fillStyle = pos ? 'rgba(200,190,170,.7)' : 'rgba(40,20,10,.55)';
    x.font = `500 ${1.6 * S}px "IBM Plex Mono", monospace`;
    for (let k = 0; k < n; k++) {
      const i = r * per + k, fx = sx + (3 + k * PITCH) * S, fy = sy + 5.5 * S;
      x.fillText(i + 1 + 'A', fx + 1.5 * S, sy + 31.4 * S);
      const src = imgs[i];
      tx.fillStyle = '#000'; tx.fillRect(0, 0, t.width, t.height);
      if (src) {
        if (src.naturalHeight > src.naturalWidth) {
          // portrait frames stay rotated 90° on the strip, like on a real negative
          tx.save(); tx.translate(t.width / 2, t.height / 2); tx.rotate(-Math.PI / 2);
          coverDraw(tx, src, -t.height / 2, -t.width / 2, t.height, t.width);
          tx.restore();
        } else coverDraw(tx, src, 0, 0, t.width, t.height);
      }
      if (!pos) {
        const d = tx.getImageData(0, 0, t.width, t.height), p = d.data;
        for (let j = 0; j < p.length; j += 4) {
          p[j] = ((255 - p[j] * 0.9) * mask[0]) / 255;
          p[j + 1] = ((255 - p[j + 1] * 0.9) * mask[1]) / 255;
          p[j + 2] = ((255 - p[j + 2] * 0.9) * mask[2]) / 255;
        }
        tx.putImageData(d, 0, 0);
      }
      x.drawImage(t, fx, fy);
    }
    g = x.createLinearGradient(0, y0, 0, y0 + PH * S);
    g.addColorStop(0, 'rgba(255,255,255,.16)'); g.addColorStop(0.25, 'rgba(255,255,255,0)'); g.addColorStop(0.9, 'rgba(255,255,255,.05)');
    x.fillStyle = g; x.fillRect(MX * S * 0.5, y0, w - MX * S, PH * S);
  }
  return c;
}
