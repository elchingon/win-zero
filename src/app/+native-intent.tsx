// Links from outside the app, before the router reads them (expo-router's native intent). A
// move's links (SPEC 9) wait in the inbox instead of becoming a route, so a move never sits in
// navigation state. A move link meant for the other app lands on Home; every other link goes on
// as it came. This runs outside React, and must never throw.
import { deliver } from '@/transfer/inbox';
import { parseLink } from '@/transfer/link';
import { FEATURES } from '@/variant';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
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
