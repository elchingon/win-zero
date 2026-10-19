# Win Zero Plus — Gold Edition

The approved Plus identity uses an amber gold zero (`#FFB52E`) and a white plus on midnight navy (`#0D1130`). On white/light backgrounds, the plus is solid navy. The plus and zero share a horizontal centerline. Logo text is centered below the mark: **WIN ZERO**, then **PLUS** in gold. Typeface: the app's bundled Bungee.

All files in this folder belong to **Win Zero Plus**. Regular Win Zero and the website continue to use `assets/brand/`.

## App and store icons

| File | Pixels | Use |
| --- | --- | --- |
| `app-store-icon.png` | 1024 × 1024 | iOS default icon/App Store master; opaque RGB with no alpha channel |
| `icon.png` | 1024 × 1024 | Expo default and legacy launcher icon |
| `ios-icon-dark.png` | 1024 × 1024 | iOS dark appearance; transparent background |
| `ios-icon-tinted.png` | 1024 × 1024 | iOS tinted appearance; opaque grayscale, gamma 2.2 |
| `google-play-icon.png` | 512 × 512 | Play Console store icon; 32-bit RGBA PNG, all pixels opaque |
| `android-foreground.png` | 1024 × 1024 | Adaptive icon foreground, transparent |
| `android-background.png` | 1024 × 1024 | Full-bleed navy adaptive icon background |
| `android-monochrome.png` | 1024 × 1024 | White alpha mask for Android themed icons |
| `notification-icon.png` | 96 × 96 | White-on-transparent Android notification small icon |
| `favicon.png` | 64 × 64 | Plus web/favicon export |
| `play-feature-graphic.png` | 1024 × 500 | Play Console feature graphic; 24-bit RGB PNG without alpha |

Store icon masters are square, without baked-in rounded corners or drop shadows. Android adaptive foregrounds keep every nontransparent pixel inside the central 66/108 safe circle; launchers apply their own masks.

## Logos

| File | Pixels | Use |
| --- | --- | --- |
| `logo-light.png` | 1600 × 1400 | Stacked logo on white, solid navy plus and WIN ZERO text |
| `logo-dark.png` | 1600 × 1400 | Stacked logo on navy, white plus and WIN ZERO text |
| `logo-light-transparent.png` | 1600 × 1400 | Same light-background logo with transparent canvas |
| `logo-dark-transparent.png` | 1600 × 1400 | Same dark-background logo with transparent canvas |
| `mark-light.png` | 1024 × 1024 | Gold zero/navy plus without text, transparent |
| `mark-dark.png` | 1024 × 1024 | Gold zero/white plus without text, transparent |

## Splash artwork

| File | Pixels | Use |
| --- | --- | --- |
| `splash-mark.png` | 1024 × 1024 | Native iOS/Android launch mark; transparent with mask-safe padding |
| `splash.png` | 1200 × 2600 | Full-screen stacked-logo artwork displayed by the existing `LaunchSplash` component in both Plus apps |
| `splash-ios.png` | 1320 × 2868 | Additional portrait iPhone export |
| `splash-android.png` | 1080 × 2400 | Additional portrait Android export |

The operating-system splash displays the centered 0 + mark. The app's full-screen launch artwork then displays the stacked logo. Portrait exports are artwork, not captured store screenshots; keep actual app screenshots in the store listings.

## Preview, regeneration, and wiring

Open `brand-preview.png` to review the actual production exports. `manifest.json` records dimensions, PNG color types, and SHA-256 hashes for all 22 images.

```sh
npm run gen:brand:plus
npm run check:variants
```

The Plus command delegates to `scripts/gen-brand-plus.mjs`, renders clean glyphs with Skia, validates PNG formats and Android mask safety, and checks that regular Win Zero artwork remains byte-for-byte unchanged. It writes only into `assets/brand-plus/`. No generated concept-board image is used inside the app.

`app.config.ts` already remaps every icon/splash path into this folder when `EXPO_PUBLIC_APP_VARIANT=plus`. `src/ui/LaunchSplash.tsx` already selects this folder's `splash.png` for Plus. No app config changes are needed. Build a new Plus binary to see updated native icons and native splash resources; asset generation alone does not rebuild an installed app.

Production exports use the same Bungee zero as the existing app, with the approved colors, alignment, and stacked layout recreated at native export resolution. The source generator is the editable master.

## Format references

- [Expo SDK 57 icon configuration](https://docs.expo.dev/versions/v57.0.0/config/app/#icon)
- [Expo SDK 57 splash screen configuration](https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/)
- [Google Play icon specifications](https://developer.android.com/distribute/google-play/resources/icon-design-specifications)
- [Play Console icon and feature graphic requirements](https://support.google.com/googleplay/android-developer/answer/9866151)
- [Android adaptive icon guidance](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive)
