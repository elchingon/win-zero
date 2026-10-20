// The app's state: the engine's goals plus UI preferences, persisted to device storage. Every
// action hands the clock and time zone to the engine; none re-implements a rule. Each goal lives in
// a slot with its own round and seen mark (SPEC 9); the arsenal, the credits and the bonus round
// are shared. The free app and the website keep one goal (Limits).
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import {
  answer as answerCheckIn,
  arsenalReach,
  availableModes,
  availableThemes,
  claimCredits,
  createGoal,
  EMPTY_WALLET,
  isBonusSize,
  isUnlocked,
  missDigest,
  MS_PER_DAY,
  newlyUnlockedThemes,
  nextWindow,
  pendingWindow,
  resolve,
  setCheckInDays as setGoalCheckInDays,
  setGoalAlias as setGoalLockScreenName,
  setCheckInTime as setGoalCheckInTime,
  setGoalText as setGoalWording,
  setMorningTime as setGoalMorningTime,
  spendBomb as spendGoalBomb,
  spendCredit,
  weaponCreditOffer,
  type Answer,
  type AnswerResult,
  type ClockTime,
  type DayKey,
  type GoalState,
  type ModeId,
  type ThemeId,
  type ResolveEvent,
  type TimeZone,
  type WeaponId,
} from '@/engine';
import type * as SeedRun from '@/dev/seedRun';

import { FREE_LIMITS, type Limits } from './limits';
import { DEFAULT_PERSISTED, hasUnreadableGoal, migratePersisted, normalizePersisted } from './migrate';
import { noticeForAnswer, noticeForMisses } from './notice';
import {
  STORE_BACKUP_KEY,
  STORE_KEY,
  STORE_VERSION,
  type AnswerSource,
  type CreditRound,
  type GoalSlot,
  type ImportOutcome,
  type LegacyCopy,
  type Notice,
  type PendingNotice,
  type PendingRoute,
  type PersistedState,
  type Prefs,
  type Rejection,
  type RoundRecord,
  type UndoNotToday,
} from './types';

export interface StoreDeps {
  storage: StateStorage;
  /** The device clock. */
  now: () => Date;
  /** The device time zone, read fresh on every call (it changes when the user travels). */
  timeZone: () => TimeZone;
  makeId: () => string;
  /** Development build: honour the debug clock offset. */
  dev: boolean;
  /** What this app allows: one goal, every day, unless the app says otherwise (Win Zero Plus). */
  limits?: Limits;
  /**
   * Development build: the run builder behind "Jump to day". Passed in, not imported, so a
   * production bundle leaves it out.
   */
  devTools?: Pick<typeof SeedRun, 'seedYesRun' | 'SEED_MAX_N'>;
}

export type AddGoalResult =
  | { ok: true; goalId: string }
  | { ok: false; reason: 'not-ready' | 'empty-goal' | 'full' | 'days-not-allowed' };
export type EditResult = { ok: true } | { ok: false; reason: 'no-goal' | 'empty-goal' | 'days-not-allowed' | 'no-days' };
export type ImportResult = ImportOutcome | { ok: false; reason: 'not-ready' };

export interface AppState extends PersistedState {
  /** Storage has been read (or failed to read). Actions wait for it. */
  hydrated: boolean;
  limits: Limits;
  /** One-time screens waiting to be shown after an answer, by goal. Not persisted. */
  notices: Readonly<Record<string, Notice>>;
  /**
   * Where the latest answer leads (its round, or its notice), waiting for Home to open it.
   * Set in the same update as the answer. A Yes from a notification leaves none: its round
   * waits on Home.
   * Not persisted.
   */
  route: PendingRoute | null;
  /** Why the latest answer was turned down, for Home's banner. Not persisted. */
  rejection: Rejection | null;
  /** The latest Not today, while it can still be taken back. Not persisted. */
  undo: UndoNotToday | null;

  /** The clock the app runs on: the device clock, plus the debug offset in development. */
  now: () => Date;
  /** How far `now` runs ahead of the device clock: the debug offset, or 0 outside development. */
  clockOffsetMs: () => number;
  timeZone: () => TimeZone;

