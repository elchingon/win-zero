# Win Zero

Daily habit app (iOS + Android): check in on one goal each day; every "yes" adds a zero to a shooting round.

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
src/app/            expo-router screens (setup, index=home, play, result, settings)
src/engine/         PURE logic, no React/Expo imports: rules.ts, resolve.ts, round.ts, weapons.ts, rewards.ts
src/game/           Skia scene, physics, particles, hit testing, sfx
src/notifications/  scheduling + response handling
src/store/          zustand store wrapping the engine
src/theme/          tokens.ts (palette + fonts from SPEC section 7)
```

## Rules for working in this repo
- All streak/date/reward logic lives in `src/engine` as pure functions with unit tests. UI and notifications call the engine; they never re-implement rules.
- Every engine change ships with tests, including timezone, DST, multi-week-absence, and 7-missed-day reset cases. Run `npx jest` before saying a task is done.
- Treat `now` as an injected parameter (never call `Date.now()` inside the engine).
- Tunable numbers (HP, caps, damage, radii, reward intervals) live as named constants, not inline literals.
- Copy tone: supportive and plain. Never shaming; users may be working on sobriety.
- Keep the game at 60 fps on a mid-range Android phone with 60 objects + particles. Cap particle counts.
- Commit in small, working steps with clear messages.

## Commands
- `npx expo start --dev-client`: run against the dev build
- `npx jest`: unit tests
- `npx tsc --noEmit`: type check
- `eas build --profile development --platform ios|android`: build dev clients
