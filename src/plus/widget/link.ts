// The links a widget opens the app with (SPEC 9). Yes: `winzeroplus://checkin?goal=<id>&day=<day>&answer=yes`,
// which answers that goal's check-in as the notification's Yes does. Any app can open such a link,
// so it's read strictly: a goal id's shape, a real day, and only Yes.
import { isValidDayKey, type DayKey } from '@/engine';

export interface WidgetYes {
  goalId: string;
  day: DayKey;
}

/** A goal id as makeId writes it. */
const GOAL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** An optional scheme, any slashes, then the route and the query. */
const LINK = /^(?:[A-Za-z][A-Za-z0-9+.-]*:)?\/*([^?#]*)(?:\?([^#]*))?$/;
/** Links are short; anything longer isn't one. */
const MAX_LINK = 256;

export function yesLink(scheme: string, goalId: string, day: DayKey): string {
  return `${scheme}://checkin?goal=${encodeURIComponent(goalId)}&day=${day}&answer=yes`;
}

/** The round a widget's "round ready" opens: that goal's, on Play. */
export function playLink(scheme: string, goalId: string): string {
  return `${scheme}://play?goal=${encodeURIComponent(goalId)}`;
}

/** Home. */
export function homeLink(scheme: string): string {
  return `${scheme}://`;
}

/** A widget's Yes, or null for any other link. */
export function parseWidgetYes(url: string): WidgetYes | null {
  if (typeof url !== 'string' || url.length > MAX_LINK) return null;
  const match = LINK.exec(url);
  if (match?.[1]?.replace(/\/+$/, '') !== 'checkin') return null;
  const query = new Map<string, string>();
  for (const part of (match[2] ?? '').split('&')) {
    const eq = part.indexOf('=');
    if (eq <= 0) return null;
    const key = part.slice(0, eq);
    if (query.has(key)) return null;
    let value: string;
    try {
      value = decodeURIComponent(part.slice(eq + 1));
    } catch {
      return null;
    }
    query.set(key, value);
  }
  const goalId = query.get('goal') ?? '';
  const day = query.get('day') ?? '';
  if (query.size !== 3 || query.get('answer') !== 'yes' || !GOAL_ID.test(goalId) || !isValidDayKey(day)) return null;
  return { goalId, day };
}