  /** Settle every goal's closed windows and follow a time zone change. Run on launch and on foreground. */
  refresh: () => ResolveEvent[];
  /**
   * Set up a goal, after the others. Turned down when the app's goals are full (Limits), or for
   * check-in days the app doesn't offer.
   */
  addGoal: (input: {
    goal: string;
    checkInTime: ClockTime;
    morningTime: ClockTime;
    days?: readonly number[];
  }) => AddGoalResult;
  /** Set a goal aside: its history is kept to read, its reminders stop, and its slot is free. */
  archiveGoal: (goalId: string) => boolean;
  /** Remove an archived goal for good. Weapons it unlocked stay (arsenalBest). */
  deleteArchivedGoal: (goalId: string) => boolean;
  /** Answer a goal's check-in: `day` when it comes from a notification, otherwise the open window. */
  answer: (goalId: string, answer: Answer, day?: DayKey, source?: AnswerSource) => AnswerResult | null;
  /**
   * Take back the latest Not today, within `windowMs` of answering, while its check-in is still
   * open and no other day of that goal has settled. Restores the goal and round from just before it.
   */
  undoNotToday: (windowMs?: number) => boolean;
  /** The route the latest answer left, once. */
  takeRoute: () => PendingRoute | null;
  clearRejection: () => void;
  /** A goal's round: its last zero went. */
  finishRound: (goalId: string) => void;
  /**
   * Spend a Game credit on a bonus round of `n` zeros. Turned down without a goal or a credit,
   * for a size out of range, or while a bonus round waits to be played.
   */
  startBonusRound: (n: number) => boolean;
  /** The bonus round's last zero went. */
  finishBonusRound: () => void;
  /**
   * Spend a Weapon credit to lend `target`'s round weapon `id`: one the round's offer holds (not
   * yet unlocked, within the round's share), while that round waits to be played.
   */
  borrowWeapon: (target: CreditRound, id: WeaponId) => boolean;
  selectWeapon: (id: WeaponId) => void;
  /** Pick the game mode every round plays in: only one this app offers (Limits), so false otherwise. */
  setGameMode: (id: ModeId) => boolean;
  /** Pick the theme the round and Home's zeros wear: only one this app offers and the player has earned. */
  setTheme: (id: ThemeId) => boolean;
  /** Drop one of a goal's banked bombs, in that goal's round. */
  spendBomb: (goalId: string) => boolean;
  setGoalText: (goalId: string, text: string) => EditResult;
  /**
   * A goal's lock-screen name (SPEC 9): with "Goal in reminders" off and more than one goal,
   * reminders call the goal by it. Empty clears it. Trimmed, at most GOAL_ALIAS_MAX_LENGTH.
   */
  setGoalAlias: (goalId: string, alias: string) => EditResult;
  setCheckInTime: (goalId: string, time: ClockTime) => EditResult;
  setMorningTime: (goalId: string, time: ClockTime) => EditResult;
  /** The weekdays a goal checks in on, where the app offers that (Limits). */
  setCheckInDays: (goalId: string, days: readonly number[]) => EditResult;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  /** "Not now" on Home's reminders-off card: hide it for REMINDER_CARD_HIDE_MS. */
  hideReminderCard: () => void;
  /**
   * The next one-time screen, without marking it shown: an answer's notice first (`preferGoalId`'s,
   * then any), then the Slipping / Reset / Shielded news for missed days not yet shown, goal by goal.
   */
  nextNotice: (preferGoalId?: string) => PendingNotice | null;
  /** The Notice screen showed `p`: clear that answer's notice, or count those missed days as seen. */
  noticeShown: (p: PendingNotice) => void;
  /** Count missed days that cost nothing (the grace week, or paused) as seen, as they have no news. */
  markQuietMisses: () => void;
  /**
   * Win Zero: start, or try again, the move to Win Zero Plus (SPEC 9), and get its id. Every try
   * has the same id until the move is confirmed or cancelled, so Plus adds its credits once.
   * Null without a goal, or once moved.
   */
  startMoveOut: () => string | null;
  /**
   * Win Zero: Plus took in move `id`. Only the move this app sent counts. Reminders stop, and the
   * credits that went with it leave here (a waiting bonus round went as its credit); the rewards
   * already claimed stay claimed, so none pays twice.
   */
  confirmMovedOut: (id: string) => boolean;
  /** Win Zero: stop waiting on a move Plus hasn't confirmed. */
  cancelMoveOut: () => void;
  /** Win Zero: after a move, go on using this app. Its reminders come back. */
  keepUsingHere: () => void;
  /**
   * Win Zero Plus: take in a move. `merge` (src/transfer/merge.ts, passed in so shared code never
   * loads it) works out the new state from this one; news about a goal it replaced is dropped.
   */
  importMove: (merge: (current: PersistedState, now: Date) => ImportOutcome) => ImportResult;
  erase: () => void;
  advanceDevClock: (ms: number) => void;
  resetDevClock: () => void;
  /**
   * Development only: rebuild a goal as `n - 1` days of Yes, then answer Yes to the open window,
   * so a Day `n` round is ready. Overwrites its streak, history and rewards.
   */
  devJumpToDay: (goalId: string, n: number) => AnswerResult | null;
  /** Development only: move the clock to the moment the next check-in opens, if none is open. */
  devSkipToNextCheckIn: () => void;
  /** Development only: an empty wallet with nothing claimed, so every credit can be earned again. */
  devResetCredits: () => void;
}

