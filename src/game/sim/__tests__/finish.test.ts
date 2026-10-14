// Finish round: every zero left goes at once, the finale fires once from the middle, and the
// round reports its end the usual way.
import { describe, expect, it } from '@jest/globals';

import { composeRound } from '@/engine';

import { AMBER, CONFETTI, FLARE, TEAL } from '../constants';
import { killZero } from '../damage';
import { finishAll } from '../finish';
import { resetReport } from '../report';
import type { GameState } from '../types';
import { alive, finalRings, game, run } from './fixtures';

const confetti = (s: GameState) => s.particles.items.slice(0, s.particles.count).filter((p) => p.shape === 'confetti').length;

const objects = (n: number) => composeRound(n).groups.reduce((sum, g) => sum + g.count, 0);

describe('finishAll', () => {
  it('clears the board before any zero has popped in, and ends the round once', () => {
    const s = game(30);
    expect(finishAll(s)).toBe(true);
    expect(alive(s)).toHaveLength(0);
    expect(s.valueLeft).toBe(0);
    expect(s.phase).toBe('celebrate');
    expect(s.report).toMatchObject({ final: true, kills: 30, valueLeft: 0, dirty: true });

    resetReport(s.report);
    let shown = 0;
    for (let i = 0; i < 5 * 60; i++) {
      run(s, 1 / 60);
      expect(s.report.final).toBe(false);
      if (s.report.showResult) shown++;
      resetReport(s.report);
    }
    expect(shown).toBe(1);
  });

  it.each([1, 7, 8, 46, 60, 61, 250, 997, 1000, 100_000])('n = %i: every object goes, worth n zeros', (n) => {
    const s = game(n);
    run(s, 0.3); // some still popping in
    expect(finishAll(s)).toBe(true);
    expect(s.phase).toBe('celebrate');
    expect(s.valueLeft).toBe(0);
    expect(s.report.kills).toBe(objects(n));
  });

  it('counts only the zeros still standing', () => {
    const s = game(20);
    for (const z of s.zeros.slice(0, 8)) killZero(s, z);
    resetReport(s.report);
    finishAll(s);
    expect(s.report.kills).toBe(12);
    expect(s.valueLeft).toBe(0);
  });

  it('does nothing unless the round is being played', () => {
    const s = game(10);
    finishAll(s);
    resetReport(s.report);
    const rings = s.rings.count;
    expect(finishAll(s)).toBe(false);
    expect(s.report.dirty).toBe(false);
    expect(s.rings.count).toBe(rings);
  });

  it('sets off one explosion and the full finale, from the zero nearest the middle', () => {
    const s = game(60);
    const cx = s.width / 2;
    const cy = (s.top + s.bottom) / 2;
    const middle = s.zeros[17]!;
    Object.assign(middle, { x: cx + 1, y: cy - 1 });
    finishAll(s);
    expect(s.rings.count).toBe(1 + 3); // its own shockwave, then the finale's three
    expect(finalRings(s, middle.x, middle.y)).toEqual([AMBER, FLARE, TEAL]);
    expect(confetti(s)).toBe(CONFETTI);
  });

  it('throws half the confetti under reduce motion', () => {
    const s = game(60, { reduceMotion: true });
    finishAll(s);
    expect(confetti(s)).toBe(CONFETTI / 2);
  });
});
