import { describe, expect, it } from '@jest/globals';

import { CELEBRATIONS, celebrationFor, type Celebration, type CelebrationId, type HighlightKind } from '@/engine';
import { newGoal } from '@/engine/__tests__/fixtures';
import type { RoundRecord } from '@/store/types';

import { celebrationCopy, type CelebrationContext } from '../celebrations';

const entry = (id: CelebrationId): Celebration => CELEBRATIONS.find((c) => c.id === id) as Celebration;

function context(patch: Partial<RoundRecord>, goal: Partial<CelebrationContext['goal']>, rest: Partial<CelebrationContext> = {}): CelebrationContext {
  const round: RoundRecord = {
    day: '2026-10-19',
    n: 7,
    rewards: { bomb: false, shield: false, shieldCapped: false, weapons: [], credits: [] },
    borrowed: [],
    played: true,
    ...patch,
  };
  return { round, goal: { ...newGoal(), ...goal }, best: round.n, gameMode: 'shooter', icons: false, ...rest };
}

const day7 = (shields = 1) =>
  context({ rewards: { bomb: false, shield: true, shieldCapped: false, weapons: ['scatter'], credits: [] } }, { shields });

const day30 = (patch: Partial<RoundRecord> = {}, rest: Partial<CelebrationContext> = {}) =>
  context(
    { n: 30, rewards: { bomb: true, shield: false, shieldCapped: false, weapons: ['chain'], credits: [] }, ...patch },
    { bombs: 6 },
    rest,
  );

describe('celebration copy (SPEC 6)', () => {
  it('Day 7: congratulates, features the shield and what it does, and pushes on', () => {
    expect(celebrationCopy(entry('day-7'), day7())).toEqual({
      title: 'Congratulations on Day 7!',
      quote: '“Success is the sum of small efforts, repeated day in and day out.”',
      lines: ['7 zeros down, and every one of them is a promise you kept to yourself. That takes real strength.'],
      highlights: [
        {
          kind: 'shield',
          title: 'You earned a shield',
          lines: [
            'You have 1 of 3.',
            "When a hard stretch reaches 7 slips in a row and would start you over, your shield steps in and your streak stays. It works on its own, so there's nothing to do.",
          ],
        },
      ],
      closing:
        "Keep going. You've shown you can do this, one day at a time, and you're stronger now than when you started. Your next shield comes on Day 14.",
      button: 'Keep going',
    });
  });

  it('Day 7: promises no next shield once this one fills the bank', () => {
    const { closing, highlights } = celebrationCopy(entry('day-7'), day7(3));
    expect(highlights[0]?.lines[0]).toBe('You have 3 of 3.');
    expect(closing).not.toMatch(/next shield/);
  });

  it('Day 30: features the weapon and the bomb, and names the next weapon', () => {
    expect(celebrationCopy(entry('day-30'), day30())).toEqual({
      title: 'Congratulations on Day 30!',
      quote: "You didn't just do it once. You completed your goal for 30 days. That's not just a streak, that's a personality trait now.",
      lines: ["30 zeros down. This is more than a good run now. It's who you're becoming, one check-in at a time."],
      highlights: [
        { kind: 'weapon', title: 'New weapon: Chain Zapper', lines: ['Lightning jumps to 4 more zeros.'] },
        { kind: 'bomb', title: 'Bomb earned. You have 6.', lines: [] },
      ],
      closing:
        "Keep going. Hard days may still come, and you've already shown you can get through them. Your next weapon, the Rail Laser, comes on Day 60.",
      button: 'Keep going',
    });
  });

  it("Day 30 in Win Zero Plus: the theme and its icon, and the game's own power-up names", () => {
    const tip = celebrationCopy(entry('day-30'), day30({ unlocks: ['ember'] }, { gameMode: 'catch', icons: true }));
    const kinds = tip.highlights.map((h): HighlightKind => h.kind);
    expect(kinds).toEqual(['weapon', 'theme', 'bomb']);
    expect(tip.highlights[1]).toEqual({
      kind: 'theme',
      title: 'New theme: Ember',
      lines: ['Pick it in Settings › Themes. Its app icon is unlocked too.'],
    });
    expect(tip.highlights[0]?.title).not.toMatch(/Chain Zapper/);
    expect(tip.closing).not.toMatch(/Rail Laser/);
  });

  it('announces only what the round earned', () => {
    const tip = celebrationCopy(
      entry('day-30'),
      day30({ rewards: { bomb: true, shield: false, shieldCapped: false, weapons: [], credits: [] } }, { best: 200 }),
    );
    expect(tip.highlights.map((h) => h.kind)).toEqual(['bomb']);
    expect(tip.closing).not.toMatch(/next/); // every weapon is already unlocked
  });

  it.each(CELEBRATIONS.map((c) => [c.id, c] as const))('%s has words, and says its own day', (_id, c) => {
    const rewards = { bomb: true, shield: true, shieldCapped: false, weapons: [], credits: [] };
    expect(celebrationFor({ n: c.day, rewards })).toBe(c);
    const tip = celebrationCopy(c, context({ n: c.day, rewards }, { shields: 1, bombs: 1 }));
    expect(tip.title).toContain(`Day ${c.day}`);
    expect(tip.quote).not.toBe('');
    expect(tip.lines.length).toBeGreaterThan(0);
    expect(tip.highlights.length).toBeGreaterThan(0);
    expect(tip.closing).toMatch(/^Keep going\./);
  });

  it('never shames, and never counts calendar time a chosen-days goal would not match', () => {
    for (const tip of [celebrationCopy(entry('day-7'), day7()), celebrationCopy(entry('day-30'), day30())]) {
      const text = [tip.title, tip.quote, ...tip.lines, ...tip.highlights.flatMap((h) => h.lines), tip.closing].join(' ');
      expect(text).not.toMatch(/\b(week|month|every day|failed|failure)\b/i);
    }
  });
});
