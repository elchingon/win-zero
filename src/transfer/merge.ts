// Taking a move from Win Zero into Win Zero Plus (SPEC 9): which goals arrive, which copy to keep
// of a goal Plus already has, and the credits. Pure, with the clock passed in. /import shows
// what planImport finds; once the user confirms, the store saves what applyImport returns
// (importMove). Every goal keeps its id, so a goal moved twice is recognised as the same one.
import { dayKeyAt, historyStats, type DayKey, type GoalState, type TimeZone } from '@/engine';
import type { Limits } from '@/store/limits';
import { arsenalBestOf } from '@/store/select';
import type { GoalSlot, ImportOutcome, PersistedState } from '@/store/types';

/** Which copy of a goal both apps have to keep: the one from Win Zero, or Plus's own. */
export type GoalCopy = 'incoming' | 'existing';
export type Choices = Readonly<Record<string, GoalCopy>>;

export interface GoalPreview {
  goalId: string;
  text: string;
  streak: number;
  bestStreak: number;
  yesDays: number;
  /** The latest day answered (Yes or Not today), if any. */
  lastAnswered: DayKey | null;
}

export interface IncomingGoal {
  incoming: GoalPreview;
  /** Plus's copy of the same goal, if it has one. */
  existing: GoalPreview | null;
  /** Plus's copy is archived: keeping the one from Win Zero brings the goal back. */
  archivedHere: boolean;
  /** There's room for the copy from Win Zero (bringing back an archived goal takes a slot). */
  canTakeIncoming: boolean;
  /** The copy kept unless the user picks the other. */
  suggested: GoalCopy;
}

export type ImportPlan =
  | { kind: 'preview'; goals: IncomingGoal[]; credits: { game: number; weapon: number }; takesSettings: boolean }
  /** This move is already here: Win Zero tried again without hearing back. */
  | { kind: 'already' }
  /** Plus's goals are full: one has to be archived first. */
  | { kind: 'full'; maxGoals: number };

/** What applyImport reads of Plus's state. */
export type ImportTarget = Pick<
  PersistedState,
  'goals' | 'archived' | 'arsenalBest' | 'weapon' | 'prefs' | 'credits' | 'imports'
>;

/**
 * The latest day the user answered, rather than one that settled as missed. Both apps settle
 * missed days up to the same day on opening, so only an answer tells which copy was in use.
 */
export function lastAnswered(goal: GoalState): DayKey | null {
  for (let i = goal.history.length - 1; i >= 0; i--) {
    const e = goal.history[i]!;
    if (e.result === 'yes' || e.result === 'no' || (e.result === 'shielded' && e.missedInRow === undefined)) return e.day;
  }
  return null;
}

/** The copy answered more recently, then the one settled later; Plus's own when they're even. */
export function suggestedCopy(incoming: GoalState, existing: GoalState): GoalCopy {
  const a = lastAnswered(incoming) ?? '';
  const b = lastAnswered(existing) ?? '';
  if (a !== b) return a > b ? 'incoming' : 'existing';
  const c = incoming.lastSettledDay ?? '';
  const d = existing.lastSettledDay ?? '';
  return c > d ? 'incoming' : 'existing';
}

function preview(goal: GoalState, today: DayKey): GoalPreview {
  return {
    goalId: goal.goalId,
    text: goal.goal,
    streak: goal.streak,
    bestStreak: goal.bestStreak,
    yesDays: historyStats(goal, today).yesDays,
    lastAnswered: lastAnswered(goal),
  };
}

/** Plus's copy of `goalId`, active or archived. */
function copyHere(current: Pick<PersistedState, 'goals' | 'archived'>, goalId: string) {
  const active = current.goals.find((s) => s.goal.goalId === goalId);
  if (active) return { goal: active.goal, archived: false };
  const archived = current.archived.find((a) => a.goal.goalId === goalId);
  return archived ? { goal: archived.goal, archived: true } : null;
}

/** Plus's active goals once the goals it doesn't have yet arrive. */
const activeAfter = (current: ImportTarget, incoming: PersistedState) =>
  current.goals.length + incoming.goals.filter((s) => !copyHere(current, s.goal.goalId)).length;

