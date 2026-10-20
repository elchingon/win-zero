// Turning frame reports into sounds and haptics, with pops and kill buzzes throttled.
import { describe, expect, it } from '@jest/globals';

import { BOUNCE_MIN_MS, KILL_HAPTIC_MIN_MS, makeCues, makeGate, POP_MIN_MS } from '../cues';
import { makeReport, resetReport } from '../sim/report';
import type { Report } from '../sim/types';

function report(patch: Partial<Report>): Report {
  const r = makeReport(10, 1);
  resetReport(r);
  return { ...r, dirty: true, ...patch };
}

describe('makeGate', () => {
  it('opens at most once per interval', () => {
    const gate = makeGate(35);
    expect([gate(0), gate(10), gate(34), gate(35), gate(36), gate(80)]).toEqual([true, false, false, true, false, true]);
  });
});

describe('cues', () => {
  it('fires a shot sound per frame with shots', () => {
    const cues = makeCues();
    expect(cues(report({ shots: 2 }), 0).shoot).toBe(true);
    expect(cues(report({}), 16).shoot).toBe(false);
  });

  it('plays the Shooter’s sounds by default, the same as asked for by name', () => {
    const named = makeCues('shooter');
    const plain = makeCues();
    const reports = [report({ shots: 1 }), report({ kills: 2 }), report({ kills: 1 }), report({ bombs: 1 }), report({ final: true })];
    expect(reports.map((r, i) => named(r, i * 10))).toEqual(reports.map((r, i) => plain(r, i * 10)));
  });

  it(`pops for kills at most every ${POP_MIN_MS} ms, and buzzes at most every ${KILL_HAPTIC_MIN_MS} ms`, () => {
    const cues = makeCues();
    const pops: boolean[] = [];
    const buzzes: boolean[] = [];
    for (let t = 0; t <= 120; t += 16) {
      const c = cues(report({ kills: 1 }), t);
      pops.push(c.pop);
      buzzes.push(c.killHaptic);
    }
    // Frames at 0, 16, 32, 48, 64, 80, 96, 112.
    expect(pops).toEqual([true, false, false, true, false, false, true, false]);
    expect(buzzes).toEqual([true, false, false, false, true, false, false, false]);
  });

  it('pops for a splash too', () => {
    expect(makeCues()(report({ blasts: 1 }), 0).pop).toBe(true);
  });

  it('booms for a bomb, with a medium buzz instead of the kill buzz', () => {
    const c = makeCues()(report({ bombs: 1, kills: 12 }), 0);
    expect(c).toMatchObject({ boom: true, pop: false, bombHaptic: true, killHaptic: false, boomHaptic: false });
  });

  it('booms with the heavy buzz for the last zero', () => {
    const c = makeCues()(report({ kills: 1, final: true }), 0);
    expect(c).toMatchObject({ boom: true, pop: false, boomHaptic: true, killHaptic: false });
  });

  it('booms once for Finish round, with no pops for the zeros it clears', () => {
    const c = makeCues()(report({ kills: 60, final: true }), 0);
    expect(c).toEqual({ shoot: false, pop: false, boom: true, killHaptic: false, bombHaptic: false, boomHaptic: true });
  });

  it('stays quiet for a frame where nothing happened', () => {
    expect(makeCues()(report({}), 0)).toEqual({
      shoot: false,
      pop: false,
      boom: false,
      killHaptic: false,
      bombHaptic: false,
      boomHaptic: false,
    });
  });
});

describe('Catch’s cues', () => {
  it('bounces for a catch that doesn’t pop its zero, at most every ' + BOUNCE_MIN_MS + ' ms', () => {
    const cues = makeCues('catch');
    const bounces = [0, 20, 50, 60].map((t) => cues(report({ bounces: 1 }), t).bounce);
    expect(bounces).toEqual([true, false, true, false]);
  });

  it('pops, without the bounce, for a catch that does', () => {
    const c = makeCues('catch')(report({ bounces: 1, kills: 1 }), 0);
    expect(c).toMatchObject({ pop: true, bounce: false, killHaptic: true });
  });

  it('booms for a bomb and the last zero, as the Shooter does', () => {
    expect(makeCues('catch')(report({ bounces: 1, kills: 1, final: true }), 0)).toMatchObject({ boom: true, bounce: false, pop: false });
    expect(makeCues('catch')(report({ bombs: 1 }), 0)).toMatchObject({ boom: true, bombHaptic: true });
  });

  it('never bounces in the Shooter', () => {
    expect(makeCues('shooter')(report({ bounces: 3 }), 0).bounce).toBeUndefined();
  });
});
