// Orbit (SPEC 9): the turret sits in the middle and aims all round, the zeros circle it on tracks
// of their own, and an armored zero splits into smaller zeros that keep its value, never on
// Finish round. Late in the round, bullets home in.
import { describe, expect, it } from '@jest/globals';

import { composeRound } from '@/engine';

import { pieceBadges, pieceValue } from '../../badges';
import { dropBomb } from '../../bomb';
import { ORBIT_PIECES } from '../../constants';
import { damageZero } from '../../damage';
import { finishAll } from '../../finish';
import { pointerDown } from '../../input';
import { step } from '../../step';
import type { GameState, OrbitState, Zero } from '../../types';
import { bulletAt, modeGame, popIn, run } from '../../__tests__/fixtures';
import { orbitSpares } from '../orbit';
import { ORBIT_SPLIT_GRACE, ORBIT_TURRET_CLEAR } from '../split';

const DT = 1 / 60;

function os(s: GameState): OrbitState {
  if (s.modeState.mode !== 'orbit') throw new Error('not an Orbit round');
  return s.modeState;
}

const alive = (s: GameState) => s.zeros.filter((z) => z.alive);
const worth = (s: GameState) => alive(s).reduce((sum, z) => sum + z.value, 0);
const firstArmored = (s: GameState): Zero => s.zeros.find((z) => z.kind === 'armored' && z.alive)!;

describe('an Orbit round', () => {
  it('puts the turret in the middle of the board, and every zero clear of it', () => {
    for (const n of [1, 7, 60, 250, 1000]) {
      const s = modeGame('orbit', n);
      expect([s.muzzleX, s.muzzleY]).toEqual([s.width / 2, (s.top + s.bottom) / 2]);
      for (const z of s.zeros.slice(0, s.objectCount)) {
        expect(z.x).toBeGreaterThanOrEqual(z.rx - 1e-9);
        expect(z.x).toBeLessThanOrEqual(s.width - z.rx + 1e-9);
        expect(z.y).toBeGreaterThanOrEqual(s.top + z.ry - 1e-9);
        expect(z.y).toBeLessThanOrEqual(s.bottom - z.ry + 1e-9);
        // An oval's nearest point is its smaller reach away.
        const i = s.zeros.indexOf(z);
        const nearest = os(s).track[i]! * Math.min(os(s).reachX[i]!, os(s).reachY[i]!);
        expect(nearest + 1e-9).toBeGreaterThanOrEqual(Math.min(nearest, ORBIT_TURRET_CLEAR + Math.max(z.rx, z.ry)));
      }
    }
  });

  it('sends zeros round the turret both ways, at a steady distance', () => {
    const s = modeGame('orbit', 60);
    const spins = os(s).spin.slice(0, s.objectCount);
    expect(spins.some((w) => w > 0) && spins.some((w) => w < 0)).toBe(true);
    const z = s.zeros[0]!;
    const radius = () => Math.hypot((z.x - s.muzzleX) / os(s).reachX[0]!, (z.y - s.muzzleY) / os(s).reachY[0]!);
    const r0 = radius();
    run(s, 2);
    expect(radius()).toBeCloseTo(r0, 6);
    expect(Math.hypot(z.vx, z.vy)).toBeGreaterThan(0);
  });

  it('fires from the middle, at the finger', () => {
    const s = modeGame('orbit', 60);
    pointerDown(s, s.muzzleX + 100, s.muzzleY);
    expect(s.aim).toBeCloseTo(0);
    expect(s.bullets.count).toBe(1);
    expect(s.bullets.items[0]!.x).toBeGreaterThan(s.muzzleX);
  });
});

