# winzero.app

The Win Zero website: a landing page for both apps, a page for Win Zero Plus, the privacy and
support pages the apps and store listings link to, and the playable app under `/play`. Everything
runs in the browser; there is no backend. Cloudflare Pages deploys it from this repo, separately
from the mobile app's EAS builds.

| Path | What | Source |
|---|---|---|
| `/` | Landing: Win Zero, its screenshots, the Plus promotion, the comparison, Get the app, FAQ | `index.html` |
| `/plus` | Win Zero Plus | `plus.html` |
| `/privacy` | Privacy policy | `../docs/store/privacy-policy.md` |
| `/support` | Support | `../docs/store/support.md` |
| `/play/*` | The app, in React | `play.html`, `src/play/` |
| `/llms.txt` | The site in Markdown, for AI assistants | `plugins/marketing.ts` |
| anything else | 404 | `404.html` |

The landing and Plus pages' lists, comparison and FAQs are built from `src/engine` and
`src/store/limits.ts` at build time (`plugins/landing.ts`, `plugins/marketing.ts`), so their
counts, unlock days and names can't drift from the apps.

`/privacy` and `/support` are built into app binaries (`EXPO_PUBLIC_PRIVACY_URL`,
`EXPO_PUBLIC_SUPPORT_URL`) and the store listings. Keep them working, with no redirect.

## Commands

Run these from `website/`:

```sh
npm ci              # install (website only; the app's node_modules isn't needed)
npm run dev         # dev server, with clean URLs (/privacy, /play/settings)
npm run build       # production build into dist/
npm run verify      # check dist/ before it ships (scripts/verify-dist.mjs)
npm run preview     # serve dist/
npm run typecheck
npm run lint
npm test            # Vitest
```

To try `_headers` and `_redirects` the way Cloudflare serves them, run
`npx wrangler pages dev dist` after a build.

## Sharing code with the app

The rules engine, store, game simulation and drawing code come straight from the app's `src/`
through the `@/` alias, so the website can't drift from the app's rules. Only pure TypeScript
can be shared:

- `plugins/shared-guard.ts` lists the `src/` paths the website may import, and fails the build on
  any other `src/` file or any native package (React Native, Expo, Skia at runtime).
- The website's own code uses the `~/` alias (`website/src/`).
- Shared files are compiled with this folder's `tsconfig.json` (`tsconfig` in `vite.config.ts`),
  because the app's tsconfig extends `expo/tsconfig.base`, which isn't installed here.

To share something new, move its pure part into a module with no React Native or Expo imports,
add that path to the allowlist, and keep the app importing it from the same place.

## The app under /play

`src/play/` is the phone app's screens in React: Setup, Home, the round, Notice, Settings and
How it works, with React Router (`router.tsx`, basename `/play`). It runs on the shared store
(`createAppStore`, wired to the browser in `store.ts`) and rules engine, so check-ins, the slide,
missed days and rewards behave exactly as on the phone.

- **The round:** the shared sim (`src/game/sim`) and drawing (`src/game/draw`) run unchanged in a
  `requestAnimationFrame` loop (`game/GameCanvas.tsx`). `game/skia/canvas.ts` implements the few
  Skia calls the drawing makes on a 2D canvas, and `tsconfig.json` points Skia's types at
  `game/skia/types.ts`, so a new Skia call in the app's drawing fails the website's type check.
  `game/bake.ts` is the web version of the app's sprite bake, from the same numbers
  (`src/game/look.ts`). The canvas drops from 2× to 1.5× or 1× resolution if a device can't keep
  up; the practice round's frame meter shows the current scale.
- **The site bar** (`ui/SiteBar.tsx`) keeps the website's links over every screen, the round
  too: Get the app, How it works, Win Zero Plus, Support and Privacy, folded under Menu in a
  narrow window. The round fills the window below it.
- **What differs from the phone:** no notifications (the copy says to come back at check-in time),
  no haptics, sounds through Web Audio, and progress saved in the browser's storage. If storage is
  blocked (a private window), the app runs from memory and says so. Changes in another tab are
  read back in.
- **Demo controls,** folded on Home and Settings: demo mode (`platform/mode.ts`) for the debug
  clock, Jump to day and practice rounds (`/play/round?practice=N`, honoured only in demo mode).
  Demo mode copies the progress into its own storage keys (`demo:`), so the real streak is never
  touched; leaving it throws the copy away. Outside it, a round of any size is a bonus round,
  paid for with a Game credit (`/play/round?round=bonus`).

## Testing

`npm test` runs Vitest: the canvas adapter (transforms, tints, blending), the shared round played
through every weapon to the result sheet and drawn through the adapter, storage and demo mode,
the build plugins and `verify-dist`, and the screens in jsdom (setup, Yes to the round, Not
today to the notice and Undo, credits: a bonus round and the Weapon credit question). The rules engine and sim keep their own Jest tests at the repo root.

