import { describe, expect, it } from '@jest/globals';

import { addDays } from '../dates';
import { resolve } from '../resolve';
import { BOMB_EVERY, milestoneRewards, SHIELD_CAP, SHIELD_EVERY, spendBomb } from '../rewards';
import {
  BOMB_DAMAGE,
  BOMB_RADIUS_FRACTION,
  defaultWeapon,
  FIRE_RATE_HZ,
  isUnlocked,
  newlyUnlocked,
  nextUnlock,
  unlockedWeapons,
  WEAPONS,
  weaponById,
} from '../weapons';
import { at, answerDay, DAY0, DENVER, newGoal, notTodays, stateWith, yesDays } from './fixtures';

describe('bombs (SPEC 5)', () => {
  it('earns one at every multiple of 5', () => {
    expect(BOMB_EVERY).toBe(5);
    const s = yesDays(newGoal(), DAY0, 10);
    expect(s.bombs).toBe(2);
    expect(answerDay(yesDays(newGoal(), DAY0, 4), '2026-10-17', 'yes').outcome).toMatchObject({
      rewards: { bomb: true },
    });
  });

  it('keeps banked bombs through a reset and re-earns them on the next run', () => {
    let s = { ...yesDays(newGoal(), DAY0, 10), shields: 0 }; // through 10-22
    s = notTodays(s, '2026-10-23', 7); // six slips, then the final reset
    expect(s.streak).toBe(0);
    expect(s.bombs).toBe(2);
    s = yesDays(s, '2026-10-30', 5);
    expect(s.bombs).toBe(3);
  });

  it('is never taken by a slip', () => {
    let s = yesDays(newGoal(), DAY0, 10);
    s = answerDay(s, '2026-10-23', 'not-today').state;
    expect(s.streak).toBe(9);
    expect(s.bombs).toBe(2);
  });

  it('is spent when used, and cannot be spent at 0', () => {
    expect(spendBomb(stateWith({ bombs: 2 })).bombs).toBe(1);
    expect(() => spendBomb(stateWith({ bombs: 0 }))).toThrow(RangeError);
  });
});

describe('shields (SPEC 5)', () => {
  it('earns one at every multiple of 7, capped at 3', () => {
    expect(SHIELD_EVERY).toBe(7);
    expect(SHIELD_CAP).toBe(3);
    let s = yesDays(newGoal(), DAY0, 21);
    expect(s.shields).toBe(3);
    s = yesDays(s, addDays(DAY0, 21), 6);
    const r = answerDay(s, addDays(DAY0, 27), 'yes'); // day 28
    expect(r.state.streak).toBe(28);
    expect(r.state.shields).toBe(3);
    expect(r.outcome).toMatchObject({ rewards: { shield: false, shieldCapped: true } });
  });

  it('is spent by the final slip only, then refills on new ground', () => {
    let s = yesDays(newGoal(), DAY0, 21); // 3 shields, through 11-02
    s = notTodays(s, '2026-11-03', 6); // 21 → 15
    expect(s).toMatchObject({ streak: 15, shields: 3 });
    s = notTodays(s, '2026-11-09', 1); // the final: shielded
    expect(s).toMatchObject({ streak: 15, shields: 2, slide: 0 });
    s = yesDays(s, '2026-11-10', 13); // 15 → 28, past the run's peak of 21
    expect(s.shields).toBe(3);
  });

  it('a missed-day final spends one too', () => {
    const s = resolve(yesDays(newGoal(), DAY0, 14), at('2026-11-11', '00:00'), DENVER).state; // answered through 10-26
    // 10-27 .. 11-02 free, 11-03 .. 11-08 slip to 8, 11-09 is the final.
    expect(s).toMatchObject({ streak: 8, shields: 1, paused: false });
  });
});

describe('milestones can only be earned once per run', () => {
  it('climbing back to 10 after a slip does not pay the bomb again', () => {
    let s = yesDays(newGoal(), DAY0, 10); // bombs 2, runPeak 10, last 10-22
    s = answerDay(s, '2026-10-23', 'not-today').state; // → 9
    expect(s.streak).toBe(9);
    const r = answerDay(s, '2026-10-24', 'yes'); // back to 10
    expect(r.state.streak).toBe(10);
    expect(r.state.bombs).toBe(2);
    expect(r.outcome).toMatchObject({ rewards: { bomb: false, shield: false } });
    expect(yesDays(r.state, '2026-10-25', 5).bombs).toBe(3); // 15 is new ground
  });

  it('a shielded final keeps the run going without re-earning anything', () => {
    let s = yesDays(newGoal(), DAY0, 7); // shield at 7, through 10-19
    s = notTodays(s, addDays(DAY0, 7), 7); // 7 → 1, then the final is shielded
    expect(s).toMatchObject({ streak: 1, shields: 0, runPeak: 7 });
    s = yesDays(s, addDays(DAY0, 14), 13); // 2 .. 14
    expect(s.streak).toBe(14);
    expect(s.shields).toBe(1); // 7 was already reached this run; 14 is new
    expect(s.bombs).toBe(2); // 5 (first climb) and 10
  });

  it('a run restarts once the streak reaches 0, so rewards are earned again', () => {
    let s = yesDays(newGoal(), DAY0, 3); // last 10-15
    s = notTodays(s, '2026-10-16', 3); // 3 slips → 0
    expect(s.streak).toBe(0);
    expect(s.runPeak).toBe(0);
    s = yesDays(s, '2026-10-19', 5);
    expect(s.bombs).toBe(1);
  });

  it('pays out only above the previous peak', () => {
    expect(milestoneRewards(10, 10, 0)).toEqual({ bomb: false, shield: false, shieldCapped: false });
    expect(milestoneRewards(9, 10, 0)).toEqual({ bomb: true, shield: false, shieldCapped: false });
    expect(milestoneRewards(13, 14, 3)).toEqual({ bomb: false, shield: false, shieldCapped: true });
    expect(milestoneRewards(0, 35, 0)).toEqual({ bomb: true, shield: true, shieldCapped: false });
  });
});

