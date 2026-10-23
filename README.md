# photos.canellariccardo.it

Photography portfolio of Riccardo Canella, replacing the old Adobe Portfolio site.

The whole site plays on **film and the darkroom**:

- **Home** — a single 35 mm roll that scrolls past a light window. The frame in the light develops into a positive, the rest stays negative.
- **Darkroom** — clicking that frame leads to the print, then to the shooting's page.
- **Shooting page** — a **lab envelope**: the chosen print slides out of it, then the negatives sheet, then every other photo laid down as a print.
- **Archive** and **Contact** — plain typographic pages.

Project pages are real static HTML (shareable URLs, SEO). WebGL and animations are progressive: without WebGL the home falls back to a plain HTML list, and `prefers-reduced-motion` turns off the long animations.

## Stack

- [Astro](https://astro.build) 7, fully static, no UI framework
- three.js (plain TS), loaded on the home page only
- Astro Content Collections + zod for the shootings
- `sharp` for the photo pipeline
- pnpm — never npm or yarn

## Getting started

```sh
pnpm install
pnpm dev          # http://localhost:4321
```

Needs Node ≥ 22.23. The repo contains no photos (see below), so the roll is empty until you add some.

| Command            | What it does                                                           |
| :----------------- | :--------------------------------------------------------------------- |
| `pnpm dev`         | Dev server                                                             |
| `pnpm build`       | Production build to `dist/`                                            |
| `pnpm preview`     | Serve the build locally                                                |
| `pnpm foto [slug]` | Build web variants from `masters/` (every shooting if no slug)         |
| `pnpm upload`      | Copy `public/photos/` to the Spaces bucket with a 1-year immutable cache header (needs the `rclone` remote `canellariccardo`; `copy`, never `sync`) |
| `pnpm hashnames`   | One-off: rename existing variants to the content-hashed names (no re-encoding). Run before `pnpm foto` |
| `pnpm check`       | Content ↔ photo data ↔ `vercel.json` consistency; runs automatically before `pnpm build` |
| `pnpm typecheck`   | `tsc --noEmit` |
| `pnpm headers`     | Rewrite the `headers` list of `vercel.json` (security headers, CSP Report-Only, cache rules) |
| `pnpm textures`    | Re-render the kraft / paper / grain textures to `public/tex/*.jpg` (committed; only when the recipe in `tools/textures.mjs` changes) |
| `pnpm favicon`     | Redraw `public/favicon.svg`, `favicon.ico` and `apple-touch-icon.png` (serif R + red pencil stroke) |
| `pnpm redirects`   | Rebuild the `redirects` list in `vercel.json` (old Adobe URLs → new ones) from `redirects.csv` |
| `pnpm migrate`     | One-off: draft shootings + `redirects.csv` scraped from the old site   |

## Adding a shooting

1. **Export masters.** JPEGs, about 2500 px on the long side, into `masters/<slug>/` (gitignored).
2. **Run `pnpm foto <slug>`.** It writes AVIF + WebP at 800 / 1400 / 2200 px to `public/photos/<slug>/` (gitignored, uploaded with `pnpm upload`), a 700 px film frame to `public/film/<slug>/` (**committed**: the roll and the negatives read its pixels, so it is served from the site's own origin), and `src/data/photos/<slug>.json` with dimensions, orientation, B&W detection and blurhash (the print's blurred placeholder). File names carry the first 8 chars of the master's sha1 (`01-1a2b3c4d-1400.avif`): replace a photo and its URLs change, so everything is cached as immutable. That JSON **is** committed: the build needs it. The script is incremental and prunes variants of removed or replaced photos (`public/photos` automatically; the committed `public/film` only reports them: delete with `--prune-film`).
3. **Write `src/content/shooting/<slug>/index.md`:**

```yaml
---
name: Nati                 # subject
title: The Quiet Bite      # optional
date: 2025-03              # YYYY or YYYY-MM
section: models            # models | projects | travels | erotic
stock: KODAK PORTRA 400    # optional; if missing the page says B&W / COLOR, inferred from the photos
bw: false                  # optional; inferred if missing
home: true                 # shown on the home roll
order: 10                  # order within the section (lower = first)
selected: [3, 7, 12]       # the 3 frames on the home roll (1-based); default: first 3
hero: 7                    # print that comes out of the envelope; default: selected[0]
photos:                    # order here = order on the page
  - 01.jpg
  - 02.jpg
note: ""                   # optional, goes in the envelope's Notes field (and the meta description)
envelope: 117              # optional, the number printed on the envelope; default 100 + position in the site-wide order (which shifts when a shooting is added)
alts:                      # optional, alt text per photo (filename → text); generic "Name, frame N" when missing
  01.jpg: "Nati on a balcony at dusk"
noindex: true              # optional: keep this page out of search engines and the sitemap
---
```

Nothing is invented by the code: if `stock`, `note` or a title is missing, the field is simply left empty. The `note` lines in the 85 files are authored copy (written at Riccardo's request, for him to review), not generated at build time.
The frame clicked on the home roll takes the place of `hero` for that visit.

How many shootings of a section appear on the home is set in `src/config.ts` (`HOME_LIMIT`); the rest live in the Archive.

## Configuration

| Variable                | Default   | Purpose                                              |
| :---------------------- | :-------- | :--------------------------------------------------- |
| `PUBLIC_PHOTO_BASE_URL` | none: **required** for production builds | Where the photo variants are served from (the Spaces CDN, or `/photos` for local files). The CSP in `vercel.json` must name its origin: run `pnpm headers` after changing it |
| `PUBLIC_PHOTO_CORS` | _(unset)_ | Set to `1` once the photo host sends CORS headers: the darkroom then fetches the sharp 1400 px print (otherwise it keeps the 700 px frame and skips the download) |
| `SITE_URL`              | `https://photos.canellariccardo.it` | Public address: canonical URLs, sitemap, Open Graph |

All site copy lives in `src/i18n/en.ts`. The Contact page hides any line left empty there (email, Instagram, place).

## Project layout

```text
reference/rullino.html            validated prototype: source of truth for look & feel
docs/SPEC.md                      full specification
src/
  content.config.ts               shooting schema
  content/shooting/<slug>/        one folder per shooting
  data/photos/<slug>.json         generated by `pnpm foto`
  pages/                          home, [section]/[slug], archive, contact
  components/                     Envelope, PrintFigure
  scripts/home/                   three.js roll (shaders, film, input, HUD)
  scripts/project/                envelope, prints, lightbox, negatives
  styles/ · layouts/ · lib/ · i18n/
tools/foto.mjs                    photo pipeline (hashed names, pruning)
tools/check.mjs                   pre-build consistency check
tools/redirects.mjs · headers.mjs vercel.json generators
tools/migrate.mjs                 old-site import
masters/ · public/photos/         originals and large variants, not in git
public/film/                      700 px frames for roll and negatives, in git
redirects.csv                     old URL → new URL, to wire up at deploy
```

## Status

| Phase | Scope                                               | State |
| :---- | :-------------------------------------------------- | :---- |
| 1     | Skeleton, schema, photo pipeline, migration         | done: real photos are in and the Vercel deploy is wired (GitHub Actions runs check, typecheck and build) |
| 2     | Shooting page (envelope, negatives, prints, next)   | done, checked with synthetic photos |
| 3     | Home roll                                           | done, checked with synthetic photos |
| 4     | Darkroom + transition                               | done, checked with real photos (needs bucket CORS for the sharp large print) |
| 5     | Mobile                                              | done in an emulator (vertical roll on portrait phones); to check on real devices |
| 6     | Performance, meta/OG, sitemap, redirects, DNS       | in progress: SEO, OG, sitemap, redirects, security headers and caching are done; left: real-device checks, bucket CORS, content pass, DNS switch |

The 85 shootings imported by `pnpm migrate` are **drafts**: dates are year-only, and names, titles, film stock, `selected` and `hero` need a manual pass.

## Deploy

Hosting: Vercel (static Astro build, config in `vercel.json`). Photos live on DigitalOcean Spaces (one bucket per site); `PUBLIC_PHOTO_BASE_URL` points the site at it. Details in `docs/GO-LIVE.md`. Erotics pages are indexed like the rest (user decision; they only carry `<meta name="rating" content="adult">` and their social preview never shows the picture); any shooting can be hidden from search with `noindex: true`.

## More

`CLAUDE.md` holds the working rules and the list of ideas already discarded.
