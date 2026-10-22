# Spec — photos.canellariccardo.it

Visual reference: `reference/rullino.html`. Open it in the browser: with no connection to the old site
it uses placeholder photos; you can drag folders in (`Section/Name - Title/*.jpg`) to see it with real photos.
The numbers quoted below come from there (search the file for the constant's name).

All site copy is in English and lives in `src/i18n/en.ts`.

---

## 1. Content

### Sections
`models` (Models) · `projects` (Projects) · `travels` (Travels) · `erotic` (Erotics) · plus Contact and Archive.
There is no age gate on Erotics (decision: it is photography, not porn) and the pages are indexed like the rest. Their social preview never shows the picture (see § 9).

### One shooting = one folder
```
src/content/shooting/<slug>/index.md
```
Frontmatter (zod schema, fields optional where indicated):
```yaml
name: Nati                 # subject
title: The Quiet Bite      # optional
date: 2025-03              # year or year-month
section: models            # models | projects | travels | erotic
stock: KODAK PORTRA 400    # optional; if missing: "B&W"/"COLOR" inferred from the photos
bw: false                  # optional; inferred if missing
home: true                 # appears on the home roll
order: 10                  # order within the section (lower = first)
selected: [3, 7, 12]       # the 3 frames shown on the home roll (1-based indices); default: first 3
hero: 7                    # print that comes out of the envelope; default: selected[0]
photos:                    # photo order = order on the roll
  - 01.jpg
  - 02.jpg
note: ""                   # optional, goes in the envelope's "Notes" field
```
The **slug** = the one used by the current site (e.g. `nati-the-quiet-bite`) so links don't break.

The frame clicked on the home roll replaces `hero` for that visit (darkroom and envelope show the clicked one).

### Migration
One-off script that reads the current site (same logic as `scrapeSite()` in the prototype:
sections `/models`, `/projects`, `/work`→travels, `/erotic`; inside each page the `img[data-src]`)
and generates draft `index.md` files. Shootings present in both Models and Erotics go to Erotics.
Real photos must come from Riccardo's **originals**, not from Adobe's CDN (to be decided: see § 7).

---

## 2. Photo pipeline
- Riccardo exports JPEG masters, ~2500 px on the long side, one folder per shooting.
- `pnpm foto` (sharp):
  - page: AVIF + WebP at 800 / 1400 / 2200 px;
  - home film: 700 px (frame textures);
  - LQIP/blurhash for loading;
  - computes and saves: orientation, B&W yes/no (mean saturation < 0.05, like `isBW()`), dimensions.
- Variants are uploaded to storage (Cloudflare R2 proposed); the site uses public URLs.
- Masters **never** go in git.

---

## 3. Home — the endless roll
A single horizontal 35 mm film strip, centred, slightly curved in depth
(`CURVE = .0028`), scrolling.

- All sections in a row: Models → Projects → Travels → Erotics → "end · write to me" tail.
- Per shooting: **only the 3 `selected` frames**, preceded by a **leader** (blank film)
  written on in marker: section (first shooting of the section only), date, NAME, title.
- Portrait frames **stay rotated 90°** on the film, like on a real negative.
- **Light window** in the centre (`GATE`): the frame inside it develops into a positive; the rest is
  negative (inversion + orange mask for colour / grey for B&W), fading out toward the edges.
  If you scroll fast the frame doesn't develop (it flickers).
- Input: wheel, drag, ← →, swipe. Snaps to the nearest whole frame.
- HUD: brand name top left; section index + Archive + Contact top right; project title (serif)
  above the strip, film data below; clickable timeline at the bottom.
- Long jumps (index/timeline): fade to black and restart near the destination (`jumpTo`).
- Atmosphere: near-black background, animated grain, neon that flickers now and then, slight parallax.
- `HOME_LIMIT`: how many shootings per section on the home (Models: 12); the others only in Archive.

## 4. Darkroom (WebGL, `DR_FS` shader)
Click on the frame in the light (or Enter) → full-screen scene, then the project page.
Timings (`DR_T`): entry 0.3–0.85 s · development 0.9–4.2 s · agitations at 1.5 and 3.0 s · light at 4.6 s ·
zoom 5.5–6.3 s. Click = skip to the light turning on.
- Top-down view: tray with ribs, dark bench with drops, stop bath and fixer on the sides.
- Liquid: ripples + **seiche** (standing wave at each agitation) + entry wave;
  refraction on the paper, caustics, meniscus, reflection of the safelight sliding across.
- Development by tone: shadows first, highlights last; starts from the edge that entered first; not uniform.
- Safelight: everything red-amber, dark, grainy. Hand-type timer with phosphorescent numbers.
- Neon: two flickers, then full light, the true colours are revealed, long reflection of the tube.
- Zoom on the print → navigation to the project page (View Transitions).
- From the 2nd time in a session: shortened version (to be decided).

## 5. Project page — the envelope
Background: charcoal backdrop (`.b-bg`): a soft central light + fine grain. No blotchy texture.

1. **Lab envelope** (kraft, form printed in red, filled in by hand in blue):
   PHOTO LAB R·C · Envelope no. · Subject · Title · Date · Film · Format (35 mm · N frames) ·
   print-size boxes · Notes · DEVELOPED stamp.
   It opens by itself (flap), the `hero` print peeks out; as you scroll it comes out, moves to the centre and grows
   (sticky section, ~2.3 vh of scroll). Click → lightbox.
2. **The negatives**: transparent archive sheet over the light, all frames in strips of 6, as negatives
   (orange/grey mask); hover → positive. The sheet "lights up" the page (halo).
3. **The prints**: all the other photos as prints with a **thin white border (~1.4 %)**, book-like rhythm
   (large · staggered pair · side one with "no. X" in the margin). Effects:
   - laid down one at a time as they come into view (they fall, rotate, the shadow tightens);
   - hover: they lift and tilt in 3D toward the cursor, opposite shadow, glossy reflection that follows;
   - slight parallax at different depths.
4. **End**: discreet "← previous envelope · X" link; **the next envelope** half out of the bottom,
   closed and slightly crooked; hover = it lifts; click = it rises to the centre and becomes the new page.
- Top bar: "← roll" and "Section · 03/12".

### Archive and Contact
- Archive: typographic list of all shootings by section (serif), linking to the pages.
- Contact: simple page (real details from Riccardo).

## 6. Typography and colours
Instrument Serif (titles), IBM Plex Mono (data/HUD), Covered By Your Grace (marker),
Nanum Pen Script (pen). **Future goal: replace the two handwriting fonts with a font made from
Riccardo's own handwriting.** Grease-pencil red `#c4162a`, blue ink `#1d2a4a`, form red `#8e2b20`.

## 7. Open decisions
- Where the originals live (Lightroom? folders?) → defines the import script.
- Hosting/storage: Cloudflare Pages + R2? (align with where canellariccardo.it lives)
- Mobile: horizontal film and tray need rethinking in portrait (Phase 5).
- Shortened darkroom from the second time?
- Copy: two lines per shooting yes/no.

## 8. Phases
1. **Skeleton**: Astro, content collection + schema, `foto` script (sharp) and draft migration, base layout, test deploy.
2. **Project page**, static, with envelope, negatives, prints, next envelope, Archive, Contact.
3. **Home**: three.js roll as a component; HTML list fallback.
4. **Darkroom** + transition to the page.
5. **Mobile**.
6. **Polish**: Lighthouse, reduced-motion, per-page meta/OG, sitemap, redirects, DNS.

## 9. SEO and social previews
- `site` is `https://photos.canellariccardo.it` (override with `SITE_URL`). Every page has a canonical URL, Open Graph and Twitter tags; `robots.txt` and the sitemap are generated at build time. Only the 404 page is `noindex` and left out of the sitemap.
- One 1200×630 preview per shooting (`/og/<slug>.jpg`) plus a site-wide one (`/og/site.jpg`), generated at build time by `src/lib/og.ts` (satori + sharp) from the 700 px frames in `public/film`: the hero print with a white border on the dark background, section · date, name, title.
- **Erotics never show the picture** in their preview: an undeveloped film frame stands in. The site-wide preview fans three frames chosen in `SITE_FRAMES` (`src/lib/og.ts`).