describe('weapons (SPEC 5)', () => {
  it('matches the SPEC damage table', () => {
    const table = WEAPONS.map((w) => [w.unlockAt, w.name, w.projectiles, w.damage, w.splash?.damage, w.chain]);
    expect(table).toEqual([
      [1, 'Pea Shooter', 1, 1, undefined, undefined],
      [3, 'Twin Barrel', 2, 1, undefined, undefined],
      [7, 'Scatter Gun', 5, 1, undefined, undefined],
      [14, 'Rocket', 1, 3, 2, undefined],
      [30, 'Chain Zapper', 1, 2, undefined, { damage: 1, targets: 4 }],
      [60, 'Rail Laser', 1, 2, undefined, undefined],
      [100, 'Zero Nuke', 1, 6, 3, { damage: 3, targets: 6 }],
    ]);
    expect(weaponById('laser').pattern).toBe('beam');
    expect(FIRE_RATE_HZ).toBe(6);
    expect(BOMB_DAMAGE).toBe(8);
    expect(BOMB_RADIUS_FRACTION).toBe(0.42);
  });

  it('unlocks by bestStreak, with the Pea Shooter always available', () => {
    expect(unlockedWeapons(0).map((w) => w.id)).toEqual(['pea']);
    expect(unlockedWeapons(13).map((w) => w.id)).toEqual(['pea', 'twin', 'scatter']);
    expect(unlockedWeapons(100).length).toBe(7);
    expect(defaultWeapon(0).id).toBe('pea');
    expect(defaultWeapon(59).id).toBe('chain');
  });

  it('stays unlocked after a reset', () => {
    const s = notTodays({ ...yesDays(newGoal(), DAY0, 30), shields: 0 }, addDays(DAY0, 30), 7);
    expect(s.streak).toBe(0);
    expect(s.bestStreak).toBe(30);
    expect(isUnlocked('chain', s.bestStreak)).toBe(true);
    expect(defaultWeapon(s.bestStreak).id).toBe('chain');
  });

  it('reports newly unlocked weapons on the Yes that crosses a threshold', () => {
    let s = yesDays(newGoal(), DAY0, 2);
    const third = answerDay(s, addDays(DAY0, 2), 'yes');
    expect(third.outcome).toMatchObject({ rewards: { weapons: [{ id: 'twin' }] } });
    s = third.state;
    expect(answerDay(s, addDays(DAY0, 3), 'yes').outcome).toMatchObject({ rewards: { weapons: [] } });

    const first = answerDay(newGoal(), DAY0, 'yes');
    expect(first.outcome).toMatchObject({ rewards: { weapons: [] } }); // the Pea Shooter isn't news
    expect(newlyUnlocked(13, 30).map((w) => w.id)).toEqual(['rocket', 'chain']);
    expect(newlyUnlocked(30, 30)).toEqual([]);
  });

  it('a reset run does not re-announce weapons already unlocked', () => {
    let s = yesDays(newGoal(), DAY0, 3);
    s = notTodays(s, addDays(DAY0, 3), 3); // back to 0
    s = yesDays(s, addDays(DAY0, 6), 2);
    expect(answerDay(s, addDays(DAY0, 8), 'yes').outcome).toMatchObject({ rewards: { weapons: [] } });
  });

  it('counts days to the next unlock from the current streak', () => {
    expect(nextUnlock(20, 5)).toMatchObject({ weapon: { id: 'chain' }, daysToGo: 25, progress: 0 });
    expect(nextUnlock(20, 20)).toMatchObject({ daysToGo: 10 });
    expect(nextUnlock(20, 20)?.progress).toBeCloseTo(6 / 16);
    expect(nextUnlock(0, 0)).toMatchObject({ weapon: { id: 'twin' }, daysToGo: 3, progress: 0 });
    expect(nextUnlock(1, 1)).toMatchObject({ weapon: { id: 'twin' }, daysToGo: 2, progress: 0 });
    expect(nextUnlock(100, 100)).toBeNull();
  });
});
