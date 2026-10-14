// The app's state: the engine's GoalState plus UI preferences, persisted to device storage.
// Every action hands the clock and time zone to the engine; none re-implements a rule.
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import {
  answer as answerCheckIn,
  createGoal,
  currentCheckInTime,
  isMorningBeforeCheckIn,
  isUnlocked,
  missDigest,
  nextWindow,
  pendingWindow,
  resolve,
  setCheckInTime as setGoalCheckInTime,
  setGoalText as setGoalWording,
  setMorningTime as setGoalMorningTime,
  spendBomb as spendGoalBomb,
  type Answer,
  type AnswerResult,
  type ClockTime,
  type DayKey,
  type GoalState,
  type ResolveEvent,
  type TimeZone,
  type WeaponId,
} from '@/engine';
import { SEED_MAX_N, seedYesRun } from '@/dev/seedRun';

import { DEFAULT_PERSISTED, migratePersisted, normalizePersisted } from './migrate';
import { noticeForAnswer, noticeForMisses } from './notice';
import { STORE_KEY, STORE_VERSION, type Notice, type PersistedState, type Prefs, type RoundRecord } from './types';

export interface StoreDeps {
  storage: StateStorage;
  /** The device clock. */
  now: () => Date;
  /** The device time zone, read fresh on every call (it changes when the user travels). */
  timeZone: () => TimeZone;
  makeId: () => string;
  /** Development build: honour the debug clock offset. */
  dev: boolean;
}

export type SetupResult = { ok: true } | { ok: false; reason: 'not-ready' | 'empty-goal' | 'order' };
export type EditResult = { ok: true } | { ok: false; reason: 'no-goal' | 'empty-goal' | 'order' };

export interface AppState extends PersistedState {
  /** Storage has been read (or failed to read). Actions wait for it. */
  hydrated: boolean;
  /** A one-time screen waiting to be shown. Not persisted. */
  notice: Notice | null;

  /** The clock the app runs on: the device clock, plus the debug offset in development. */
  now: () => Date;
  timeZone: () => TimeZone;

  /** Settle closed windows and follow a time zone change. Run on launch and on foreground. */
  refresh: () => ResolveEvent[];
  setupGoal: (input: { goal: string; checkInTime: ClockTime; morningTime: ClockTime }) => SetupResult;
  /** Answer a check-in: `day` when it comes from a notification, otherwise the open window. */
  answer: (answer: Answer, day?: DayKey) => AnswerResult | null;
  finishRound: () => void;
  selectWeapon: (id: WeaponId) => void;
  spendBomb: () => boolean;
  setGoalText: (text: string) => EditResult;
  setCheckInTime: (time: ClockTime) => EditResult;
  setMorningTime: (time: ClockTime) => EditResult;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  /** The Slipping / Reset / Shielded screen for missed days not yet shown, marking them seen. */
  takeMissNotice: () => Notice | null;
  clearNotice: () => void;
  erase: () => void;
  advanceDevClock: (ms: number) => void;
  resetDevClock: () => void;
  /**
   * Development only: rebuild the goal as `n - 1` days of Yes, then answer Yes to the open
   * window, so a Day `n` round is ready. Overwrites the streak, history and rewards.
   */
  devJumpToDay: (n: number) => AnswerResult | null;
  /** Development only: move the clock to the moment the next check-in opens. */
  devSkipToNextCheckIn: () => void;
}

/** The debug skip lands just after the next window opens, not on its edge. */
const DEV_SKIP_SLACK_MS = 1000;

export type AppStore = ReturnType<typeof createAppStore>;

/** A round stays until the next day settles. */
function keepRound(round: RoundRecord | null, goal: GoalState): RoundRecord | null {
  return round && round.day === goal.lastSettledDay ? round : null;
}

function persisted(s: AppState): PersistedState {
  return {
    goal: s.goal,
    weapon: s.weapon,
    prefs: s.prefs,
    seenThrough: s.seenThrough,
    round: s.round,
    devClockOffsetMs: s.devClockOffsetMs,
  };
}

