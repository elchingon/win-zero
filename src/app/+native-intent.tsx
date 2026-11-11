// Links from outside the app, before the router reads them (expo-router's native intent). A
// move's links (SPEC 9) wait in the inbox instead of becoming a route, so a move never sits in
// navigation state. A move link meant for the other app lands on Home; so does Win Zero Plus's
// widget Yes, which waits in its own inbox to be answered. Every other link goes on as it came.
// This runs outside React, and must never throw.
import { deliver } from '@/transfer/inbox';
import { parseLink } from '@/transfer/link';
import { FEATURES } from '@/variant';

// Win Zero Plus only: the literal comparison folds, so Win Zero's bundle leaves out widget links.
const PlusWidgetLinks: typeof import('@/plus/widget/links') | null =
  process.env.EXPO_PUBLIC_APP_VARIANT === 'plus'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/plus/widget/links')
    : null;

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const yes = PlusWidgetLinks ? PlusWidgetLinks.parseWidgetYes(path) : null;
    if (PlusWidgetLinks && yes) {
      PlusWidgetLinks.deliverWidgetYes(yes);
      return '/';
    }
    const link = parseLink(path);
    if (!link) return path;
    if (link.kind === 'import' && FEATURES.importIn) {
      deliver(link);
      return '/import';
    }
    if (link.kind === 'moved' && FEATURES.moveOut) deliver(link);
    return '/';
  } catch {
    return '/';
  }
}
