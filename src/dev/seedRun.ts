// Development builds only: rebuild a goal as if the user had answered Yes for a run of days,
// so "Jump to day N" can reach later weapons, armored zeros and big fills on a device. It only
// replays real answers through the engine; no rule is re-implemented here.
import {
  addDays,
  answer,
  createGoal,
  currentCheckInTime,
  dayKeyAt,
  MS_PER_MINUTE,
  opensAt,
  wallTimeToInstant,
  type ClockTime,
  type DayKey,
  type GoalState,
  type TimeZone,
} from '@/engine';

/** Longest run the debug tools will build. */
export const SEED_MAX_N = 1000;
/** Each back-dated Yes lands this long after its window opens. */
const ANSWER_AFTER_OPEN_MS = MS_PER_MINUTE;
/** Wall time the rebuilt goal is created at on its first day: clear of any DST change. */
const CREATED_AT: ClockTime = '12:00';

function rebuilt(state: GoalState, firstDay: DayKey, tz: TimeZone): GoalState {
  return createGoal({
    goalId: state.goalId,
    goal: state.goal,
    checkInTime: currentCheckInTime(state),
    morningTime: state.morningTime,
    now: wallTimeToInstant(firstDay, CREATED_AT, tz),
    tz,
  });
}

/** The day whose window is open at `now`: today once check-in time has passed, else yesterday. */
export function openDayAt(state: GoalState, now: Date, tz: TimeZone): DayKey {
  const today = dayKeyAt(now, tz);
  const probe = rebuilt(state, today, tz);
  return opensAt(probe, today).getTime() <= now.getTime() ? today : addDays(today, -1);
}

/**
 * The goal rebuilt with `n - 1` back-dated Yes answers on the days just before the window
 * open at `now`, which is left pending. Answering Yes to it makes the streak `n`, with the
 * bombs, shields and unlocks a real run would have earned. The goal's wording, times and id
 * carry over; its history, streak and rewards are replaced.
 */
export function seedYesRun(state: GoalState, n: number, now: Date, tz: TimeZone): GoalState {
  if (!Number.isInteger(n) || n < 1 || n > SEED_MAX_N) {
    throw new RangeError(`Run length must be an integer from 1 to ${SEED_MAX_N}, got ${n}`);
  }
  const openDay = openDayAt(state, now, tz);
  const firstDay = addDays(openDay, -(n - 1));
  let s = rebuilt(state, firstDay, tz);
  for (let day = firstDay; day < openDay; day = addDays(day, 1)) {
    const at = new Date(opensAt(s, day).getTime() + ANSWER_AFTER_OPEN_MS);
    const r = answer(s, { answer: 'yes', day }, at, tz);
    if (!r.ok) throw new Error(`Seeding ${day} was rejected: ${r.reason}`);
    s = r.state;
  }
  return s;
}
