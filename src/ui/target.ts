// Touch targets: at least 44 points on iOS and 48 dp on Android, each platform's minimum. Android's
// Accessibility Scanner and Play's pre-launch report measure a control's own bounds, where hitSlop
// doesn't count, so a control gets its size from minWidth / minHeight. Around a visual that stays
// small, a negative margin (targetInset) takes the extra back where the layout must not move.
import { Platform } from 'react-native';

export const MIN_TARGET = Platform.OS === 'android' ? 48 : 44;

/** The margin that cancels what a `size`-point visual gains by growing to MIN_TARGET. */
export function targetInset(size: number): number {
  return -Math.max(0, (MIN_TARGET - size) / 2);
}