/** Room for Win Zero's copy: bringing back a goal archived here takes a free slot. */
const roomFor = (here: { archived: boolean }, active: number, limits: Limits) => !here.archived || active < limits.maxGoals;

/** The copy kept when the user doesn't pick: suggestedCopy, where there's room for it. */
const defaultCopy = (goal: GoalState, here: { goal: GoalState; archived: boolean }, active: number, limits: Limits): GoalCopy =>
  roomFor(here, active, limits) ? suggestedCopy(goal, here.goal) : 'existing';

/** What the move would bring, before anything changes. */
export function planImport(
  current: ImportTarget,
  incoming: PersistedState,
  opts: { transferId: string; limits: Limits; now: Date; tz: TimeZone },
): ImportPlan {
  if (opts.transferId in current.imports) return { kind: 'already' };
  const today = dayKeyAt(opts.now, opts.tz);
  const active = activeAfter(current, incoming);
  if (active > opts.limits.maxGoals) return { kind: 'full', maxGoals: opts.limits.maxGoals };
  const goals = incoming.goals.map(({ goal }): IncomingGoal => {
    const here = copyHere(current, goal.goalId);
    return {
      incoming: preview(goal, today),
      existing: here ? preview(here.goal, today) : null,
      archivedHere: here?.archived ?? false,
      canTakeIncoming: !here || roomFor(here, active, opts.limits),
      suggested: here ? defaultCopy(goal, here, active, opts.limits) : 'incoming',
    };
  });
  return { kind: 'preview', goals, credits: { ...incoming.credits.balance }, takesSettings: current.goals.length === 0 };
}

/**
 * Plus's state with the move taken in. `choices` picks the copy of each goal both apps have;
 * one not chosen keeps planImport's suggestion. The move's credits are added once per transfer
 * id, the rewards each app already paid stay paid, and the arsenal never reaches less.
 */
export function applyImport(
  current: ImportTarget,
  incoming: PersistedState,
  choices: Choices,
  opts: { transferId: string; createdAt: string; now: Date; limits: Limits },
): ImportOutcome {
  const goals: GoalSlot[] = [...current.goals];
  const archived = [...current.archived];
  const replaced: string[] = [];
  const active = activeAfter(current, incoming);
  for (const slot of incoming.goals) {
    const id = slot.goal.goalId;
    const here = copyHere(current, id);
    if (!here) {
      goals.push(slot);
      continue;
    }
    if ((choices[id] ?? defaultCopy(slot.goal, here, active, opts.limits)) === 'existing') continue;
    replaced.push(id);
    if (here.archived) {
      archived.splice(archived.findIndex((a) => a.goal.goalId === id), 1);
      goals.push(slot);
    } else {
      goals[goals.findIndex((s) => s.goal.goalId === id)] = slot;
    }
  }
  if (goals.length > opts.limits.maxGoals) return { ok: false, reason: 'full' };

  const known = new Set([...goals, ...archived].map((s) => s.goal.goalId));
  for (const a of incoming.archived) {
    if (!known.has(a.goal.goalId)) archived.push(a);
  }

  const already = opts.transferId in current.imports;
  const { game, weapon } = already ? { game: 0, weapon: 0 } : incoming.credits.balance;
  const claimed = [...new Set([...current.credits.claimed, ...incoming.credits.claimed])];
  const credits = {
    balance: { game: current.credits.balance.game + game, weapon: current.credits.balance.weapon + weapon },
    claimed,
  };
  const imports = already
    ? current.imports
    : { ...current.imports, [opts.transferId]: { at: opts.now.toISOString(), createdAt: opts.createdAt, game, weapon } };
  // Plus's own settings stand once it has a goal of its own.
  const empty = current.goals.length === 0;
  return {
    ok: true,
    state: {
      goals,
      archived,
      arsenalBest: Math.max(arsenalBestOf(current), arsenalBestOf(incoming)),
      weapon: empty ? incoming.weapon : current.weapon,
      prefs: empty ? incoming.prefs : current.prefs,
      credits,
      imports,
    },
    replaced,
  };
}