/** The debug skip lands just after the next window opens, not on its edge. */
const DEV_SKIP_SLACK_MS = 1000;
/** How long a Not today can be taken back, for a mis-tap. */
export const UNDO_MS = 10_000;
/** With VoiceOver or TalkBack on: reaching the Undo button takes a few swipes. */
export const UNDO_MS_SCREEN_READER = 30_000;
/** "Not now" on Home's reminders-off card hides it this long. */
export const REMINDER_CARD_HIDE_MS = 7 * MS_PER_DAY;

export type AppStore = ReturnType<typeof createAppStore>;

/** A round stays until its goal's next day settles. */
function keepRound(round: RoundRecord | null, goal: GoalState): RoundRecord | null {
  return round && round.day === goal.lastSettledDay ? round : null;
}

/** `record` without `key`. */
function without<T>(record: Readonly<Record<string, T>>, key: string): Readonly<Record<string, T>> {
  if (!(key in record)) return record;
  const { [key]: _gone, ...rest } = record;
  return rest;
}

function persisted(s: AppState): PersistedState & LegacyCopy {
  const first = s.goals[0] ?? null;
  return {
    goals: s.goals,
    archived: s.archived,
    arsenalBest: s.arsenalBest,
    weapon: s.weapon,
    gameMode: s.gameMode,
    theme: s.theme,
    prefs: s.prefs,
    credits: s.credits,
    bonus: s.bonus,
    reminderCardHiddenUntil: s.reminderCardHiddenUntil,
    devClockOffsetMs: s.devClockOffsetMs,
    moveOut: s.moveOut,
    imports: s.imports,
    goal: first?.goal ?? null,
    round: first?.round ?? null,
    seenThrough: first?.seenThrough ?? null,
  };
}