Before a release, play it on real phones, a mid-range Android especially: a Day 60 round and a
practice round of 1,000 (in demo mode) should hold about 60 fps.

## Editing the pages

- Privacy policy and support text: edit `../docs/store/privacy-policy.md` or `support.md`. The
  build fails if a `[PLACEHOLDER]` is left in.
- Header and footer: `partials/`. The header marks the current page's link.
- **Store links:** `APPS` in `plugins/marketing.ts` holds each app's App Store and Google Play
  link, its Apple ID and Plus's price. Each link has `live`: until a listing is public, its button
  says "coming soon" and nothing links to it. Set `live: true` once the listing opens; the store
  buttons, structured data, `llms.txt` and Safari's Smart App Banner (App Store only) follow.
- **Screenshots:** the pages show web copies of the store screenshots, in `src/site/shots/`
  (WebP, with `shots.json` giving each one's caption for its alt text). After the store
  screenshots change (`npm run gen:store-shots` at the repo root), run `npm run gen:shots` here
  and commit what it writes. It needs `cwebp` (`brew install webp`). Which screenshots each page
  shows is `WEB_SHOTS` in `scripts/gen-shots.mjs`.
- Questions and answers: `homeFaqs` and `plusFaqs` in `plugins/marketing.ts`. The page shows them
  and the structured data repeats them, so they stay the same.
- Styles: `src/site/` (`tokens.css` must match `src/theme/tokens.ts`; a test checks).

## Search and AI assistants

- Each page has its own title, description, canonical URL and Open Graph tags. The 404 page and
  every `*.pages.dev` address are `noindex`.
- The landing and Plus pages carry schema.org structured data (`MobileApplication` for each app,
  `WebApplication` for `/play`, `FAQPage`), checked in Google's Rich Results Test after a deploy.
- `/llms.txt` sums the site up in Markdown, and `robots.txt` lets every crawler in.
- `public/sitemap.xml` lists the pages: add any new page there.

## Security

`public/_headers` sets one strict content security policy for the whole site: scripts, styles,
fonts and images from this origin only, with no inline code. To keep that working:

- No inline `<script>`, `<style>`, `style=""` or `on…=` attributes in HTML, and no `data:` URIs.
  The one exception is structured data (`<script type="application/ld+json">`), which browsers
  never run; `npm run verify` checks it parses.
  React's `style` prop is fine (it sets styles through the DOM). `npm run verify` checks the build.
- Nothing loads from another origin: fonts are self-hosted via `@fontsource`. There are no
  analytics, cookies or third-party scripts, which is what the privacy policy promises.
- Adding a backend, login or shop later means adding its origin to `connect-src` (and a payment
  provider's to the relevant directives) on purpose, with the privacy policy updated to match.

## Cloudflare Pages setup

Connect the GitHub repo in Cloudflare → Workers & Pages → Create → Pages → Connect to Git:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Framework preset | None |
| Root directory | `website` |
| Build command | `npm ci && npm run build && npm run verify` |
| Build output directory | `dist` |
| Environment variables | `NODE_VERSION` = `22`, `SKIP_DEPENDENCY_INSTALL` = `1` |
| Build watch paths, include | `website/*`, `src/*`, `docs/store/*`, `assets/sfx/*`, `assets/brand/*`, `assets/brand-plus/*` |

- Every pull request branch gets a preview deployment. `_headers` marks every `*.pages.dev` address `noindex`.
- Custom domain: add `winzero.app` under the project's Custom domains. The zone should be on
  Cloudflare's nameservers. Add `www.winzero.app` too, and redirect it to the apex with a
  Redirect Rule (`_redirects` can't match hostnames).
- In the `winzero.app` zone, keep these **off**. Each injects scripts or rewrites HTML, which the
  content security policy blocks: Email Address Obfuscation, Rocket Loader, Zaraz, Web Analytics
  (automatic setup), and the JavaScript detections in Bot Fight Mode.
- Turn on **Always Use HTTPS**.
- If the build can't see `../src` with the root directory set to `website`, leave the root directory empty
  and use `npm ci --prefix website && npm run build --prefix website && npm run verify --prefix website`
  with output directory `website/dist`.

After the first production deploy:

```sh
curl -sI https://winzero.app/privacy   # 200, with the security headers, no redirect
curl -sI https://winzero.app/support   # 200
curl -sI https://winzero.app/plus      # 200
curl -s https://winzero.app/llms.txt | head -3
curl -sI https://winzero.app/play/settings   # 200 (the app)
curl -sI https://winzero.app/nope      # 404
```
