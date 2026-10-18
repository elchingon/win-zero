# Win Zero

Daily habit app (iOS + Android): check in on one goal each day; every "yes" adds a zero to a shooting round.
The website at winzero.app (`website/`) hosts the privacy and support pages and a playable browser version.
**Win Zero Plus** (SPEC section 9) is a second, paid app built from this repo as a build variant: `EXPO_PUBLIC_APP_VARIANT=plus`.

- **Spec (source of truth):** `docs/SPEC.md`
- **Look & feel reference:** `docs/prototype/win-zero.html`, a playable single-file web prototype. Port its visuals, particle effects, celebration fill, and game feel. Do NOT port its streak rules; the spec replaces them.

## Stack
- Expo (latest SDK) + TypeScript (strict), expo-router
- Development build (expo-dev-client), not Expo Go, because actionable notifications and native modules need it
- Rendering: @shopify/react-native-skia + react-native-reanimated (game canvas, particles)
- State: zustand with persist (AsyncStorage)
- Notifications: expo-notifications (local only, categories with Yes / Not today actions)
- Feedback: expo-haptics, expo-audio
- Fonts: @expo-google-fonts/bungee, /barlow, /jetbrains-mono
- Dates: date-fns + date-fns-tz
- Tests: jest + jest-expo

## Layout
```
src/app/            expo-router screens (setup, index=home, play, notice, settings)
src/engine/         PURE logic, no React/Expo imports: rules.ts, resolve.ts, round.ts, weapons.ts, rewards.ts
src/game/           the round: GameCanvas, Hud, ResultSheet (shown inside play), sfx
  sim/              worklet physics, weapons, effects, fill (runs on the UI thread; unit-tested)
  draw/             worklet Skia scene, drawn from the baked atlas
  bake/             the per-round sprite atlas and paints, built on the JS thread
  look.ts           the round's look as numbers (glow, sprite sizes), shared with the website
src/notifications/  scheduling + response handling
src/store/          zustand store wrapping the engine
src/theme/          tokens.ts (palette + fonts from SPEC section 7)
src/ui/copy/        notice, rules and support copy, shared with the website
src/dev/            demo tools: seedRun.ts and demo.ts are shared with the website
src/variant/        which app this build is (Win Zero or Win Zero Plus) and its name; app code only
app.config.ts       app.json for Win Zero; EXPO_PUBLIC_APP_VARIANT=plus gives Plus its own ids, scheme and art (assets/brand-plus/)
website/            winzero.app: Vite + React, deployed by Cloudflare Pages (see website/README.md)
  src/play/         the browser app under /play; draws the round with src/game/draw via a Canvas 2D adapter
  plugins/          shared-code guard, pages from docs/store/*.md, brand assets
```

## Rules for working in this repo
- All streak/date/reward logic lives in `src/engine` as pure functions with unit tests. UI and notifications call the engine; they never re-implement rules.
- Every engine change ships with tests, including timezone, DST, multi-week-absence, and 7-missed-day reset cases. Run `npx jest` before saying a task is done.
- Treat `now` as an injected parameter (never call `Date.now()` inside the engine).
- Tunable numbers (HP, caps, damage, radii, reward intervals) live as named constants, not inline literals.
- Copy tone: supportive and plain. Never shaming; users may be working on sobriety.
- Keep the game at 60 fps on a mid-range Android phone with 60 objects + particles. Cap particle counts.
- Commit in small, working steps with clear messages.
- The website imports pure code from `src/` (the allowlist in `website/plugins/shared-guard.ts`, mirrored in the root ESLint config). Keep those files free of React Native, Expo and runtime Skia; move new shared logic into such a module rather than copying it into `website/`.
- Shared code never reads the variant or `process.env`: it takes names and limits as parameters, and only app code (`src/variant`) knows which app it is. Gate Plus-only code with the literal `process.env.EXPO_PUBLIC_APP_VARIANT === 'plus'` where it's required, so the free bundle drops it. Never set the variant in `.env`.
- `/privacy` and `/support` on winzero.app are built from `docs/store/privacy-policy.md` and `support.md`, and their URLs are in the app binaries and store listings: keep them working.

## Commands
- `npx expo start --dev-client`: run against the dev build
- `npx jest`: unit tests
- `npx tsc --noEmit`: type check
- `npm run gen:sfx`: re-render the game's sound effects into assets/sfx/ (from scripts/gen-sfx.mjs)
- `npm run gen:brand`: re-render the icons, splash and store art into assets/brand/ (from scripts/gen-brand.mjs); `gen:brand:plus` renders Plus's into assets/brand-plus/
- Win Zero Plus: `npm run start:plus`, `eas build --profile development-plus`, `npm run check:variants` (both apps' configs); see docs/RELEASE.md
- `eas build --profile development --platform ios|android`: build dev clients
- `npm run build:android`: build a release APK and AAB locally into build/ (no dev server needed), debug-signed; `npm run build:android:upload` signs with the upload key named in .env.signing; `npm run install:android` puts the APK on a plugged-in phone
- `npm run open:ios`: refresh ios/ from app.json and open it in Xcode, for building there
- Website, from `website/`: `npm run dev`, `npm run build && npm run verify`, `npm run typecheck`, `npm run lint`, `npm test` (Vitest)
