// Procedural paper/kraft/grain textures, ported from makeTextures() in the prototype.
// Generated once on the client and exposed as CSS custom properties (--t-kraft, --t-paper, --t-grain).
const TAU = Math.PI * 2;
const cvs = (w: number, h: number) => Object.assign(document.createElement('canvas'), { width: w, height: h });

function fib(x: CanvasRenderingContext2D, w: number, h: number, n: number, col: string, maxA: number, len: number) {
  x.save();
  x.strokeStyle = col;
  for (let i = 0; i < n; i++) {
    x.globalAlpha = Math.random() * maxA;
    x.lineWidth = Math.random() * 1.3 + 0.3;
    const px = Math.random() * w, py = Math.random() * h, a = Math.random() * TAU, l = Math.random() * len + 2;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  x.restore();
}

function mottle(x: CanvasRenderingContext2D, w: number, h: number, col: string, n: number, a: number) {
  x.save();
  x.filter = 'blur(28px)';
  x.fillStyle = col;
  for (let i = 0; i < n; i++) {
    x.globalAlpha = Math.random() * a;
    const cx = Math.random() * w, cy = Math.random() * h, r = 30 + Math.random() * 90;
    x.beginPath();
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) { x.moveTo(cx + dx * w + r, cy + dy * h); x.arc(cx + dx * w, cy + dy * h, r, 0, TAU); }
    x.fill();
  }
  x.restore();
}

export function makeTextures() {
  const mk = (w: number, h: number, f: (x: CanvasRenderingContext2D, w: number, h: number) => void) => {
    const c = cvs(w, h);
    f(c.getContext('2d')!, w, h);
    return `url(${c.toDataURL('image/jpeg', 0.86)})`;
  };
  const kraft = mk(600, 600, (x, w, h) => {
    x.fillStyle = '#b58f63'; x.fillRect(0, 0, w, h);
    mottle(x, w, h, '#7a5634', 26, 0.18); mottle(x, w, h, '#e0c49a', 18, 0.16);
    fib(x, w, h, 5200, '#4a301a', 0.14, 16); fib(x, w, h, 1600, '#f3e1c0', 0.12, 12);
  });
  const paper = mk(500, 500, (x, w, h) => {
    x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, w, h);
    mottle(x, w, h, '#d9d1c2', 10, 0.12); fib(x, w, h, 900, '#8a7f6f', 0.07, 6);
  });
  const grain = (() => {
    const c = cvs(256, 256), x = c.getContext('2d')!, d = x.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 90; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
    return `url(${c.toDataURL()})`;
  })();
  const r = document.documentElement.style;
  r.setProperty('--t-kraft', kraft); r.setProperty('--t-paper', paper); r.setProperty('--t-grain', grain);
}
