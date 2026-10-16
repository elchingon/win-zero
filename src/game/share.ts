// Sharing a milestone round as plain text, through the phone's own share sheet. The words come
// from shareText.ts, shared with the website.
import { Share } from 'react-native';

export { milestoneShareText } from './shareText';

/** Open the share sheet. Dismissing it, or a sheet that can't open, changes nothing. */
export function shareMilestone(message: string): void {
  Share.share({ message }).catch(() => {});
}
