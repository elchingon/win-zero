// SPEC 6: a US support line for health-related goals, and opening links with a fallback for
// devices that can't (an iPad can't place calls; a phone may have no mail app).
import { Alert, Linking } from 'react-native';

/** SPEC 6: a US support line for health-related goals. Localize later. */
export const SUPPORT_LINE = {
  name: 'SAMHSA National Helpline',
  display: '1-800-662-4357',
  tel: 'tel:18006624357',
  detail: 'Free, confidential, 24/7.',
  text: 'Or text your ZIP code to 435748 (HELP4U) to find help near you.',
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