export function createAppStore(deps: StoreDeps) {
  const store = createStore<AppState>()(
    persist(
      (set, get, api) => {
        const now = () => new Date(deps.now().getTime() + (deps.dev ? get().devClockOffsetMs : 0));
        const timeZone = () => deps.timeZone();
        /** The goal, once storage has been read. Acting earlier would overwrite saved data. */
        const ready = () => (get().hydrated ? get().goal : null);

        /** Store a new goal state, dropping a round that's gone stale. */
        const setGoal = (goal: GoalState, patch: Partial<AppState> = {}) => {
          const round = 'round' in patch ? (patch.round ?? null) : get().round;
          set({ ...patch, goal, round: keepRound(round, goal) });
        };

        return {
          ...DEFAULT_PERSISTED,
          hydrated: false,
          notice: null,
          now,
          timeZone,

          refresh: () => {
            const goal = ready();
            if (!goal) return [];
            const r = resolve(goal, now(), timeZone());
            if (r.state !== goal) setGoal(r.state);
            return r.events;
          },

          setupGoal: ({ goal, checkInTime, morningTime }) => {
            if (!get().hydrated) return { ok: false, reason: 'not-ready' };
            if (!goal.trim()) return { ok: false, reason: 'empty-goal' };
            if (!isMorningBeforeCheckIn(morningTime, checkInTime)) return { ok: false, reason: 'order' };
            const state = createGoal({ goalId: deps.makeId(), goal, checkInTime, morningTime, now: now(), tz: timeZone() });
            set({ goal: state, weapon: null, seenThrough: null, round: null, notice: null });
            return { ok: true };
          },

          answer: (ans, day) => {
            const goal = ready();
            if (!goal) return null;
            const r = answerCheckIn(goal, { answer: ans, day }, now(), timeZone());
            if (!r.ok) {
              setGoal(r.state);
            } else if (r.outcome.kind === 'yes') {
              const { day, streak, rewards } = r.outcome;
              const newest = rewards.weapons.at(-1);
              setGoal(r.state, {
                // A newly unlocked weapon equips itself; otherwise the player's pick stands.
                weapon: newest ? newest.id : get().weapon,
                round: {
                  day,
                  n: streak,
                  rewards: {
                    bomb: rewards.bomb,
                    shield: rewards.shield,
                    shieldCapped: rewards.shieldCapped,
                    weapons: rewards.weapons.map((w) => w.id),
                  },
                  played: false,
                },
                notice: null,
              });
            } else {
              setGoal(r.state, { notice: noticeForAnswer(r.outcome, r.state) });
            }
            return r;
          },

          finishRound: () => {
            const { round } = get();
            if (round && !round.played) set({ round: { ...round, played: true } });
          },

          selectWeapon: (id) => {
            const goal = ready();
            if (goal && isUnlocked(id, goal.bestStreak)) set({ weapon: id });
          },

          spendBomb: () => {
            const goal = ready();
            if (!goal || goal.bombs < 1) return false;
            set({ goal: spendGoalBomb(goal) });
            return true;
          },

          setGoalText: (text) => {
            const goal = ready();
            if (!goal) return { ok: false, reason: 'no-goal' };
            if (!text.trim()) return { ok: false, reason: 'empty-goal' };
            set({ goal: setGoalWording(goal, text) });
            return { ok: true };
          },

          setCheckInTime: (time) => {
            const goal = ready();
            if (!goal) return { ok: false, reason: 'no-goal' };
            if (!isMorningBeforeCheckIn(goal.morningTime, time)) return { ok: false, reason: 'order' };
            setGoal(setGoalCheckInTime(goal, time, now(), timeZone()).state);
            return { ok: true };
          },

          setMorningTime: (time) => {
            const goal = ready();
            if (!goal) return { ok: false, reason: 'no-goal' };
            if (!isMorningBeforeCheckIn(time, currentCheckInTime(goal))) return { ok: false, reason: 'order' };
            set({ goal: setGoalMorningTime(goal, time) });
            return { ok: true };
          },

          setPref: (key, value) => set({ prefs: { ...get().prefs, [key]: value } }),

          takeMissNotice: () => {
            const goal = ready();
            if (!goal) return null;
            const { seenThrough } = get();
            const notice = noticeForMisses(missDigest(goal, seenThrough), goal);
            if (seenThrough !== goal.lastSettledDay) set({ seenThrough: goal.lastSettledDay });
            if (notice) set({ notice });
            return notice;
          },

          clearNotice: () => {
            if (get().notice) set({ notice: null });
          },

          erase: () => {
            set({ ...DEFAULT_PERSISTED, notice: null });
            api.persist.clearStorage();
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

          devJumpToDay: (n) => {
            const goal = ready();
            if (!deps.dev || !goal || !Number.isInteger(n) || n < 1 || n > SEED_MAX_N) return null;
            const seeded = seedYesRun(goal, n, now(), timeZone());
            // The old history is gone, so there's no missed-day news left to show.
            set({ goal: seeded, round: null, weapon: null, notice: null, seenThrough: seeded.lastSettledDay });
            return get().answer('yes');
          },

          devSkipToNextCheckIn: () => {
            if (!deps.dev || !ready()) return;
            get().refresh();
            const goal = get().goal;
            if (!goal || pendingWindow(goal, now())) return;
            get().advanceDevClock(nextWindow(goal).opensAt.getTime() - now().getTime() + DEV_SKIP_SLACK_MS);
          },
        };
      },
      {
        name: STORE_KEY,
        version: STORE_VERSION,
        storage: createJSONStorage(() => deps.storage),
        partialize: persisted,
        migrate: migratePersisted,
        merge: (stored, current) => ({ ...current, ...normalizePersisted(stored) }),
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
