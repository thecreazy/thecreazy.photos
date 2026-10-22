# Going live — step by step

State on 2026-10-22: Phases 1–3 are built. This document lists everything still missing before
`photos.canellariccardo.it` can point at the new site, in the order to do it.
Effort tags: **[R]** = Riccardo (content/accounts), **[C]** = code work, **[R+C]** = together.

---

## 0. Test report (what works today)

Test run: production build + `astro preview`, headless Chrome, **synthetic photos** for 6 shootings
(removed afterwards), 88 pages.

| Area | Result |
| :-- | :-- |
| Build | 88 pages, clean, `tsc` clean |
| Internal links (1,784 refs in `dist/`) | all resolve except `/photos/*` (expected: no real photos in the repo) |
| Home, desktop | WebGL roll renders, no JS errors; stepping with ← → and clicking the frame in the light opens the right shooting |
| Clicked frame → hero | works (clicked frame 2 → envelope shows print 2) |
| Home, no JS | HTML list of 87 shootings, visible |
| Home, reduced motion | loads, no errors |
| Shooting pages (models, B&W, travels, erotic) | images load, prints laid one by one, negatives sheet drawn, no horizontal scroll, Erotics has `noindex,nofollow` |
| Shooting page, no JS / reduced motion | hero print shown as a normal print / prints appear without the drop |
| Archive, Contact | fine |
| Mobile 390 px | no horizontal scroll, no errors; roll and envelope render, but **not designed for it yet** (Phase 5) |

**Problems found** (all in the list below):

1. **No `404.html`** — a wrong URL shows the host's default error page.
2. **No `sitemap`, no `robots.txt`.**
3. **No canonical / Open Graph tags** on any page; home, Archive and Contact also have **no meta description**.
4. **Contact page is empty** (no email/Instagram/place) — the lines are hidden while empty.
5. **Mobile nav**: the section index wraps onto three lines and touches the brand.
6. **Home asks for photos that don't exist** for every shooting without photos (404s per frame). Harmless once photos are uploaded.
7. Still not measured: real performance (needs real photos, a GPU, a phone), wheel/drag feel, flicker at high speed.

---

## 1. Content (the long part) — [R]

1. **Collect originals.** For each shooting you want online, export JPEGs (~2500 px long side, sRGB) into
   `masters/<slug>/`. File names must match the `photos:` list in the shooting's `index.md`
   (or edit the list). Slugs = the folder names in `src/content/shooting/`.
2. **Decide what goes online.** The migration made **85 drafts / 922 photos**. Models alone has 49 shootings.
   Remove or `home: false` what you don't want on the roll; `HOME_LIMIT` (Models: 12) caps the roll anyway.
3. **Fix the drafts**, per shooting: full date (`2025-03`), clean `name`/`title` (e.g. `sogia-repele-colors` is a typo
   inherited from the old site), `stock` if you know it, `selected` (the 3 frames for the roll), `hero`, optional `note`.
   Three Models entries look like Erotics: `benedetta-erotic-bw`, `benedetta-sexy-kinder`, `benedetta-transparent-lingerie`.
4. **Contact details**: fill `email`, `instagram`, `place` in `src/i18n/en.ts` (`contact`).
5. Run `pnpm foto` (all, or one slug), then `pnpm dev` and look at the result.

> Tip: do 5–10 shootings first, deploy, then add the rest. The pipeline is incremental.

## 2. Accounts and domain — [R]

1. **GitHub**: create a private repo, push the project (nothing to commit yet: `git init` is done, no commit).
2. **Cloudflare** account for the site (Pages, free plan). The domain `canellariccardo.it` should have its DNS on Cloudflare
   (or you add a CNAME at the current provider).
3. **DigitalOcean** account (needs a payment method). Photo hosting: see § 3.
4. Site host name: `photos.canellariccardo.it`.

## 3. Where to put the photos

