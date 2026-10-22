// pnpm favicon — draws the site icon (a serif "R" with the red grease-pencil stroke) into public/:
//   favicon.svg (letter converted to paths, no font needed), favicon.ico (16/32/48), apple-touch-icon.png (180, square: iOS rounds it).
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import satori from 'satori';
import sharp from 'sharp';

const serif = readFileSync('node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff');
const fonts = [{ name: 'Serif', data: serif, weight: 400, style: 'normal' }];
const h = (style, children) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children } });

const icon = (s, round) => h(
  { width: s, height: s, background: '#0b0908', borderRadius: round ? s * 0.18 : 0, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  [
    h({ fontFamily: 'Serif', fontSize: s * 0.78, color: '#efe7da', lineHeight: 1, marginTop: -s * 0.04 }, 'R'),
    h({ position: 'absolute', left: s * 0.2, right: s * 0.2, bottom: s * 0.13, height: s * 0.07, background: '#c4162a', borderRadius: s * 0.04, transform: 'rotate(-3deg)' }),
  ],
);

const svg = (s, round) => satori(icon(s, round), { width: s, height: s, fonts });
const png = async (s, round) => sharp(Buffer.from(await svg(512, round))).resize(s, s).png().toBuffer();

await writeFile('public/favicon.svg', await svg(512, true));
await writeFile('public/apple-touch-icon.png', await png(180, false));

// ICO container holding PNG images
const sizes = [16, 32, 48], pngs = await Promise.all(sizes.map((s) => png(s, true)));
const head = Buffer.alloc(6 + 16 * sizes.length); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
let offset = head.length;
sizes.forEach((s, i) => {
  const o = 6 + i * 16;
  head.writeUInt8(s, o); head.writeUInt8(s, o + 1); head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
  head.writeUInt32LE(pngs[i].length, o + 8); head.writeUInt32LE(offset, o + 12); offset += pngs[i].length;
});
await writeFile('public/favicon.ico', Buffer.concat([head, ...pngs]));
console.log('public/favicon.svg, favicon.ico, apple-touch-icon.png');
