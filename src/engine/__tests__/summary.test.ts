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
    const s = resolve(yesDays(newGoal(), DAY0, 10), at('2026-10-30', '20:30'), DENVER).state; // 10-23 .. 10-29
    expect(missDigest(s, null)).toEqual({ days: 7, lost: 0, final: null, streakBefore: 10, streak: 10 });
  });

  it('counts only days after the seen marker', () => {
    const s = resolve(yesDays(newGoal(), DAY0, 10), at('2026-11-01', '20:30'), DENVER).state; // 10-23 .. 10-31
    expect(missDigest(s, null)).toMatchObject({ days: 9, lost: 2, streak: 8 });
    expect(missDigest(s, '2026-10-29')).toEqual({ days: 2, lost: 2, final: null, streakBefore: 10, streak: 8 });
    expect(missDigest(s, '2026-10-31')).toBeNull();
  });

  it('reports a missed-day reset', () => {
    const s = resolve({ ...yesDays(newGoal(), DAY0, 20), shields: 0 }, at('2026-11-16', '20:00'), DENVER).state;
    expect(missDigest(s, null)).toEqual({ days: 14, lost: 20, final: 'reset', streakBefore: 20, streak: 0 });
  });

  it('reports a shield spent on a missed day', () => {
    const s = resolve(yesDays(newGoal(), DAY0, 20), at('2026-11-16', '20:00'), DENVER).state;
    expect(missDigest(s, null)).toEqual({ days: 14, lost: 6, final: 'shielded', streakBefore: 20, streak: 14 });
  });

  it('ignores a final with no streak at stake, and paused days', () => {
    const fresh = resolve(newGoal(), at('2026-10-27', '20:00'), DENVER).state; // 14 misses at streak 0
    expect(fresh.paused).toBe(true);
    expect(missDigest(fresh, null)).toEqual({ days: 14, lost: 0, final: null, streakBefore: 0, streak: 0 });

    const reset = resolve({ ...yesDays(newGoal(), DAY0, 20), shields: 0 }, at('2026-11-20', '21:00'), DENVER).state;
    expect(missDigest(reset, '2026-11-15')).toEqual({ days: 4, lost: 0, final: null, streakBefore: 0, streak: 0 });
  });
});

describe('calendarMark', () => {
  it('marks each kind of day, with misses after a reset muted as paused', () => {
    let s = { ...yesDays(newGoal(), DAY0, 8), shields: 1 }; // through 10-20
    s = answerDay({ ...s, slide: 6 }, '2026-10-21', 'not-today').state; // final, shielded
    s = answerDay(s, '2026-10-22', 'not-today').state; // slip
    // Seven free misses, then slips 2–7 (the Not today above was slip 1): reset on 11-04.
    s = resolve({ ...s, shields: 0 }, at('2026-11-12', '21:00'), DENVER).state;
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
