// Summaries the screens read: missed-day digest, calendar marks, the Not-today preview, arsenal rows.
import { describe, expect, it } from '@jest/globals';

import { resolve } from '../resolve';
import { calendarMark, missDigest, notTodayPreview } from '../summary';
import { arsenal, equippedWeapon } from '../weapons';
import { at, answerDay, DAY0, DENVER, newGoal, notTodays, stateWith, yesDays } from './fixtures';

describe('missDigest', () => {
  it('is null with nothing missed', () => {
    expect(missDigest(newGoal(), null)).toBeNull();
    const s = notTodays(yesDays(newGoal(), DAY0, 5), '2026-10-18', 1); // answered days only
    expect(missDigest(s, null)).toBeNull();
  });

  it('reports free misses with nothing lost', () => {
    const s = resolve(yesDays(newGoal(), DAY0, 10), at('2026-10-31', '00:30'), DENVER).state; // 10-23 .. 10-29
    expect(missDigest(s, null)).toEqual({ days: 7, lost: 0, final: null, streakBefore: 10, streak: 10, stopped: false });
  });

  it('counts only days after the seen marker', () => {
    const s = resolve(yesDays(newGoal(), DAY0, 10), at('2026-11-02', '00:30'), DENVER).state; // 10-23 .. 10-31
    expect(missDigest(s, null)).toMatchObject({ days: 9, lost: 2, streak: 8 });
    expect(missDigest(s, '2026-10-29')).toEqual({ days: 2, lost: 2, final: null, streakBefore: 10, streak: 8, stopped: false });
    expect(missDigest(s, '2026-10-31')).toBeNull();
  });

  it('reports a missed-day reset', () => {
    const s = resolve({ ...yesDays(newGoal(), DAY0, 20), shields: 0 }, at('2026-11-17', '00:00'), DENVER).state;
    expect(missDigest(s, null)).toEqual({ days: 14, lost: 20, final: 'reset', streakBefore: 20, streak: 0, stopped: false });
  });

  it('reports a shield spent on a missed day', () => {
    const s = resolve(yesDays(newGoal(), DAY0, 20), at('2026-11-17', '00:00'), DENVER).state;
    expect(missDigest(s, null)).toEqual({ days: 14, lost: 6, final: 'shielded', streakBefore: 20, streak: 14, stopped: false });
  });

  it('ignores a final with no streak at stake, and paused days', () => {
    const fresh = resolve(newGoal(), at('2026-10-28', '00:00'), DENVER).state; // 14 misses at streak 0
    expect(fresh.paused).toBe(true);
    expect(missDigest(fresh, null)).toEqual({ days: 14, lost: 0, final: null, streakBefore: 0, streak: 0, stopped: false });

    const reset = resolve({ ...yesDays(newGoal(), DAY0, 20), shields: 0 }, at('2026-11-21', '00:30'), DENVER).state;
    expect(missDigest(reset, '2026-11-15')).toEqual({ days: 4, lost: 0, final: null, streakBefore: 0, streak: 0, stopped: false });
  });
});

