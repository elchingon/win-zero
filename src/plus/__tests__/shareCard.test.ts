// Win Zero Plus's share card (SPEC 9): its words say what the share text says, never the goal's
// wording, and its layout fits every line in the panel, however long a power-up's name.
import { describe, expect, it } from '@jest/globals';

import { MODE_IDS, WEAPONS, type ModeId } from '@/engine';

import { CARD, CARD_PAD, cardLayout, wrap, type Measure } from '../share/layout';
import { cardWords } from '../share/words';

const none = { bomb: false, shield: false, shieldCapped: false, weapons: [], credits: [] };
/** A stand-in for the fonts: each character this share of the size wide (Bungee runs wide). */
const measure: Measure = (text, font, size) => text.length * size * (font === 'display' ? 0.8 : 0.55);
const width = CARD.width - 2 * CARD_PAD;

describe('the card’s words', () => {
  it('says the day, the zeros, what the round did and the app', () => {
    expect(cardWords(30, { ...none, weapons: ['chain'], bomb: true }, 'shooter', 'Win Zero Plus')).toEqual({
      day: 'DAY 30',
      zeros: '30 zeros down',
      did: 'Beat the boss, unlocked the Chain Zapper and earned a bomb.',
      footer: 'WIN ZERO PLUS · winzero.app',
    });
    expect(cardWords(1, { ...none, weapons: ['pea'] }, 'catch', 'Win Zero Plus')).toMatchObject({
      zeros: '1 zero down',
      did: 'Unlocked a new catcher, Cup.',
    });
    expect(cardWords(3, { ...none, weapons: ['twin'], bomb: true }, 'breaker', 'Win Zero Plus').did).toBe(
      'Unlocked a new power-up, 2 balls, and earned a bomb.',
    );
    expect(cardWords(1400, { ...none, shield: true }, 'shooter', 'Win Zero Plus')).toMatchObject({ day: 'DAY 1,400', did: 'Earned a shield.' });
  });

  it('never has the goal’s wording, which it never sees', () => {
    const words = cardWords(7, { ...none, shield: true }, 'slice', 'Win Zero Plus');
    expect(Object.values(words).join(' ')).not.toMatch(/drink|goal/i);
  });
});

describe('the card’s layout', () => {
  it('wraps between words, and cuts the last line short with an ellipsis', () => {
    const w = (t: string) => t.length;
    expect(wrap('one two three four', 9, w, 3)).toEqual(['one two', 'three', 'four']);
    expect(wrap('one two three four five six', 9, w, 2)).toEqual(['one two', 'three…']);
    expect(wrap('short', 9, w, 1)).toEqual(['short']);
  });

  it.each(MODE_IDS)('fits every line in the panel, with every %s power-up named at once', (mode: ModeId) => {
    const words = cardWords(100, { ...none, weapons: WEAPONS.map((w) => w.id), bomb: true, shield: true }, mode, 'Win Zero Plus');
    const lines = cardLayout(words, measure);
    for (const line of lines) {
      expect(measure(line.text, line.font, line.size)).toBeLessThanOrEqual(width + 1e-6);
      expect(line.x).toBe(CARD_PAD);
      expect(line.y).toBeGreaterThan(CARD.fill);
      expect(line.y).toBeLessThanOrEqual(CARD.height);
    }
    // In order down the panel, none on top of another.
    const ys = lines.map((l) => l.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    expect(new Set(ys).size).toBe(ys.length);
  });

  it('shrinks a day too long to fit, and leaves out the line when the round did nothing to say', () => {
    const lines = cardLayout({ day: 'DAY 100,000,000', zeros: '100,000,000 zeros down', did: null, footer: 'WIN ZERO PLUS · winzero.app' }, measure);
    expect(lines).toHaveLength(3);
    expect(lines[0]?.size).toBeLessThan(34);
    expect(measure(lines[0]?.text ?? '', 'display', lines[0]?.size ?? 0)).toBeLessThanOrEqual(width + 1e-6);
  });
});
