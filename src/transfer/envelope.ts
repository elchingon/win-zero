// A move from Win Zero to Win Zero Plus (SPEC 9), as it travels: the progress, and enough about
// where it came from to read it safely. Plus trusts none of it. The data is upgraded and read
// field by field with the store's own migration code, every goal is resolved once on trial, and
// only then is anything shown.
import { resolve, type IsoInstant, type TimeZone } from '@/engine';
import { GOAL_VERSION, hasUnreadableGoal, migratePersisted, normalizePersisted } from '@/store/migrate';
import { MOVE_ID_PATTERN, STORE_VERSION, type PersistedState } from '@/store/types';

import { decodeMove, encodeMove, MoveCodecError } from './codec';

export const MOVE_KIND = 'winzero.move';
/** The envelope's own shape, apart from the store's. */
export const MOVE_FORMAT = 1;

/** What moves: the progress, without this phone's debug clock, its card timers or move records. */
export type MoveState = Pick<PersistedState, 'goals' | 'archived' | 'arsenalBest' | 'weapon' | 'prefs' | 'credits'>;

export interface MoveEnvelope {
  kind: typeof MOVE_KIND;
  v: typeof MOVE_FORMAT;
  id: string;
  createdAt: IsoInstant;
  from: { appVersion: string; storeVersion: number };
  state: MoveState;
}

/**
 * The progress to send. A bonus round waiting to be played was paid for in credits, and the
 * round itself stays behind, so its credits travel instead: the Game credit, and the Weapon
 * credit of any weapon it borrowed.
 */
export function moveStateOf(s: MoveState & Pick<PersistedState, 'bonus'>): MoveState {
  const { goals, archived, arsenalBest, weapon, prefs, credits, bonus } = s;
  if (!bonus || bonus.played) return { goals, archived, arsenalBest, weapon, prefs, credits };
  const balance = { game: credits.balance.game + 1, weapon: credits.balance.weapon + bonus.borrowed.length };
  return { goals, archived, arsenalBest, weapon, prefs, credits: { ...credits, balance } };
}

/** The move, encoded. Throws a MoveCodecError (`too-large`) if it won't fit in a link. */
export function makeMove(input: {
  id: string;
  now: Date;
  appVersion: string;
  state: MoveState & Pick<PersistedState, 'bonus'>;
}): string {
  const envelope: MoveEnvelope = {
    kind: MOVE_KIND,
    v: MOVE_FORMAT,
    id: input.id,
    createdAt: input.now.toISOString(),
    from: { appVersion: input.appVersion, storeVersion: STORE_VERSION },
    state: moveStateOf(input.state),
  };
  return encodeMove(JSON.stringify(envelope));
}

/** Why a move can't be taken in: not one at all, from a newer app, damaged, or too big. */
export type MoveRefusal = 'not-a-move' | 'update-needed' | 'unreadable' | 'too-large';

export interface ReceivedMove {
  id: string;
  createdAt: IsoInstant;
  from: { appVersion: string; storeVersion: number };
  /** The progress, read as this build reads its own storage. */
  incoming: PersistedState;
}

export type MoveRead = ({ ok: true } & ReceivedMove) | { ok: false; reason: MoveRefusal };

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const refuse = (reason: MoveRefusal): MoveRead => ({ ok: false, reason });

/** The newest goal shape in raw store data, active or archived. */
function newestGoalVersion(raw: unknown): number {
  if (!isRecord(raw)) return 0;
  const slots = [...(Array.isArray(raw.goals) ? raw.goals : []), ...(Array.isArray(raw.archived) ? raw.archived : [])];
  return slots.reduce<number>((max, slot) => {
    const v = isRecord(slot) && isRecord(slot.goal) ? slot.goal.version : undefined;
    return typeof v === 'number' && v > max ? v : max;
  }, 0);
}

/**
 * Read a move that arrived under the link's id `id`. Anything this build can't be sure of is
 * refused whole, before the user is shown or asked anything.
 */
export function readMove(text: string, opts: { id: string; now: Date; tz: TimeZone }): MoveRead {
  let raw: unknown;
  try {
    raw = JSON.parse(decodeMove(text));
  } catch (error) {
    if (error instanceof MoveCodecError && error.reason !== 'corrupt') return refuse(error.reason);
    return refuse('unreadable');
  }
  if (!isRecord(raw) || raw.kind !== MOVE_KIND) return refuse('not-a-move');
  if (raw.v !== MOVE_FORMAT) return refuse(typeof raw.v === 'number' && raw.v > MOVE_FORMAT ? 'update-needed' : 'unreadable');
  // Credits pay once per id, and the reply names it, so the move must be the one the link named.
  if (typeof raw.id !== 'string' || raw.id !== opts.id || !MOVE_ID_PATTERN.test(raw.id)) return refuse('unreadable');
  const from = isRecord(raw.from) ? raw.from : {};
  const storeVersion = from.storeVersion;
  if (typeof storeVersion !== 'number' || !Number.isInteger(storeVersion) || storeVersion < 0) return refuse('unreadable');
  if (storeVersion > STORE_VERSION) return refuse('update-needed');
  if (typeof raw.createdAt !== 'string' || Number.isNaN(Date.parse(raw.createdAt))) return refuse('unreadable');
  if (!isRecord(raw.state)) return refuse('unreadable');

  const upgraded = migratePersisted(raw.state, storeVersion);
  if (newestGoalVersion(upgraded) > GOAL_VERSION) return refuse('update-needed');
  // The store keeps what it can of its own damaged data; a move is all or nothing.
  if (hasUnreadableGoal(upgraded)) return refuse('unreadable');
  const incoming = normalizePersisted(upgraded);
  try {
    for (const slot of incoming.goals) resolve(slot.goal, opts.now, opts.tz);
  } catch {
    return refuse('unreadable');
  }
  return {
    ok: true,
    id: raw.id,
    createdAt: raw.createdAt,
    from: { appVersion: typeof from.appVersion === 'string' ? from.appVersion : '', storeVersion },
    incoming,
  };
}