describe('missDigest: a Yes after missed days', () => {
  const CHATHAM = 'Pacific/Chatham';
  /** Just after midnight ending 11-01: 10-31 has closed and 11-01 is still open. */
  const AFTER_MIDNIGHT_11_02 = { timeDay: '2026-11-02', time: '00:30' };

  it('stops the slide after weeks away, across the US fall-back change', () => {
    const away = resolve(yesDays(newGoal(), DAY0, 10), at('2026-11-02', '00:30'), DENVER).state; // 10-23 .. 10-31
    const back = answerDay(away, '2026-11-01', 'yes', AFTER_MIDNIGHT_11_02).state; // the clocks went back the morning before
    expect(missDigest(back, null)).toEqual({ days: 9, lost: 2, final: null, streakBefore: 10, streak: 9, stopped: true });
  });

  it('starts a new run after a missed-day reset', () => {
    const away = resolve({ ...yesDays(newGoal(), DAY0, 20), shields: 0 }, at('2026-11-17', '00:00'), DENVER).state;
    const back = answerDay(away, '2026-11-16', 'yes', { timeDay: '2026-11-17', time: '00:00' }).state;
    expect(missDigest(back, null)).toEqual({ days: 14, lost: 20, final: 'reset', streakBefore: 20, streak: 1, stopped: true });
  });

  it('only a Yes stops it, and later misses start it again', () => {
    const away = resolve(yesDays(newGoal(), DAY0, 10), at('2026-11-02', '00:30'), DENVER).state;
    expect(missDigest(answerDay(away, '2026-11-01', 'not-today', AFTER_MIDNIGHT_11_02).state, null)?.stopped).toBe(false);

    const back = answerDay(away, '2026-11-01', 'yes', AFTER_MIDNIGHT_11_02).state;
    const again = resolve(back, at('2026-11-13', '00:30'), DENVER).state; // 11-02 .. 11-11: 7 free, 3 slips
    expect(missDigest(again, null)).toMatchObject({ days: 19, lost: 5, stopped: false });
    expect(missDigest(again, '2026-11-01')).toMatchObject({ days: 10, lost: 3, streakBefore: 9, stopped: false });
  });

  it('works the same across a southern-hemisphere DST start (Chatham, Sep 27)', () => {
    const goal = yesDays(newGoal({ day: '2026-09-10', tz: CHATHAM }), '2026-09-10', 10, CHATHAM); // through 09-19
    const away = resolve(goal, at('2026-09-30', '00:30', CHATHAM), CHATHAM).state; // 09-20 .. 09-28
    expect(missDigest(away, null)).toMatchObject({ days: 9, lost: 2, streak: 8, stopped: false });
    const back = answerDay(away, '2026-09-29', 'yes', { tz: CHATHAM, timeDay: '2026-09-30', time: '00:30' }).state;
    expect(missDigest(back, null)).toMatchObject({ days: 9, lost: 2, streak: 9, stopped: true });
  });
});

describe('calendarMark', () => {
  it('marks each kind of day, with misses after a reset muted as paused', () => {
    let s = { ...yesDays(newGoal(), DAY0, 8), shields: 1 }; // through 10-20
    s = answerDay({ ...s, slide: 6 }, '2026-10-21', 'not-today').state; // final, shielded
    s = answerDay(s, '2026-10-22', 'not-today').state; // slip
    // Seven free misses, then slips 2–7 (the Not today above was slip 1): reset on 11-04.
    s = resolve({ ...s, shields: 0 }, at('2026-11-13', '00:30'), DENVER).state;
    const marks = Object.fromEntries(s.history.map((e) => [e.day, calendarMark(e)]));
    expect(marks['2026-10-20']).toBe('yes');
    expect(marks['2026-10-21']).toBe('shielded');
    expect(marks['2026-10-22']).toBe('no');
    expect(marks['2026-10-23']).toBe('missed');
    expect(marks['2026-11-04']).toBe('missed'); // the reset itself
    expect(marks['2026-11-05']).toBe('paused');
    expect(marks['2026-11-11']).toBe('paused');
  });
});

describe('notTodayPreview', () => {
  it('previews a slip, the final, and a shield', () => {
    expect(notTodayPreview(stateWith({ streak: 5 }))).toEqual({ kind: 'slip', lose: 1 });
    expect(notTodayPreview(stateWith({ streak: 0 }))).toEqual({ kind: 'slip', lose: 0 });
    expect(notTodayPreview(stateWith({ streak: 5, slide: 6 }))).toEqual({ kind: 'reset', lose: 5 });
    expect(notTodayPreview(stateWith({ streak: 5, slide: 6, shields: 1 }))).toEqual({ kind: 'shield' });
    expect(notTodayPreview(stateWith({ streak: 0, slide: 6, shields: 1 }))).toEqual({ kind: 'reset', lose: 0 });
  });
});

describe('arsenal and the equipped weapon', () => {
  it('lists every weapon with its unlock state and days to go from the current streak', () => {
    const rows = arsenal(20, 5);
    expect(rows.map((r) => [r.weapon.id, r.unlocked, r.daysToGo])).toEqual([
      ['pea', true, 0],
      ['twin', true, 0],
      ['scatter', true, 0],
      ['rocket', true, 0],
      ['chain', false, 25],
      ['laser', false, 55],
      ['nuke', false, 95],
    ]);
    expect(arsenal(0, 0).slice(0, 2).map((r) => [r.weapon.id, r.unlocked, r.daysToGo])).toEqual([
      ['pea', true, 0],
      ['twin', false, 3],
    ]);
  });

  it("keeps the player's pick while it's unlocked, else the highest", () => {
    expect(equippedWeapon(null, 20).id).toBe('rocket');
    expect(equippedWeapon('pea', 20).id).toBe('pea');
    expect(equippedWeapon('laser', 20).id).toBe('rocket');
    expect(equippedWeapon(null, 0).id).toBe('pea');
  });
});
