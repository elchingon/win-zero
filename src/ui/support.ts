// SPEC 6: a US support line for health-related goals, the app's own pages and support email,
// and opening links with a fallback for devices that can't (an iPad can't place calls; a phone
// may have no mail app).
import { Alert, Linking } from 'react-native';

/** SPEC 6: a US support line for health-related goals. Localize later. */
export const SUPPORT_LINE = {
  name: 'SAMHSA National Helpline',
  display: '1-800-662-4357',
  tel: 'tel:18006624357',
  detail: 'Free, confidential, 24/7.',
  text: 'Or text your ZIP code to 435748 (HELP4U) to find help near you.',
} as const;

/** A link from the environment, or null when it isn't set. */
export function linkFrom(value: string | undefined): string | null {
  const link = value?.trim();
  return link ? link : null;
}

/**
 * The privacy policy and support pages (App Review needs the privacy link in the app), and the
 * support email. The page URLs come from the environment, inlined when the app is bundled:
 * `.env` for local runs (see .env.example), each build profile's `env` in eas.json for EAS
 * builds. Unset, Settings leaves the row out, and a production EAS build stops
 * (scripts/check-release.mjs).
 */
export const APP_LINKS = {
  // Written out in full: Expo inlines only literal `process.env.EXPO_PUBLIC_*` reads.
  privacy: linkFrom(process.env.EXPO_PUBLIC_PRIVACY_URL),
  support: linkFrom(process.env.EXPO_PUBLIC_SUPPORT_URL),
  email: 'e7urgent@gmail.com',
} as const;

/**
 * Open `url`, or run `fallback` when the device can't. A failed open is the reliable signal:
 * canOpenURL reports false for schemes the app hasn't declared natively, even where they work.
 */
export function openOr(url: string, fallback: () => void): void {
  Linking.openURL(url).catch(fallback);
}

/** Call the helpline. Where calls aren't possible, give the number and the text option instead. */
export function callSupportLine(): void {
  openOr(SUPPORT_LINE.tel, () =>
    Alert.alert(
      "Calls aren't available on this device",
      `${SUPPORT_LINE.name}: ${SUPPORT_LINE.display}, from any phone. ${SUPPORT_LINE.detail}\n\n${SUPPORT_LINE.text}`,
    ),
  );
}

/** Open one of the app's pages in the browser, or say where it is. */
export function openPage(url: string): void {
  openOr(url, () => Alert.alert("Couldn't open the page", `It's at ${url}.`));
}

/** Start an email to support, or give the address when no mail app is set up. */
export function emailSupport(subject: string): void {
  openOr(`mailto:${APP_LINKS.email}?subject=${encodeURIComponent(subject)}`, () =>
    Alert.alert('No mail app is set up', `Email us at ${APP_LINKS.email}.`),
  );
}
