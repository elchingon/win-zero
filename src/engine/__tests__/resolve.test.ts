import { describe, expect, it } from '@jest/globals';

import { addDays, diffDays } from '../dates';
import { answer, resolve, setCheckInTime } from '../resolve';
import type { GoalState } from '../types';
import { closesAt, latestScheduleEntry, opensAt, pendingWindow } from '../windows';
import {
  at,
  answerDay,
  DAY0,
  DENVER,
  HONOLULU,
  iso,
  KIRITIMATI,
  LA,
  LONDON,
  NEW_YORK,
  newGoal,
  PAGO_PAGO,
  seeded,
  TOKYO,
  yesDays,
} from './fixtures';

const HOUR = 3_600_000;

function expectConsecutiveHistory(state: GoalState) {
  state.history.forEach((e, i) => expect(e.day).toBe(addDays(state.firstDay, i)));
}

describe('resolve', () => {
  it('is idempotent', () => {
    const s = yesDays(newGoal(), DAY0, 4);
    const once = resolve(s, at('2026-10-25', '08:00'), DENVER);
    const twice = resolve(once.state, at('2026-10-25', '08:00'), DENVER);
    expect(once.events.length).toBeGreaterThan(0);
    expect(twice.events).toEqual([]);
    expect(twice.state).toEqual(once.state);
  });

  it('gives the same result whether it runs once or in steps', () => {
    const s = yesDays(newGoal(), DAY0, 9);
    const start = at('2026-10-22', '00:00').getTime();
    const rand = seeded(42);
    for (let i = 0; i < 60; i++) {
      const a = start + rand() * 40 * 24 * HOUR;
      const b = a + rand() * 20 * 24 * HOUR;
      const stepped1 = resolve(s, new Date(a), DENVER);
      const stepped2 = resolve(stepped1.state, new Date(b), DENVER);
      const direct = resolve(s, new Date(b), DENVER);
      expect(stepped2.state).toEqual(direct.state);
      expect([...stepped1.events, ...stepped2.events]).toEqual(direct.events);
    }
  });

  it('ignores a clock that moves backwards', () => {
    const s = resolve(yesDays(newGoal(), DAY0, 3), at('2026-10-30', '21:00'), DENVER).state;
    const back = resolve(s, at('2026-10-14', '09:00'), DENVER);
    expect(back.events).toEqual([]);
    expect(back.state).toEqual(s);
  });

  it('records a missed day at its window close, midnight ending the next day, in the window time zone', () => {
    expect(resolve(newGoal(), at('2026-10-14', '23:59'), DENVER).events).toEqual([]);
    const { state } = resolve(newGoal(), at('2026-10-15', '00:00'), DENVER);
    expect(state.history).toEqual([
      {
        id: 'g1:2026-10-13',
        day: '2026-10-13',
        result: 'missed',
        at: at('2026-10-15', '00:00').toISOString(),
        tz: DENVER,
        streakAfter: 0,
        missedInRow: 1,
      },
    ]);
  });

  it('handles a weeks-long absence', () => {
    const before = yesDays(newGoal(), DAY0, 20); // through 11-01; 4 bombs, 2 shields
    const { state, events } = resolve(before, at('2026-12-18', '00:30'), DENVER);

    expect(events).toHaveLength(45); // 11-02 .. 12-16
    expect(events[0]?.day).toBe('2026-11-02');
    expect(events[44]?.day).toBe('2026-12-16');
    // Seven free days, then slides of six zeros; the first two finals spend the shields.
    expect(events.map((e) => e.streakAfter)).toEqual([
      ...Array(7).fill(20),
      19, 18, 17, 16, 15, 14, 14,
      13, 12, 11, 10, 9, 8, 8,
      7, 6, 5, 4, 3, 2, 0,
      ...Array(17).fill(0),
    ]);
    expect(events.map((e) => e.missedInRow)).toEqual(Array.from({ length: 45 }, (_, i) => i + 1));
    expect(events.filter((e) => e.final).map((e) => [e.day, e.final])).toEqual([
      ['2026-11-15', 'shielded'],
      ['2026-11-22', 'shielded'],
      ['2026-11-29', 'reset'],
    ]);
    expect(events.filter((e) => e.paused).map((e) => e.day)[0]).toBe('2026-11-30');
    expect(events.filter((e) => e.paused)).toHaveLength(17);

    expect(state).toMatchObject({
      streak: 0,
      bestStreak: 20,
      runPeak: 0,
      bombs: 4,
      shields: 0,
      consecutiveMissed: 45,
      slide: 0,
      paused: true,
      lastSettledDay: '2026-12-16',
    });
    expect(state.history.filter((e) => e.result === 'shielded')).toHaveLength(2);
    expect(state.history).toHaveLength(65);
    expect(state.history.slice(0, 20)).toEqual(before.history); // append-only
    expectConsecutiveHistory(state);
    expect(pendingWindow(state, at('2026-12-18', '00:30'))?.day).toBe('2026-12-17');

    const back = answerDay(state, '2026-12-17', 'yes', { timeDay: '2026-12-18', time: '00:30' });
    expect(back.state.streak).toBe(1);
    expect(back.state).toMatchObject({ consecutiveMissed: 0, paused: false });
  });

  it('settles exactly one day per calendar day across the fall-back change', () => {
    const s = newGoal({ day: '2026-10-27' });
    const { state, events } = resolve(s, at('2026-11-06', '00:30'), DENVER);
    expect(events.map((e) => e.day)).toEqual([
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
    ]);
    const atOf = (day: string) => state.history.find((e) => e.day === day)?.at;
    expect(atOf('2026-10-30')).toBe('2026-11-01T06:00:00.000Z'); // 00:00 MDT on 11-01
    expect(atOf('2026-10-31')).toBe('2026-11-02T07:00:00.000Z'); // 00:00 MST on 11-02
  });

  it('slides one zero per missed day across the fall-back change', () => {
    const s = { ...yesDays(newGoal(), DAY0, 10), shields: 0 }; // through 10-22
    const { state, events } = resolve(s, at('2026-11-06', '00:00'), DENVER); // 10-23 .. 11-04 closed
    const slips = events.filter((e) => e.slip !== null);
    expect(slips.map((e) => [e.day, e.slip, e.streakAfter])).toEqual([
      ['2026-10-30', 1, 9],
      ['2026-10-31', 2, 8], // the 29-hour window
      ['2026-11-01', 3, 7],
      ['2026-11-02', 4, 6],
      ['2026-11-03', 5, 5],
      ['2026-11-04', 6, 4],
    ]);
    const atOf = (day: string) => state.history.find((e) => e.day === day)?.at;
    expect(atOf('2026-10-31')).toBe('2026-11-02T07:00:00.000Z'); // 00:00 MST on 11-02
    expectConsecutiveHistory(state);
  });

  it('settles exactly one day per calendar day across the spring-forward change', () => {
    const s = newGoal({ day: '2027-03-10' });
    const { state, events } = resolve(s, at('2027-03-19', '00:30'), DENVER);
    expect(events.map((e) => e.day)).toEqual([
      '2027-03-10',
      '2027-03-11',
      '2027-03-12',
      '2027-03-13',
      '2027-03-14',
      '2027-03-15',
      '2027-03-16',
      '2027-03-17',
    ]);
    const atOf = (day: string) => state.history.find((e) => e.day === day)?.at;
    expect(atOf('2027-03-12')).toBe('2027-03-14T07:00:00.000Z'); // 00:00 MST on 03-14
    expect(atOf('2027-03-13')).toBe('2027-03-15T06:00:00.000Z'); // 00:00 MDT on 03-15
  });

  it('handles a check-in time inside the DST gap and overlap', () => {
    const gap = newGoal({ day: '2027-03-12', checkInTime: '02:30', morningTime: '01:00' });
    expect(opensAt(gap, '2027-03-14').toISOString()).toBe('2027-03-14T09:30:00.000Z'); // 03:30 MDT
    expect(closesAt(gap, '2027-03-13').toISOString()).toBe('2027-03-15T06:00:00.000Z'); // 00:00 MDT on 03-15
    expect(closesAt(gap, '2027-03-13').getTime() - opensAt(gap, '2027-03-13').getTime()).toBe(44.5 * HOUR);
    const g = resolve(gap, at('2027-03-17', '12:00'), DENVER);
    expect(g.events.map((e) => e.day)).toEqual(['2027-03-12', '2027-03-13', '2027-03-14', '2027-03-15']);

    const overlap = newGoal({ day: '2026-10-30', checkInTime: '01:30', morningTime: '01:00' });
    expect(opensAt(overlap, '2026-11-01').toISOString()).toBe('2026-11-01T07:30:00.000Z'); // first 01:30
    expect(closesAt(overlap, '2026-10-31').toISOString()).toBe('2026-11-02T07:00:00.000Z'); // 00:00 MST on 11-02
    expect(closesAt(overlap, '2026-10-31').getTime() - opensAt(overlap, '2026-10-31').getTime()).toBe(47.5 * HOUR);
    const o = resolve(overlap, at('2026-11-04', '12:00'), DENVER);
    expect(o.events.map((e) => e.day)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  });
});

describe('answer', () => {
  it('rejects answers before the first window opens', () => {
    const r = answer(newGoal(), { answer: 'yes' }, at(DAY0, '13:00'), DENVER);
    expect(r).toMatchObject({ ok: false, reason: 'not-open' });
  });

  it('rejects a day whose window has not opened', () => {
    const r = answer(newGoal(), { answer: 'yes', day: '2026-10-15' }, at(DAY0, '21:00'), DENVER);
    expect(r).toMatchObject({ ok: false, reason: 'not-open' });
  });

  it('answers yesterday the next morning, before the window closes', () => {
    const r = answer(newGoal(), { answer: 'yes' }, at('2026-10-14', '09:30'), DENVER);
    expect(r).toMatchObject({ ok: true, outcome: { kind: 'yes', day: DAY0, streak: 1 } });
  });

  it("answers yesterday all the next day, even after today's check-in opens; then today is next", () => {
    const late = at('2026-10-14', '23:30');
    const r = answer(newGoal(), { answer: 'yes' }, late, DENVER);
    expect(r).toMatchObject({ ok: true, events: [], outcome: { kind: 'yes', day: DAY0, streak: 1 } });
    const today = answer(r.state, { answer: 'yes' }, late, DENVER);
    expect(today).toMatchObject({ ok: true, outcome: { kind: 'yes', day: '2026-10-14', streak: 2 } });
  });

  it("turns down today's notification while yesterday is still open, and leaves yesterday pending", () => {
    const evening = at('2026-10-14', '21:00');
    const r = answer(newGoal(), { answer: 'yes', day: '2026-10-14' }, evening, DENVER);
    expect(r).toMatchObject({ ok: false, reason: 'not-open', events: [] });
    expect(pendingWindow(r.state, evening)?.day).toBe(DAY0);
  });

  it('is idempotent: a second tap on the same day is rejected without changes', () => {
    const first = answerDay(newGoal(), DAY0, 'yes');
    const again = answer(first.state, { answer: 'yes', day: DAY0 }, at(DAY0, '21:05'), DENVER);
    expect(again).toMatchObject({ ok: false, reason: 'already-answered' });
    expect(again.state).toEqual(first.state);
    const flip = answer(first.state, { answer: 'not-today', day: DAY0 }, at(DAY0, '21:06'), DENVER);
    expect(flip).toMatchObject({ ok: false, reason: 'already-answered' });
  });

  it('rejects a stale notification for a closed window, and still catches up', () => {
    const r = answer(newGoal(), { answer: 'yes', day: DAY0 }, at('2026-10-15', '00:30'), DENVER);
    expect(r).toMatchObject({ ok: false, reason: 'expired' });
    expect(r.events).toEqual([
      {
        type: 'missed',
        day: DAY0,
        streakBefore: 0,
        streakAfter: 0,
        missedInRow: 1,
        grace: true,
        slip: null,
        final: null,
        paused: false,
      },
    ]);
    expect(r.state.history.map((e) => e.result)).toEqual(['missed']);
    expect(pendingWindow(r.state, at('2026-10-15', '00:30'))?.day).toBe('2026-10-14');

    const early = answer(r.state, { answer: 'yes', day: '2026-10-01' }, at('2026-10-15', '00:30'), DENVER);
    expect(early).toMatchObject({ ok: false, reason: 'expired' });
  });

  it('returns missed-day events alongside an accepted answer', () => {
    const s = yesDays(newGoal(), DAY0, 5); // through 10-17
    const r = answer(s, { answer: 'yes' }, at('2026-10-21', '21:00'), DENVER); // 10-18, 10-19 missed (free)
    expect(r.ok).toBe(true);
    expect(r.events.map((e) => e.day)).toEqual(['2026-10-18', '2026-10-19']);
    expect(r.ok && r.outcome).toMatchObject({ kind: 'yes', day: '2026-10-20', streak: 6 });
  });
});

describe('travel', () => {
  it('LA → Tokyo with a window open: it stays open, no zero lost, no day skipped', () => {
    const s = newGoal({ tz: LA }); // Oct 13 opens 20:00 PDT = 03:00Z Oct 14
    const landed = iso('2026-10-14T18:00:00Z'); // 03:00 JST Oct 15; Tokyo's Oct 13 window closed at 11:00Z Oct 14
    const { state, events } = resolve(s, landed, TOKYO);
    expect(events).toEqual([]);
    const pending = pendingWindow(state, landed);
    expect(pending?.day).toBe(DAY0);
    expect(pending?.tz).toBe(LA);
    expect(pending?.closesAt.toISOString()).toBe('2026-10-15T07:00:00.000Z'); // midnight ending Oct 14 in LA, where it opened

    const yes = answer(state, { answer: 'yes' }, landed, TOKYO);
    expect(yes).toMatchObject({ ok: true, outcome: { day: DAY0, streak: 1 } });
    const after = yes.ok ? yes.state : state;
    expect(after.history.at(-1)?.tz).toBe(LA);

    // Oct 14 gets a short window; from Oct 15 on, check-in is 20:00 Tokyo time.
    expect(opensAt(after, '2026-10-14').toISOString()).toBe('2026-10-15T03:00:00.000Z');
    expect(opensAt(after, '2026-10-15').toISOString()).toBe(at('2026-10-15', '20:00', TOKYO).toISOString());
    expect(opensAt(after, '2026-10-16').toISOString()).toBe(at('2026-10-16', '20:00', TOKYO).toISOString());

    const later = resolve(after, at('2026-10-20', '21:00', TOKYO), TOKYO).state;
    expectConsecutiveHistory(later);
    expect(later.history.at(-1)?.tz).toBe(TOKYO);
  });

  it('Tokyo → Honolulu with a window open: it stays open, no day repeated', () => {
    const s = newGoal({ tz: TOKYO }); // Oct 13 opens 20:00 JST = 11:00Z Oct 13
    const landed = iso('2026-10-13T20:00:00Z'); // 10:00 HST Oct 13, before Honolulu's 20:00
    const { state, events } = resolve(s, landed, HONOLULU);
    expect(events).toEqual([]);
    expect(pendingWindow(state, landed)?.day).toBe(DAY0);
    // It stays open until 20:00 Honolulu time on Oct 14, later than it would have closed in Tokyo.
    expect(closesAt(state, DAY0).toISOString()).toBe(at('2026-10-14', '20:00', HONOLULU).toISOString());

    const done = answerDay(state, DAY0, 'yes', { tz: HONOLULU, timeDay: DAY0, time: '11:00' }).state;
    const later = resolve(done, at('2026-10-19', '00:30', HONOLULU), HONOLULU).state;
    expectConsecutiveHistory(later);
    expect(later.history.map((e) => e.day)).toEqual(['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']);
  });

  it('a new zone with nothing pending takes effect from the next window', () => {
    const s = answerDay(newGoal({ tz: LA }), DAY0, 'yes', { tz: LA }).state;
    const noon = iso('2026-10-14T16:00:00Z'); // 12:00 EDT
    const { state } = resolve(s, noon, NEW_YORK);
    expect(pendingWindow(state, noon)).toBeNull();
    expect(opensAt(state, '2026-10-14').toISOString()).toBe(at('2026-10-14', '20:00', NEW_YORK).toISOString());
  });

  it('keeps openings strictly increasing across a jump of more than a day (UTC-11 → UTC+14)', () => {
    const s = newGoal({ tz: PAGO_PAGO }); // Oct 13 opens 07:00Z Oct 14
    const now = iso('2026-10-14T08:00:00Z');
    const { state, events } = resolve(s, now, KIRITIMATI);
    expect(events).toEqual([]);
    expect(closesAt(state, DAY0).getTime()).toBeGreaterThanOrEqual(Date.parse('2026-10-15T07:00:00Z'));
    let prev = opensAt(state, DAY0).getTime();
    for (let i = 1; i < 12; i++) {
      const next = opensAt(state, addDays(DAY0, i)).getTime();
      expect(next).toBeGreaterThan(prev);
      prev = next;
    }
    // Midnight comes 25 hours sooner on Kiritimati, so closes need the floor to keep increasing.
    let prevClose = closesAt(state, DAY0).getTime();
    for (let i = 1; i < 12; i++) {
      const next = closesAt(state, addDays(DAY0, i)).getTime();
      expect(next).toBeGreaterThan(prevClose);
      prevClose = next;
    }
    expect(opensAt(state, '2026-10-20').toISOString()).toBe(at('2026-10-20', '20:00', KIRITIMATI).toISOString());
  });

  it('survives random flights and edits: never closes an open window early, never skips a day', () => {
    const zones = [DENVER, LA, NEW_YORK, TOKYO, HONOLULU, PAGO_PAGO, KIRITIMATI, LONDON];
    const times = ['00:15', '06:00', '12:30', '18:00', '20:00', '22:45', '23:59'];
    const pick = <T,>(list: readonly T[], r: number): T => list[Math.floor(r * list.length)] as T;
    const rand = seeded(7);
    let s = newGoal();
    let t = at(DAY0, '12:00').getTime();
    for (let step = 0; step < 400; step++) {
      t += rand() * 30 * HOUR;
      const now = new Date(t);
      const currentTz = latestScheduleEntry(s).tz;
      const before = resolve(s, now, currentTz).state;
      const open = pendingWindow(before, now);
      const roll = rand();
      if (roll < 0.25) {
        s = resolve(before, now, pick(zones, rand())).state; // a flight
      } else if (roll < 0.45) {
        s = setCheckInTime(before, pick(times, rand()), now, currentTz).state;
      } else if (roll < 0.75) {
        s = answer(before, { answer: rand() < 0.8 ? 'yes' : 'not-today' }, now, currentTz).state;
      } else {
        s = before;
      }

      if (open && (s.lastSettledDay ?? '') < open.day) {
        expect(closesAt(s, open.day).getTime()).toBeGreaterThanOrEqual(open.closesAt.getTime());
      }
      const from = s.lastSettledDay ?? s.firstDay;
      for (let i = 0; i < 8; i++) {
        expect(opensAt(s, addDays(from, i + 1)).getTime()).toBeGreaterThan(opensAt(s, addDays(from, i)).getTime());
        expect(closesAt(s, addDays(from, i + 1)).getTime()).toBeGreaterThan(closesAt(s, addDays(from, i)).getTime());
      }
    }
    expect(diffDays(s.lastSettledDay ?? s.firstDay, s.firstDay)).toBeGreaterThan(100);
    expectConsecutiveHistory(s);
  });
});
