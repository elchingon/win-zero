import { describe, expect, it } from '@jest/globals';

import { EMPTY_WALLET, type CreditGrant, type CreditWallet } from '@/engine';
import { DAY0, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import type { RoundRecord } from '@/store/types';

import { hudLabel, replayMode, resultLines, roundOverlay, sheetEyebrow } from '../result';

describe('roundOverlay', () => {
  it('keeps the HUD up until the fill lands', () => {
    for (const mode of ['real', 'replay', 'practice'] as const) {
      expect(roundOverlay(false, mode, false)).toBe('hud');
    }
  });

  it('cheers a real round or a replay, then shows the sheet once dismissed', () => {
    for (const mode of ['real', 'replay'] as const) {
      expect(roundOverlay(true, mode, false)).toBe('cheer');
      expect(roundOverlay(true, mode, true)).toBe('sheet');
    }
  });

  it('goes straight to the sheet after practice or a bonus round, which have no check-in to cheer', () => {
    expect(roundOverlay(true, 'practice', false)).toBe('sheet');
    expect(roundOverlay(true, 'bonus', false)).toBe('sheet');
    expect(roundOverlay(false, 'bonus', false)).toBe('hud');
  });
});

describe('round labels', () => {
  it('replays a real round as a replay, and keeps bonus and practice rounds what they are', () => {
    expect(replayMode('real')).toBe('replay');
    expect(replayMode('replay')).toBe('replay');
    expect(replayMode('bonus')).toBe('bonus');
    expect(replayMode('practice')).toBe('practice');
  });

  it('names the round in the HUD and over the sheet', () => {
    const goal = newGoal();
    expect([hudLabel('real', 30), hudLabel('replay', 30), hudLabel('bonus', 250), hudLabel('practice', 60)]).toEqual([
      'DAY 30',
      'DAY 30',
      'BONUS',
      'PRACTICE',
    ]);
    expect(sheetEyebrow('real', 30, goal)).toBe('Day 30 · Stop drinking');
    expect(sheetEyebrow('replay', 30, null)).toBe('Day 30');
    expect(sheetEyebrow('bonus', 250, goal)).toBe('Bonus round');
    expect(sheetEyebrow('practice', 60, goal)).toBe('Practice');
  });
});

describe('resultLines', () => {
  const goal = yesDays(newGoal(), DAY0, 3); // best 3: the Scatter Gun is next, at 7
  const grant = (kind: CreditGrant['kind'], key: string, amount = 1): CreditGrant => ({ kind, amount, key });
  const record = (credits: CreditGrant[]): RoundRecord => ({
    day: '2026-10-15',
    n: 3,
    rewards: { bomb: false, shield: false, shieldCapped: false, weapons: ['twin'], credits },
    borrowed: [],
    played: false,
  });
  const wallet = (game: number, weapon: number): CreditWallet => ({ balance: { game, weapon }, claimed: [] });
  const texts = (...args: Parameters<typeof resultLines>) => resultLines(...args).map((l) => l.text);

  it('says what credits a Yes earned and why, with the count once per kind', () => {
    const lines = resultLines(3, 'real', record([grant('weapon', 'yes-run-3')]), goal, wallet(0, 1));
    expect(lines).toContainEqual({ text: 'Weapon credit earned for 3 Yeses in a row. You have 1.', news: true });

    // A player catching up earns several at once.
    expect(
      texts(3, 'real', record([grant('game', 'zeros-2'), grant('weapon', 'yes-run-3'), grant('weapon', 'comeback')]), goal, wallet(1, 2)),
    ).toEqual([
      'New weapon unlocked: Twin Barrel. Two bullets side by side.',
      'Game credit earned for reaching 2 zeros. You have 1.',
      'Weapon credit earned for 3 Yeses in a row.',
      'Weapon credit earned for checking in again after a missed day. You have 2.',
      'Hold the line 4 more days for the Scatter Gun.',
    ]);
  });

  it('counts a credit that came in a bundle, and one with no reward behind it', () => {
    expect(texts(3, 'real', record([grant('game', 'pack-abc', 3)]), goal, wallet(3, 0))).toContain('3 Game credits earned. You have 3.');
  });

  it('shows the counts as they stand when the sheet opens', () => {
    // The credit was spent on this very round before it began.
    expect(texts(3, 'real', record([grant('weapon', 'yes-run-3')]), goal, wallet(0, 0))).toContain(
      'Weapon credit earned for 3 Yeses in a row. You have 0.',
    );
  });

  it('says a bonus round changes nothing, with no next unlock', () => {
    expect(texts(250, 'bonus', null, goal, wallet(0, 0))).toEqual(["Bonus round: your streak and rewards don't change."]);
  });

  it("counts down to what's next for the shared arsenal, from this goal's streak (SPEC 9)", () => {
    // Another goal has reached 30: the Chain Zapper is in hand, and the Rail Laser comes at 60.
    expect(texts(3, 'replay', record([]), goal, EMPTY_WALLET, 30)).toEqual([
      "Replay: your streak and rewards don't change.",
      'Hold the line 57 more days for the Rail Laser.',
    ]);
  });

  it("doesn't repeat what a replay already earned", () => {
    expect(texts(3, 'replay', record([grant('weapon', 'yes-run-3')]), goal, EMPTY_WALLET)).toEqual([
      "Replay: your streak and rewards don't change.",
      'Hold the line 4 more days for the Scatter Gun.',
    ]);
  });
});
