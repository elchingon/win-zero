// The links a move uses between the two apps (SPEC 9). Win Zero opens Plus at
// `winzeroplus://import?t=<id>`, and on Android carries the move itself as `&d=`. Plus answers at
// `winzero://moved?t=<id>`. Any app can open these links, so they're read strictly, with a
// small parser rather than URL (React Native's is incomplete).
import { MOVE_ID_PATTERN } from '@/store/types';

import { MAX_PAYLOAD_CHARS, MOVE_PREFIX } from './codec';

export type MoveLink = { kind: 'import'; t: string; d: string | null } | { kind: 'moved'; t: string };

/** Room in a link beyond the move itself: the scheme, the route and the id. */
const LINK_OVERHEAD_CHARS = 256;
/** An optional scheme, any slashes, then the route and the query. */
const LINK = /^(?:[A-Za-z][A-Za-z0-9+.-]*:)?\/*([^?#]*)(?:\?([^#]*))?/;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

export function importLink(scheme: string, id: string, data?: string): string {
  const d = data ? `&d=${encodeURIComponent(data)}` : '';
  return `${scheme}://import?t=${encodeURIComponent(id)}${d}`;
}

export function movedLink(scheme: string, id: string): string {
  return `${scheme}://moved?t=${encodeURIComponent(id)}`;
}

/** The query's values by name, the first of a repeated name winning; null if one won't decode. */
function readQuery(query: string): Map<string, string> | null {
  const values = new Map<string, string>();
  for (const part of query.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    try {
      const key = decodeURIComponent(eq < 0 ? part : part.slice(0, eq));
      const value = decodeURIComponent(eq < 0 ? '' : part.slice(eq + 1));
      if (!values.has(key)) values.set(key, value);
    } catch {
      return null;
    }
  }
  return values;
}

const isPayload = (d: string) =>
  d.length <= MAX_PAYLOAD_CHARS && d.startsWith(MOVE_PREFIX) && BASE64URL.test(d.slice(MOVE_PREFIX.length));

/** A move's link, or null for any other link (those carry on to the router as they are). */
export function parseLink(url: string): MoveLink | null {
  if (typeof url !== 'string' || url.length > MAX_PAYLOAD_CHARS + LINK_OVERHEAD_CHARS) return null;
  const match = LINK.exec(url);
  const route = match?.[1]?.replace(/\/+$/, '');
  if (route !== 'import' && route !== 'moved') return null;
  const query = readQuery(match?.[2] ?? '');
  const t = query?.get('t');
  if (!query || !t || !MOVE_ID_PATTERN.test(t)) return null;
  if (route === 'moved') return { kind: 'moved', t };
  const d = query.get('d') ?? null;
  if (d !== null && !isPayload(d)) return null;
  return { kind: 'import', t, d };
}