describe('splitting', () => {
  it('keeps room for every armored zero’s pieces, within MAX_ZEROS', () => {
    expect(orbitSpares(composeRound(60).groups, 60)).toBe(0);
    for (const n of [61, 250, 1000]) {
      const s = modeGame('orbit', n);
      const armored = s.zeros.filter((z) => z.kind === 'armored').length;
      expect(s.zeros.length - s.objectCount).toBe(Math.min(armored * ORBIT_PIECES, 64 - s.objectCount));
      expect(os(s).spareFrom).toBe(s.objectCount);
    }
    expect(modeGame('orbit', 60).zeros.length).toBe(60);
  });

  it('shares a value out across the pieces, with a badge for each share', () => {
    expect([pieceValue(25, 0), pieceValue(25, 1)]).toEqual([12, 13]);
    expect([pieceValue(10, 0), pieceValue(10, 1)]).toEqual([5, 5]);
    expect([pieceValue(1667, 0), pieceValue(1667, 1)]).toEqual([833, 834]);
    expect(pieceBadges(composeRound(1000).groups)).toEqual([12, 13]); // 40 zeros ×25
    const s = modeGame('orbit', 1000);
    expect(os(s).pieceValues).toEqual([12, 13]);
    expect(os(s).badgeBase).toBe(1); // after the round's own ×25
  });

  it('splits an armored zero it destroys into pieces that keep its value', () => {
    const s = modeGame('orbit', 250);
    popIn(s);
    const z = firstArmored(s);
    const before = s.valueLeft;
    const v = z.value;
    expect(damageZero(s, z, z.hp)).toBe(true);
    expect(z.alive).toBe(false);
    expect(s.report.armoredKills).toBe(1);
    expect(s.valueLeft).toBe(before);
    expect(worth(s)).toBe(before);
    const pieces = s.zeros.slice(os(s).spareFrom).filter((p) => p.alive);
    expect(pieces.map((p) => p.value).sort((a, b) => a - b)).toEqual([pieceValue(v, 0), pieceValue(v, 1)]);
    for (const p of pieces) {
      expect(p).toMatchObject({ kind: 'standard', hp: 1, color: z.color, energyBar: false });
      expect(p.ry).toBeLessThan(z.ry);
      expect(os(s).pieceValues[p.badge - os(s).badgeBase]).toBe(p.value);
    }
  });

  it('shows the pieces after a moment, so the hit that split it can’t take them unseen', () => {
    const s = modeGame('orbit', 250, { weapon: 'nuke' });
    popIn(s);
    const z = firstArmored(s);
    damageZero(s, z, z.hp);
    const pieces = s.zeros.slice(os(s).spareFrom).filter((p) => p.alive);
    expect(pieces.every((p) => damageZero(s, p, 1) === false)).toBe(true);
    run(s, ORBIT_SPLIT_GRACE + DT);
    expect(pieces.every((p) => damageZero(s, p, 1) === true)).toBe(true);
  });

  it('ends the round on the last piece', () => {
    const s = modeGame('orbit', 61);
    popIn(s);
    for (const z of s.zeros) if (z.alive && z.kind !== 'armored') damageZero(s, z, 1);
    const z = firstArmored(s);
    damageZero(s, z, z.hp);
    expect(s.phase).toBe('play');
    run(s, ORBIT_SPLIT_GRACE + DT);
    const pieces = alive(s);
    expect(pieces).toHaveLength(ORBIT_PIECES);
    damageZero(s, pieces[0]!, 1);
    expect(s.phase).toBe('play');
    damageZero(s, pieces[1]!, 1);
    expect(s.valueLeft).toBe(0);
    expect(s.phase).toBe('celebrate');
  });

  it('lets a zero go the usual way when there’s no room left for its pieces', () => {
    const s = modeGame('orbit', 61);
    popIn(s);
    for (let j = os(s).spareFrom; j < s.zeros.length; j++) s.zeros[j]!.alive = true; // taken
    s.zeros.slice(os(s).spareFrom).forEach((p) => (p.value = 0));
    const z = firstArmored(s);
    const before = s.valueLeft;
    damageZero(s, z, z.hp);
    expect(s.valueLeft).toBe(before - 10);
  });

  it('never splits on Finish round, so it always ends the round', () => {
    for (const n of [61, 250, 1000]) {
      const s = modeGame('orbit', n);
      run(s, 1);
      expect(finishAll(s)).toBe(true);
      expect(s.valueLeft).toBe(0);
      expect(alive(s)).toHaveLength(0);
      expect(s.phase).toBe('celebrate');
    }
  });

  it('splits what a bomb destroys, and the count stays true', () => {
    const s = modeGame('orbit', 250);
    popIn(s);
    expect(dropBomb(s)).toBe(true);
    expect(s.valueLeft).toBe(worth(s));
    step(s, DT);
    expect(s.valueLeft).toBe(worth(s));
  });
});

describe('the late-round assist', () => {
  it('homes bullets in on the last few zeros', () => {
    const s = modeGame('orbit', 60);
    popIn(s);
    for (let j = 1; j < s.zeros.length; j++) s.zeros[j]!.alive = false;
    // The last zero holds still on its track, right of the turret; a bullet heads straight up.
    os(s).angle[0] = 0;
    os(s).spin[0] = 0;
    const b = bulletAt(s, s.muzzleX, s.muzzleY, 0, -1500);
    step(s, DT);
    expect(s.zeros[0]!.x).toBeGreaterThan(s.muzzleX);
    expect(b.vx).toBeGreaterThan(0);
    expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(1500);
  });
});
