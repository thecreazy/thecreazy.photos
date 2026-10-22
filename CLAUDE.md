# photos.canellariccardo.it

Riccardo Canella's photography portfolio. Replaces the current Adobe Portfolio site.
Concept: **film and the darkroom**. Home = a scrolling film roll; a frame "develops" in the
darkroom; every shooting has a page = **the lab envelope**.

The visual reference is `reference/rullino.html` (validated prototype, HTML+JS in one file).
The full spec is `docs/SPEC.md`. Read it before each phase.

## Stack (decided)
- Static **Astro**. **No React** or other UI frameworks.
- **three.js** in plain JS/TS, only where needed (home: roll + darkroom), as a client-side
  component loaded on the home page only.
- Project pages = **real static HTML** (SEO, shareable URLs), effects as progressive JS.
- Content in Astro Content Collections with a zod schema.
- Images: `sharp` pipeline (`pnpm foto`), variants in `public/photos/` (gitignored), base URL in `PUBLIC_PHOTO_BASE_URL`; external storage: DigitalOcean Spaces (one bucket per site, see `docs/GO-LIVE.md`).
- The 700 px "film" frames (home roll, negatives sheet, darkroom fallback) are served from the site itself (`public/film/`, committed): their pixels are read on a canvas, which would need CORS on the bucket (not applied by DigitalOcean Spaces so far). Large variants (`public/photos/`) stay on the bucket.
- SEO: `site` in `astro.config.mjs`, sitemap (`@astrojs/sitemap`), `robots.txt` endpoint, canonical + Open Graph/Twitter tags in `Base.astro`, OG images generated at build time (`src/lib/og.ts`, satori + sharp). Erotics are indexed like the rest (user decision) but their OG image never shows the picture.
- Hosting: Cloudflare Pages (to be confirmed).

## Rules
- The prototype is the source of truth for the **look & feel**: port shaders, timings and proportions
  as they are, don't reinterpret them. The code, however, is restructured into modules.
- Don't invent data (film stock, notes, print times): if missing, leave the field empty/optional.
- Every effect needs a fallback: no WebGL → HTML list; `prefers-reduced-motion` →
  no long animations (darkroom skipped, prints without the drop).
- Site copy in **English** (`<html lang="en">`), all in `src/i18n/en.ts`: no strings scattered in components.
- Package manager: **pnpm** (never npm/yarn).
- Work in phases (SPEC § Phases). At the end of a phase: clean build, check in the browser, update the
  status below.

## Already discarded (don't propose again)
Light table with props · overlapping strips, one per section · straightened vertical frames
in the light · "editorial" project page (giant serif title + grid) ·
print notebook · scotch-tape tabs for previous/next project · blotchy beige background.

## Status
- [ ] Phase 1 — skeleton, content schema, photo pipeline, migration (in progress: Astro + schema + `foto` + `migrate` written; still missing a test with real photos and a test deploy)
- [ ] Phase 2 — project page (envelope): done and checked in the browser (envelope, negatives, prints, next envelope, Archive, Contact); missing real photos, mobile check (Phase 5) and Contact details
- [ ] Phase 3 — home roll: done and checked in the browser with synthetic photos (roll, light, return from the project page, list fallback); 18+ gate removed (user decision); the clicked frame becomes the hero print via sessionStorage `rc.pick`; missing real photos, mobile (Phase 5), click → darkroom (Phase 4; for now it goes straight to the page)
- [ ] Phase 4 — darkroom + transition: done and checked in the browser with real photos (`src/scripts/home/darkroom/`: verbatim `DR_FS` shader, `DR_T` timings, hand timer; click/key skips to the light; 2nd time in a session plays 1.8× faster; reduced motion / no WebGL → plain fade; the large 1400px print needs bucket CORS, otherwise the 700px frame is kept; cross-document view transition fades into the page); to check: real GPU / phone performance
- [ ] Phase 5 — mobile: done and checked in a phone emulator (390×844 and 844×390): portrait phones get a vertical roll (camera rolled, swipe up/down, HUD in the bands above/below, tap-to-skip wording on touch), the darkroom is zoomed in on narrow screens and ignores the synthetic click that follows a tap; landscape phones keep the horizontal roll with a compact HUD; project pages, Archive, Contact and 404 already fit. To check on real devices (iOS Safari, Android Chrome): performance, safe areas, swipe feel
- [ ] Phase 6 — performance, fallbacks, going live