**Decision: DigitalOcean Spaces** (5 $/month flat: 250 GiB storage + 1 TiB outbound transfer, built-in CDN;
overage 0.02 $/GiB storage, 0.01 $/GiB transfer — check the current price list when you sign up).
It will also host other sites' assets, so the layout below is meant to be reused.

Size for this site: ~922 photos × 7 files (AVIF+WebP at 3 widths + 1 film frame) ≈ 6.5k files, roughly 1–2 GB
(estimate, ~1.5 MB per photo). That is well inside the plan.

(Cheaper alternative considered: Cloudflare R2, free at this size. Spaces was chosen to keep several sites in one place.)

**Layout: one bucket per site** (separate CORS, separate access keys, separate domain):

```text
Spaces (region fra1, EU)
├── photos-riccardo        ← this site
│   └── <slug>/<file>-<width>.<avif|webp>, <file>-film.webp
├── <other-site-bucket>
└── …
```

**Steps**

1. DigitalOcean → Spaces Object Storage → create bucket `photos-riccardo`, region **fra1** (closest to Italy), **CDN enabled**,
   file listing **restricted**.
2. Spaces → Access Keys → create a key **limited to this bucket** (read/write/delete). Save key + secret in a password manager.
3. Bucket → Settings → **CORS** — **optional**: the roll, the negatives sheet and the darkroom fallback use same-origin frames
   (`public/film/`, committed to git), so the site works without it. CORS only makes the darkroom print sharp (it fetches the 1400 px
   variant from the bucket). At the time of writing Spaces ignored the rule we configured. Allowed origins: `https://photos.canellariccardo.it`, the `*.pages.dev` preview URL, `http://localhost:4321`;
   methods `GET`, `HEAD`.
4. Install [`rclone`](https://rclone.org/s3/#digitalocean-spaces) and create a remote `do` (provider `DigitalOcean`,
   endpoint `fra1.digitaloceanspaces.com`, the key from step 2).
5. Upload after every `pnpm foto`. Files must be public-readable:
   ```sh
   rclone sync public/photos do:photos-riccardo --s3-acl public-read --progress
   ```
   (`sync` mirrors deletions too; use `copy` if unsure.)
6. **Public URL**: start with the CDN endpoint `https://photos-riccardo.fra1.cdn.digitaloceanspaces.com`.
   A nicer `img.canellariccardo.it` is possible through the bucket's CDN → Edit → custom subdomain, but it needs a TLS certificate
   (DigitalOcean's free certificate normally requires the domain's DNS to be on DigitalOcean; otherwise upload your own).
   **To verify when we get there** — not needed for launch.
7. Cache: file names are **not** hashed. Set the CDN TTL to about a day while editing and raise it later,
   and use the CDN's *purge cache* when you replace a photo. If you'd rather cache for a year, the pipeline can add a content hash to the names (small change).
8. Keep `masters/` backed up elsewhere: the bucket only holds the web variants.

Site side: `PUBLIC_PHOTO_BASE_URL=https://photos-riccardo.fra1.cdn.digitaloceanspaces.com` (no trailing slash).

**Reusing it for other sites**: one bucket + one access key + one CORS list per site; nothing in the plan is per-site except the
bucket name. The total of all buckets counts against the same 250 GiB / 1 TiB.

## 4. Code to finish before launch — [C]

Ordered by importance. Items marked ★ are blockers.

1. ~~**Phase 4 — darkroom + transition.**~~ Done (shader and `DR_T` timings ported unchanged, shortened from the 2nd visit, skipped with reduced motion). Still to check on a real GPU and a phone.
2. ★ **Phase 5 — mobile.** Portrait layout for the roll, the darkroom and the envelope; touch swipe; nav that doesn't wrap onto the brand.
3. ★ **404 page** (`src/pages/404.astro`) in the site's style, with a link back to the roll.
4. ★ **SEO basics**: `@astrojs/sitemap` (excluding `/erotic/`), `robots.txt`, `site` in `astro.config.mjs`,
   canonical URLs, Open Graph / Twitter tags (title, description, image = the hero print variant), meta description on home/Archive/Contact,
   JSON-LD `Person`/`ImageObject` optional.