export function createAppStore(deps: StoreDeps) {
  const limits = deps.limits ?? FREE_LIMITS;

  /** Write to storage without waiting. A failure leaves the app running as it is. */
  const writeAside = (write: () => unknown) => {
    try {
      void Promise.resolve(write()).catch(() => {});
    } catch {
      // as above
    }
  };

  const store = createStore<AppState>()(
    persist(
      (set, get, api) => {
        const clockOffsetMs = () => (deps.dev ? get().devClockOffsetMs : 0);
        const now = () => new Date(deps.now().getTime() + clockOffsetMs());
        const timeZone = () => deps.timeZone();
        /** A goal's slot, once storage has been read. Acting earlier would overwrite saved data. */
        const slotOf = (goalId: string): GoalSlot | null =>
          get().hydrated ? (get().goals.find((s) => s.goal.goalId === goalId) ?? null) : null;
        /** How far the shared arsenal reaches now. */
        const reach = () => arsenalReach(get().arsenalBest, get().goals.map((s) => s.goal));

        /** News of a goal's missed days after its seen mark, through its latest settled day. */
        const missedNews = (slot: GoalSlot): PendingNotice | null => {
          const { goal } = slot;
          if (!goal.lastSettledDay) return null;
          const notice = noticeForMisses(missDigest(goal, slot.seenThrough), goal);
          return notice ? { source: 'missed', goalId: goal.goalId, notice, through: goal.lastSettledDay } : null;
        };

        /** Store a goal's new state and patch its slot, dropping a round gone stale. */
        const setSlot = (goalId: string, goal: GoalState, slotPatch: Partial<GoalSlot> = {}, patch: Partial<AppState> = {}) => {
          set({
            ...patch,
            goals: get().goals.map((slot) => {
              if (slot.goal.goalId !== goalId) return slot;
              const round = 'round' in slotPatch ? (slotPatch.round ?? null) : slot.round;
              return { ...slot, ...slotPatch, goal, round: keepRound(round, goal) };
            }),
          });
        };

        /** A goal's missed days through `day` have been shown. Never moves back. */
        const seeThrough = (goalId: string, day: DayKey) => {
          const slot = slotOf(goalId);
          if (slot && (slot.seenThrough === null || day > slot.seenThrough)) setSlot(goalId, slot.goal, { seenThrough: day });
        };

        /** Run a goal edit through the engine, or say why not. */
        const edit = (goalId: string, change: (goal: GoalState) => GoalState): EditResult => {
          const slot = slotOf(goalId);
          if (!slot) return { ok: false, reason: 'no-goal' };
          setSlot(goalId, change(slot.goal));
          return { ok: true };
        };

        return {
          ...DEFAULT_PERSISTED,
          hydrated: false,
          limits,
          notices: {},
          route: null,
          rejection: null,
          undo: null,
          now,
          clockOffsetMs,
          timeZone,

          refresh: () => {
            if (!get().hydrated) return [];
            const t = now();
            const tz = timeZone();
            const events: ResolveEvent[] = [];
            let changed = false;
            const goals = get().goals.map((slot) => {
              const r = resolve(slot.goal, t, tz);
              events.push(...r.events);
              if (r.state === slot.goal) return slot;
              changed = true;
              return { ...slot, goal: r.state, round: keepRound(slot.round, r.state) };
            });
            if (changed) set({ goals });
            return events;
          },

          addGoal: ({ goal, checkInTime, morningTime, days }) => {
            const s = get();
            if (!s.hydrated) return { ok: false, reason: 'not-ready' };
            if (!goal.trim()) return { ok: false, reason: 'empty-goal' };
            if (s.goals.length >= limits.maxGoals) return { ok: false, reason: 'full' };
            if (days !== undefined && !limits.weekdaySchedules && days.length !== 7) {
              return { ok: false, reason: 'days-not-allowed' };
            }
            const state = createGoal({
              goalId: deps.makeId(),
              goal,
              checkInTime,
              morningTime,
              days,
              now: now(),
              tz: timeZone(),
            });
            set({
              goals: [...s.goals, { goal: state, round: null, seenThrough: null }],
              credits: claimCredits(s.credits, { type: 'goal', goal: state }).wallet,
            });
            return { ok: true, goalId: state.goalId };
          },

          archiveGoal: (goalId) => {
            const slot = slotOf(goalId);
            if (!slot) return false;
            const at = now();
            const goal = resolve(slot.goal, at, timeZone()).state;
            const s = get();
            set({
              goals: s.goals.filter((g) => g.goal.goalId !== goalId),
              archived: [...s.archived, { goal, archivedAt: at.toISOString() }],
              arsenalBest: Math.max(s.arsenalBest, goal.bestStreak),
              notices: without(s.notices, goalId),
              route: s.route?.goalId === goalId ? null : s.route,
              rejection: s.rejection?.goalId === goalId ? null : s.rejection,
              undo: s.undo?.goalId === goalId ? null : s.undo,
            });
            return true;
          },

          deleteArchivedGoal: (goalId) => {
            const s = get();
            const gone = s.archived.find((a) => a.goal.goalId === goalId);
            if (!s.hydrated || !gone) return false;
            set({
              archived: s.archived.filter((a) => a !== gone),
              arsenalBest: Math.max(s.arsenalBest, gone.goal.bestStreak),
            });
            return true;
          },

          answer: (goalId, ans, day, source = 'app') => {
            const slot = slotOf(goalId);
            if (!slot) return null;
            const at = now();
            const before = reach();
            const r = answerCheckIn(slot.goal, { answer: ans, day, arsenalBest: before }, at, timeZone());
            const { notices } = get();
            if (!r.ok) {
              setSlot(goalId, r.state, {}, { rejection: { reason: r.reason, goalId }, undo: null });
            } else if (r.outcome.kind === 'yes') {
              const { day, streak, rewards } = r.outcome;
              const newest = rewards.weapons.at(-1);
              const earned = claimCredits(get().credits, { type: 'yes', goal: r.state });
              // Earned themes this Yes opened, for the result sheet (SPEC 9). Left off the round
              // when there are none, so a round saved by Win Zero keeps its shape.
              const after = arsenalReach(
                get().arsenalBest,
                get().goals.map((other) => (other.goal.goalId === goalId ? r.state : other.goal)),
              );
              const themesEnabled = limits.themesEnabled;
              const unlocks = newlyUnlockedThemes(before, after, { themesEnabled }).map((t) => t.id);
              setSlot(
                goalId,
                r.state,
                {
                  round: {
                    day,
                    n: streak,
                    rewards: {
                      bomb: rewards.bomb,
                      shield: rewards.shield,
                      shieldCapped: rewards.shieldCapped,
                      weapons: rewards.weapons.map((w) => w.id),
                      credits: earned.granted,
                    },
                    borrowed: [],
                    played: false,
                    ...(unlocks.length > 0 ? { unlocks } : {}),
                  },
                },
                {
                  // A newly unlocked weapon equips itself; otherwise the player's pick stands.
                  weapon: newest ? newest.id : get().weapon,
                  credits: earned.wallet,
                  notices: without(notices, goalId),
                  route: source === 'notification' ? null : { path: '/play', goalId },
                  rejection: null,
                  undo: null,
                },
              );
            } else {
              const notice = noticeForAnswer(r.outcome, r.state);
              const undo: UndoNotToday = {
                goalId,
                day: r.outcome.day,
                at: at.getTime(),
                notice,
                entry: r.state.history.at(-1),
                before: { goal: slot.goal, round: slot.round },
              };
              setSlot(goalId, r.state, {}, {
                notices: notice ? { ...notices, [goalId]: notice } : without(notices, goalId),
                route: { path: '/notice', goalId },
                rejection: null,
                undo,
              });
            }
            return r;
          },

          undoNotToday: (windowMs = UNDO_MS) => {
            const { undo } = get();
            const slot = undo ? slotOf(undo.goalId) : null;
            if (!undo || !slot) return false;
            const t = now();
            // Restoring the old goal un-settles the answered day. Catch it up to now, then check
            // that day's check-in is the one still open, so it can be answered again.
            const restored = resolve(undo.before.goal, t, timeZone()).state;
            const ok =
              t.getTime() - undo.at < windowMs &&
              slot.goal.history.at(-1) === undo.entry &&
              pendingWindow(restored, t)?.day === undo.day;
            if (!ok) {
              set({ undo: null });
              return false;
            }
            setSlot(
              undo.goalId,
              restored,
              { round: undo.before.round },
              { notices: without(get().notices, undo.goalId), route: null, rejection: null, undo: null },
            );
            return true;
          },

          takeRoute: () => {
            const { route } = get();
            if (route) set({ route: null });
            return route;
          },

          clearRejection: () => {
            if (get().rejection) set({ rejection: null });
          },

          finishRound: (goalId) => {
            const slot = slotOf(goalId);
            if (slot?.round && !slot.round.played) setSlot(goalId, slot.goal, { round: { ...slot.round, played: true } });
          },

          startBonusRound: (n) => {
            const { hydrated, goals, credits, bonus } = get();
            if (!hydrated || goals.length === 0 || !isBonusSize(n) || credits.balance.game < 1 || (bonus && !bonus.played)) {
              return false;
            }
            set({ credits: spendCredit(credits, 'game'), bonus: { n, borrowed: [], played: false } });
            return true;
          },

          finishBonusRound: () => {
            const { bonus } = get();
            if (bonus && !bonus.played) set({ bonus: { ...bonus, played: true } });
          },

          borrowWeapon: (target, id) => {
            const { hydrated, goals, credits, bonus } = get();
            if (!hydrated || goals.length === 0) return false;
            const slot = target.round === 'daily' ? slotOf(target.goalId) : null;
            const record = target.round === 'daily' ? (slot?.round ?? null) : bonus;
            if (!record || record.played) return false;
            if (!weaponCreditOffer(credits, reach(), record.borrowed).some((w) => w.id === id)) return false;
            const borrowed = [...record.borrowed, id];
            const spent = spendCredit(credits, 'weapon');
            if (slot?.round) setSlot(slot.goal.goalId, slot.goal, { round: { ...slot.round, borrowed } }, { credits: spent });
            else if (bonus) set({ credits: spent, bonus: { ...bonus, borrowed } });
            return true;
          },

          selectWeapon: (id) => {
            const { hydrated, goals } = get();
            if (hydrated && goals.length > 0 && isUnlocked(id, reach())) set({ weapon: id });
          },

          setGameMode: (id) => {
            if (!get().hydrated) return false;
            if (!availableModes(reach(), { modesEnabled: limits.modesEnabled }).some((m) => m.id === id)) return false;
            set({ gameMode: id });
            return true;
          },

          setTheme: (id) => {
            if (!get().hydrated) return false;
            if (!availableThemes(reach(), { themesEnabled: limits.themesEnabled }).some((t) => t.id === id)) return false;
            set({ theme: id });
            return true;
          },

          spendBomb: (goalId) => {
            const slot = slotOf(goalId);
            if (!slot || slot.goal.bombs < 1) return false;
            setSlot(goalId, spendGoalBomb(slot.goal));
            return true;
          },

          setGoalText: (goalId, text) => {
            if (slotOf(goalId) && !text.trim()) return { ok: false, reason: 'empty-goal' };
            return edit(goalId, (goal) => setGoalWording(goal, text));
          },

          setGoalAlias: (goalId, alias) => edit(goalId, (goal) => setGoalLockScreenName(goal, alias)),

          setCheckInTime: (goalId, time) =>
            edit(goalId, (goal) => setGoalCheckInTime(goal, time, now(), timeZone()).state),

          setMorningTime: (goalId, time) => edit(goalId, (goal) => setGoalMorningTime(goal, time)),

          setCheckInDays: (goalId, days) => {
            if (!slotOf(goalId)) return { ok: false, reason: 'no-goal' };
            if (!limits.weekdaySchedules) return { ok: false, reason: 'days-not-allowed' };
            if (days.length === 0) return { ok: false, reason: 'no-days' };
            return edit(goalId, (goal) => setGoalCheckInDays(goal, days, now(), timeZone()).state);
          },

          setPref: (key, value) => set({ prefs: { ...get().prefs, [key]: value } }),

          hideReminderCard: () => {
            set({ reminderCardHiddenUntil: new Date(now().getTime() + REMINDER_CARD_HIDE_MS).toISOString() });
          },

          nextNotice: (preferGoalId) => {
            const { notices, goals } = get();
            const ordered = preferGoalId
              ? [...goals.filter((s) => s.goal.goalId === preferGoalId), ...goals.filter((s) => s.goal.goalId !== preferGoalId)]
              : goals;
            for (const { goal } of ordered) {
              const notice = notices[goal.goalId];
              if (notice) return { source: 'answer', goalId: goal.goalId, notice };
            }
            if (!get().hydrated) return null;
            for (const slot of ordered) {
              const news = missedNews(slot);
              if (news) return news;
            }
            return null;
          },

          noticeShown: (p) => {
            if (p.source === 'answer') {
              // Only the one shown: a newer answer's notice waits its turn.
              const { notices } = get();
              if (notices[p.goalId] === p.notice) set({ notices: without(notices, p.goalId) });
            } else {
              seeThrough(p.goalId, p.through);
            }
          },

          markQuietMisses: () => {
            if (!get().hydrated) return;
            for (const slot of get().goals) {
              const last = slot.goal.lastSettledDay;
              if (last && !missedNews(slot)) seeThrough(slot.goal.goalId, last);
            }
          },

          startMoveOut: () => {
            const { hydrated, goals, moveOut } = get();
            if (!hydrated || goals.length === 0 || moveOut?.status === 'moved') return null;
            const id = moveOut?.id ?? deps.makeId();
            set({ moveOut: { id, status: 'sent', sentAt: now().toISOString() } });
            return id;
          },

          confirmMovedOut: (id) => {
            const { hydrated, moveOut, credits, bonus } = get();
            if (!hydrated || moveOut?.id !== id || moveOut.status !== 'sent') return false;
            set({
              moveOut: { ...moveOut, status: 'moved' },
              credits: { ...credits, balance: EMPTY_WALLET.balance },
              bonus: bonus && !bonus.played ? null : bonus,
            });
            return true;
          },

          cancelMoveOut: () => {
            if (get().hydrated && get().moveOut?.status === 'sent') set({ moveOut: null });
          },

          keepUsingHere: () => {
            if (!get().hydrated || get().moveOut?.status !== 'moved') return;
            set({ moveOut: null });
            get().refresh();
          },

          importMove: (merge) => {
            const s = get();
            if (!s.hydrated) return { ok: false, reason: 'not-ready' };
            const outcome = merge(s, now());
            if (!outcome.ok) return outcome;
            const replaced = new Set(outcome.replaced);
            const mine = <T extends { goalId: string }>(x: T | null): T | null => (x && replaced.has(x.goalId) ? null : x);
            let { notices } = s;
            for (const id of replaced) notices = without(notices, id);
            set({ ...outcome.state, notices, route: mine(s.route), rejection: mine(s.rejection), undo: mine(s.undo) });
            get().refresh();
            return outcome;
          },

          erase: () => {
            set({ ...DEFAULT_PERSISTED, notices: {}, route: null, rejection: null, undo: null });
            api.persist.clearStorage();
            writeAside(() => deps.storage.removeItem(STORE_BACKUP_KEY));
          },

          advanceDevClock: (ms) => {
            if (!deps.dev || !get().hydrated) return;
            set({ devClockOffsetMs: get().devClockOffsetMs + ms });
            get().refresh();
          },

          resetDevClock: () => {
            if (!deps.dev || !get().hydrated) return;
            set({ devClockOffsetMs: 0 });
            get().refresh();
          },

          devJumpToDay: (goalId, n) => {
            const slot = slotOf(goalId);
            const tools = deps.dev ? deps.devTools : undefined;
            if (!tools || !slot || !Number.isInteger(n) || n < 1 || n > tools.SEED_MAX_N) return null;
            const seeded = tools.seedYesRun(slot.goal, n, now(), timeZone());
            const s = get();
            // The old history is gone, so there's no missed-day news left to show. The arsenal
            // follows the rebuilt run: only archived goals keep their share of it.
            setSlot(
              goalId,
              seeded,
              { round: null, seenThrough: seeded.lastSettledDay },
              {
                weapon: null,
                notices: without(s.notices, goalId),
                undo: null,
                arsenalBest: s.archived.reduce((best, a) => Math.max(best, a.goal.bestStreak), 0),
              },
            );
            return get().answer(goalId, 'yes');
          },

          devSkipToNextCheckIn: () => {
            if (!deps.dev || !get().hydrated || get().goals.length === 0) return;
            get().refresh();
            const t = now();
            const { goals } = get();
            if (goals.some((s) => pendingWindow(s.goal, t))) return;
            const next = Math.min(...goals.map((s) => nextWindow(s.goal).opensAt.getTime()));
            get().advanceDevClock(next - t.getTime() + DEV_SKIP_SLACK_MS);
          },

          devResetCredits: () => {
            if (deps.dev && get().hydrated) set({ credits: EMPTY_WALLET });
          },
        };
      },
      {
        name: STORE_KEY,
        version: STORE_VERSION,
        storage: createJSONStorage(() => deps.storage),
        partialize: persisted,
        // Upgraded, not yet read: `merge` reads it.
        migrate: (stored, version) => migratePersisted(stored, version) as PersistedState & LegacyCopy,
        merge: (stored, current) => {
          // A goal that can't be read would be lost the next time state is saved. Keep a copy
          // where nothing writes over it, so a fix can bring it back.
          if (hasUnreadableGoal(stored)) {
            const backup = JSON.stringify({ at: deps.now().toISOString(), state: stored });
            writeAside(() => deps.storage.setItem(STORE_BACKUP_KEY, backup));
          }
          return { ...current, ...normalizePersisted(stored) };
        },
        // Runs after a successful read and after a failed one (a corrupt blob), so the app
        // never waits on the splash screen forever.
        onRehydrateStorage: () => () => {
          queueMicrotask(() => store.setState({ hydrated: true }));
        },
      },
    ),
  );
  return store;
}
