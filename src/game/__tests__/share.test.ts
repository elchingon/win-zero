// Sharing a milestone: the text says what the round earned, never the goal, and only a round
// that earned something has any.
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Share } from 'react-native';

import { milestoneShareText, shareMilestone } from '../share';

const none = { bomb: false, shield: false, shieldCapped: false, weapons: [], credits: [] };

afterEach(() => {
  jest.restoreAllMocks();
});

describe('milestoneShareText', () => {
  it('says what the round earned', () => {
    expect(milestoneShareText(1, { ...none, weapons: ['pea'] })).toBe(
      'Day 1 on Win Zero: 1 zero down. I unlocked the Pea Shooter.',
    );
    expect(milestoneShareText(5, { ...none, bomb: true })).toBe('Day 5 on Win Zero: 5 zeros down. I earned a bomb.');
    expect(milestoneShareText(35, { ...none, bomb: true, shield: true })).toBe(
      'Day 35 on Win Zero: 35 zeros down. I earned a bomb and a shield.',
    );
    expect(milestoneShareText(1400, { ...none, weapons: ['scatter'], bomb: true, shield: true })).toBe(
      'Day 1,400 on Win Zero: 1,400 zeros down. I unlocked the Scatter Gun and earned a bomb and a shield.',
    );
  });

  it('names the app it was shared from', () => {
    expect(milestoneShareText(5, { ...none, bomb: true }, 'Win Zero Plus')).toBe(
      'Day 5 on Win Zero Plus: 5 zeros down. I earned a bomb.',
    );
  });

  it('names the power-ups as the game played does (SPEC 9)', () => {
    const twin = { ...none, weapons: ['twin' as const] };
    expect(milestoneShareText(3, twin, 'Win Zero Plus', 'shooter')).toBe('Day 3 on Win Zero Plus: 3 zeros down. I unlocked the Twin Barrel.');
    expect(milestoneShareText(3, twin, 'Win Zero Plus', 'orbit')).toBe('Day 3 on Win Zero Plus: 3 zeros down. I unlocked the Twin Barrel.');
    expect(milestoneShareText(3, twin, 'Win Zero Plus', 'catch')).toBe(
      'Day 3 on Win Zero Plus: 3 zeros down. I unlocked a new catcher, Twin Cups.',
    );
    expect(milestoneShareText(3, { ...twin, bomb: true }, 'Win Zero Plus', 'breaker')).toBe(
      'Day 3 on Win Zero Plus: 3 zeros down. I unlocked a new power-up, 2 balls, and earned a bomb.',
    );
    expect(milestoneShareText(3, { ...none, weapons: ['twin', 'scatter'] }, 'Win Zero Plus', 'slice')).toBe(
      'Day 3 on Win Zero Plus: 3 zeros down. I unlocked new power-ups, Twin Blade and Wide Arc.',
    );
  });

  it('has nothing to share for a round that earned nothing', () => {
    expect(milestoneShareText(4, none)).toBeNull();
    expect(milestoneShareText(21, { ...none, shieldCapped: true })).toBeNull(); // shields already full
    // Credits are banked, not shared.
    expect(milestoneShareText(3, { ...none, credits: [{ kind: 'weapon', amount: 1, key: 'yes-run-3' }] })).toBeNull();
  });
});

describe('shareMilestone', () => {
  it('opens the share sheet with the text, and shrugs off a dismissal or failure', async () => {
    const share = jest.spyOn(Share, 'share').mockRejectedValue(new Error('no share sheet'));
    shareMilestone('Day 7 on Win Zero: 7 zeros down. I earned a shield.');
    await new Promise((r) => setTimeout(r, 0));
    expect(share).toHaveBeenCalledWith({ message: 'Day 7 on Win Zero: 7 zeros down. I earned a shield.' });
  });
});
