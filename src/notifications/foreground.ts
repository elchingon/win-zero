// What a notification does when it arrives while the app is open.
import type { NotificationBehavior } from 'expo-notifications';

import { readReminderData } from './shared';

const SHOW: NotificationBehavior = {
  shouldShowBanner: true,
  shouldShowList: true,
  shouldPlaySound: true,
  shouldSetBadge: false,
};
/** Kept in the notification list, without a banner or sound. */
const QUIET: NotificationBehavior = { ...SHOW, shouldShowBanner: false, shouldPlaySound: false };
const NONE: NotificationBehavior = { ...QUIET, shouldShowList: false };

/**
 * - Home: quiet, because its check-in card already asks the same question.
 * - Play: quiet, so a banner doesn't drop over a round.
 * - The weekly nudge: not at all, because the app is already open.
 * - Anywhere else: shown as usual.
 */
export function foregroundBehavior(path: string | null, data: unknown): NotificationBehavior {
  if (readReminderData(data)?.kind === 'reengage') return NONE;
  if (path === '/' || path === '/play') return QUIET;
  return SHOW;
}