5. ★ **Redirects** from the old Adobe URLs: turn `redirects.csv` into Cloudflare Pages `public/_redirects`
   (`/old-slug /models/new-slug 301`). Needed because the current domain already has indexed pages.
6. **Favicon / social image**: replace the Astro default `favicon.svg`; make a 1200×630 `og.jpg`.
7. **Performance pass** (Lighthouse on a real build with real photos): font preload/subset, image `sizes`, home initial JS weight
   (three.js ~600 KB min), memory on phones, a mobile-GPU check of the shaders.
8. **Accessibility pass**: keyboard on the roll (← → Enter works; check focus on the HUD), `alt` text, contrast of HUD text, the lightbox focus trap.
9. **Real-device checks**: Safari (macOS + iOS), Firefox, an Android phone. WebGL fallbacks were only tested by disabling JS.
10. Nice to have: analytics (Cloudflare Web Analytics, no cookies), 18+ page-level notice if you ever change your mind about the gate.

## 5. Deploy the site — [R+C]

1. Push the repo to GitHub.
2. Cloudflare → Workers & Pages → Create → **Pages** → connect the repo.
   - Build command: `pnpm build`
   - Output directory: `dist`
   - Environment variables: `NODE_VERSION=22`, `PUBLIC_PHOTO_BASE_URL=<Spaces CDN URL from § 3>`
   - Pages detects pnpm from `packageManager`/lockfile. Make sure `pnpm-lock.yaml` is committed.
3. Check the `*.pages.dev` preview URL (this is the **test deploy**: do the checklist in § 6 there).
4. Add the custom domain `photos.canellariccardo.it` to the Pages project **only when ready to switch**.
   Until then the old Adobe site keeps that name, so you lose nothing.
5. Keep the old site reachable for a while (Adobe plan) in case something needs to be compared.

## 6. Pre-launch checklist (run on the `pages.dev` URL)

- [ ] Home loads, frames show real photos (CORS OK: no empty frames; check the browser console for CORS errors), no console errors
- [ ] Every section on the roll, timeline jumps, ← → / wheel / drag feel right
- [ ] Click a frame → darkroom → shooting page; clicked frame = hero print
- [ ] A shooting page: envelope opens, negatives sheet, prints, lightbox, next envelope, back link returns to `/#slug`
- [ ] Archive lists the right shootings; Contact has real details
- [ ] Mobile (real phone), Safari, Firefox
- [ ] Old URLs redirect (try 10 from `redirects.csv`)
- [ ] `robots.txt`, `sitemap.xml`, 404 page, OG preview (paste a link in WhatsApp/Slack)
- [ ] Erotics: `noindex`, not in the sitemap
- [ ] Lighthouse: Performance ≥ 90 on the shooting page, ≥ 80 on home (desktop); no CLS

## 7. Switch day — [R]

1. Lower the TTL of the current DNS record a day before.
2. Pages project → Custom domains → add `photos.canellariccardo.it` (move the DNS record from Adobe to Cloudflare Pages).
3. Re-run the checklist on the real domain, especially redirects and OG images.
4. Submit the sitemap to Google Search Console; verify the new property.
5. Update links elsewhere (Instagram bio, `canellariccardo.it`, email signature).
6. After a few weeks, cancel the Adobe Portfolio plan.

---

## Suggested order (shortest path to a public test)

1. § 2 accounts + § 3 Spaces bucket (1 hour)
2. § 1 first 5–10 shootings, `pnpm foto`, `rclone sync` (an evening)
3. § 5 deploy to `pages.dev`
4. § 4 items 1–5 (Phases 4–5, 404, SEO, redirects) — this is where most of the remaining work is
5. § 6 checklist → § 7 switch
