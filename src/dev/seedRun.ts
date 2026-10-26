// Development builds only: rebuild a goal as if the user had answered Yes for a run of days,
// so "Jump to day N" can reach later weapons, armored zeros and big fills on a device. It only
// replays real answers through the engine; no rule is re-implemented here.
import {
  addDays,
  answer,
  checkInDays,
  createGoal,
  currentCheckInTime,
  dayKeyAt,
  MS_PER_MINUTE,
  nextGoalDay,
  opensAt,
  wallTimeToInstant,
  weekdayOf,
  type ClockTime,
  type DayKey,
  type GoalState,
  type TimeZone,
  type Weekday,
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
    days: checkInDays(state),
    now: wallTimeToInstant(firstDay, CREATED_AT, tz),
    tz,
  });
}

const isCheckInDay = (state: GoalState, day: DayKey) => checkInDays(state).includes(weekdayOf(day) as Weekday);

/**
 * The check-in day whose window is open at `now`: today once check-in time has passed, else the
 * check-in day before. On a rest day after the last one closed, that last one (left to resolve
 * as missed, as it would be).
 */
export function openDayAt(state: GoalState, now: Date, tz: TimeZone): DayKey {
  const today = dayKeyAt(now, tz);
  const probe = rebuilt(state, addDays(today, -7), tz);
  let day = today;
  while (!isCheckInDay(state, day) || opensAt(probe, day).getTime() > now.getTime()) day = addDays(day, -1);
  return day;
}

/**
 * The goal rebuilt with `n - 1` back-dated Yes answers on the check-in days just before the window
 * open at `now`, which is left pending. Answering Yes to it makes the streak `n`, with the
 * bombs, shields and unlocks a real run would have earned. The goal's wording, times and id
 * carry over; its history, streak and rewards are replaced.
 */
export function seedYesRun(state: GoalState, n: number, now: Date, tz: TimeZone): GoalState {
  if (!Number.isInteger(n) || n < 1 || n > SEED_MAX_N) {
    throw new RangeError(`Run length must be an integer from 1 to ${SEED_MAX_N}, got ${n}`);
  }
  const openDay = openDayAt(state, now, tz);
  let firstDay = openDay;
  for (let k = 1; k < n; k++) {
    firstDay = addDays(firstDay, -1);
    while (!isCheckInDay(state, firstDay)) firstDay = addDays(firstDay, -1);
  }
  let s = rebuilt(state, firstDay, tz);
  for (let day = firstDay; day < openDay; day = nextGoalDay(s, day)) {
    const at = new Date(opensAt(s, day).getTime() + ANSWER_AFTER_OPEN_MS);
    const r = answer(s, { answer: 'yes', day }, at, tz);
    if (!r.ok) throw new Error(`Seeding ${day} was rejected: ${r.reason}`);
    s = r.state;
  }
  return s;
}
