# winzero.app

The Win Zero website: a landing page, the privacy and support pages the app and store listings
link to, and the playable app under `/play`. Everything runs in the browser; there is no backend.
Cloudflare Pages deploys it from this repo, separately from the mobile app's EAS builds.

| Path | What | Source |
|---|---|---|
| `/` | Landing | `index.html` (the unlock list is built from `src/engine`) |
| `/privacy` | Privacy policy | `../docs/store/privacy-policy.md` |
| `/support` | Support | `../docs/store/support.md` |
| `/play/*` | The app, in React | `play.html`, `src/play/` |
| anything else | 404 | `404.html` |

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

## Editing the pages

- Privacy policy and support text: edit `../docs/store/privacy-policy.md` or `support.md`. The
  build fails if a `[PLACEHOLDER]` is left in.
- Header, footer and the app-store section: `partials/`.
- Styles: `src/site/` (`tokens.css` must match `src/theme/tokens.ts`; a test checks).

## Security

`public/_headers` sets one strict content security policy for the whole site: scripts, styles,
fonts and images from this origin only, with no inline code. To keep that working:

- No inline `<script>`, `<style>`, `style=""` or `on…=` attributes in HTML, and no `data:` URIs.
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
| Build watch paths, include | `website/*`, `src/*`, `docs/store/*`, `assets/sfx/*`, `assets/brand/*` |

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
curl -sI https://winzero.app/play/settings   # 200 (the app)
curl -sI https://winzero.app/nope      # 404
```
