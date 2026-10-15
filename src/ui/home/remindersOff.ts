// Whether Home shows the reminders-off card. The daily question reaches people through
// reminders, so the card shows while they're off: never turned on (Setup's "Not now"), or turned
// off in system settings. Its own "Not now" hides it for a while.
import type { IsoInstant } from '@/engine';
import type { ReminderPermission } from '@/notifications/permissions';

/** `permission` is null until it has been read; the card waits rather than flashing up. */
export function remindersCardVisible(permission: ReminderPermission | null, hiddenUntil: IsoInstant | null, now: Date): boolean {
  if (permission === null || permission === 'granted') return false;
  return hiddenUntil === null || now.getTime() >= Date.parse(hiddenUntil);
}
