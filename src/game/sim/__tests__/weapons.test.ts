// The seven weapons (SPEC 5): how each fires, and what splash, chain and the laser reach.
import { describe, expect, it } from '@jest/globals';

import { weaponById, type WeaponId } from '@/engine';

import { BIG_BULLET_SPEED, BULLET_SPEED, FAN_STEP, PARALLEL_OFFSET, SPLASH_MARGIN } from '../constants';
import { pressFire, setWeapon } from '../input';
import { step } from '../step';
import { applyHit, fireBeam, splashRadius } from '../weapons';
import { game, isolate } from './fixtures';

const bullets = (s: ReturnType<typeof game>) => s.bullets.items.slice(0, s.bullets.count);
const up = -Math.PI / 2;

describe('fire patterns', () => {
  it('Pea Shooter: one bullet', () => {
    const s = game(8, { weapon: 'pea' });
    pressFire(s, s.muzzleX, 0);
    expect(bullets(s)).toHaveLength(1);
  });

  it('Twin Barrel: two parallel bullets, PARALLEL_OFFSET either side of the aim', () => {
    const s = game(8, { weapon: 'twin' });
    pressFire(s, s.muzzleX, 0);
    const [a, b] = bullets(s);
    expect([a!.x - s.muzzleX, b!.x - s.muzzleX]).toEqual([-PARALLEL_OFFSET, PARALLEL_OFFSET].map((v) => expect.closeTo(v)));
    expect(a!.vx).toBeCloseTo(0);
    expect(b!.vy).toBeCloseTo(-BULLET_SPEED);
    expect(a!.y).toBeCloseTo(b!.y);
  });

  it('Twin Barrel: the pair turns with the aim', () => {
    const s = game(8, { weapon: 'twin' });
    pressFire(s, s.muzzleX + 100, s.muzzleY); // straight right
    const [a, b] = bullets(s);
    expect(a!.x).toBeCloseTo(b!.x);
    expect(Math.abs(a!.y - b!.y)).toBeCloseTo(2 * PARALLEL_OFFSET);
  });

  it('Scatter Gun: five pellets fanned ±0.22 rad around the aim', () => {
    const s = game(8, { weapon: 'scatter' });
    pressFire(s, s.muzzleX, 0);
    const angles = bullets(s).map((b) => Math.atan2(b.vy, b.vx) - up);
    expect(angles).toEqual([-2, -1, 0, 1, 2].map((k) => expect.closeTo(k * FAN_STEP)));
    expect(2 * FAN_STEP).toBeCloseTo(0.22);
  });

  it.each<[WeaponId, number]>([
    ['rocket', BIG_BULLET_SPEED],
    ['nuke', BIG_BULLET_SPEED],
    ['chain', BULLET_SPEED],
  ])('%s: one bullet at %i pt/s', (id, speed) => {
    const s = game(8, { weapon: id });
    pressFire(s, s.muzzleX, 0);
    const [b] = bullets(s);
    expect(bullets(s)).toHaveLength(1);
    expect(Math.hypot(b!.vx, b!.vy)).toBeCloseTo(speed);
  });

  it('Rail Laser: a beam, no bullet', () => {
    const s = game(8, { weapon: 'laser' });
    pressFire(s, s.muzzleX, 0);
    expect(bullets(s)).toHaveLength(0);
    expect(s.beams.count).toBe(1);
    expect(s.report.shots).toBe(1);
  });

  it('lets bullets in flight keep the weapon that fired them', () => {
    const s = game(8, { weapon: 'pea' });
    pressFire(s, s.muzzleX, 0);
    setWeapon(s, weaponById('rocket'));
    step(s, 1 / 60);
    expect(bullets(s)[0]!.weapon.id).toBe('pea');
    s.sinceShot = 1;
    step(s, 1 / 60);
    expect(bullets(s).map((b) => b.weapon.id)).toContain('rocket');
  });
});

// Armored zeros (7 HP at n = 250) show how much damage each one took.
const ARMORED_HP = 7;
function armoredBoard() {
  const s = game(250);
  const armored = s.zeros.filter((z) => z.kind === 'armored');
  const hit = isolate(s, s.zeros.indexOf(armored[0]!), 195, 400);
  return { s, hit, others: armored.slice(1) };
}

describe('Rocket splash', () => {
  it('reaches every other zero within R + ry × SPLASH_MARGIN, and spares the one hit', () => {
    const { s, hit, others } = armoredBoard();
    const rocket = weaponById('rocket');
    const reach = splashRadius(s, rocket.splash!);
    expect(reach).toBeCloseTo(Math.max(70, 390 * 0.2));
    const [inside, outside] = others;
    Object.assign(inside!, { x: hit.x + reach + inside!.ry * SPLASH_MARGIN - 1, y: hit.y });
    Object.assign(outside!, { x: hit.x, y: hit.y + reach + outside!.ry * SPLASH_MARGIN + 1 });
    applyHit(s, rocket, hit);
    expect(hit.hp).toBe(ARMORED_HP - 3);
    expect(inside!.hp).toBe(ARMORED_HP - 2);
    expect(outside!.hp).toBe(ARMORED_HP);
    expect(s.report.blasts).toBe(1);
    expect(s.rings.count).toBeGreaterThan(0);
  });

  it('kills standard zeros in reach outright', () => {
    const s = game(30);
    const hit = isolate(s, 0, 195, 400);
    const near = s.zeros[1]!;
    Object.assign(near, { x: 230, y: 420 });
    applyHit(s, weaponById('rocket'), hit);
    expect([hit.alive, near.alive]).toEqual([false, false]);
    expect(s.valueLeft).toBe(28);
  });
});

describe('Chain Zapper', () => {
  it('zaps the 4 nearest zeros still standing, not counting the one hit', () => {
    const { s, hit, others } = armoredBoard();
    const ring = others.slice(0, 6);
    ring.forEach((z, i) => Object.assign(z, { x: hit.x, y: hit.y - 50 - 10 * i }));
    applyHit(s, weaponById('chain'), hit);
    expect(hit.hp).toBe(ARMORED_HP - 2);
    expect(ring.map((z) => z.hp)).toEqual([6, 6, 6, 6, 7, 7]);
    expect(s.bolts.count).toBe(4);
    // Bolts hop from zero to zero, starting at the one hit.
    const first = s.bolts.items[0]!;
    expect([first.xs[0], first.ys[0]]).toEqual([hit.x, hit.y]);
    expect([first.xs.at(-1), first.ys.at(-1)]).toEqual([ring[0]!.x, ring[0]!.y]);
    expect(s.zeros.every((z) => z.mark === 0)).toBe(true);
  });

  it('skips zeros that are gone or not yet popped in', () => {
    const { s, hit, others } = armoredBoard();
    const [gone, hidden, next] = others;
    Object.assign(gone!, { x: hit.x, y: hit.y - 40, alive: false });
    Object.assign(hidden!, { x: hit.x, y: hit.y - 45, delay: 10 });
    Object.assign(next!, { x: hit.x, y: hit.y - 50 });
    applyHit(s, weaponById('chain'), hit);
    expect(hidden!.hp).toBe(ARMORED_HP);
    expect(next!.hp).toBe(ARMORED_HP - 1);
  });
});

describe('Rail Laser', () => {
  it('hits every zero ahead on its line, and nothing behind or off it', () => {
    const { s, others } = armoredBoard();
    const laser = weaponById('laser');
    const [a, b, beside, behind] = others;
    Object.assign(a!, { x: s.muzzleX, y: 300 });
    Object.assign(b!, { x: s.muzzleX + Math.max(b!.ry, 14) - 1, y: 500 });
    Object.assign(beside!, { x: s.muzzleX + Math.max(beside!.ry, 14) + 1, y: 400 });
    Object.assign(behind!, { x: s.muzzleX, y: s.muzzleY + 100 });
    fireBeam(s, laser, up);
    expect([a, b, beside, behind].map((z) => z!.hp)).toEqual([5, 5, 7, 7]);
  });

  it('reaches tiny zeros through the minimum width', () => {
    const s = game(60);
    const z = isolate(s, 0, s.muzzleX + 12, 300);
    Object.assign(z, { ry: 8, rx: 8 * 0.72 });
    fireBeam(s, weaponById('laser'), up);
    expect(z.alive).toBe(false);
  });
});

describe('Zero Nuke', () => {
  it('splashes, then chains to the 6 nearest survivors, so damage stacks', () => {
    const { s, hit, others } = armoredBoard();
    const nuke = weaponById('nuke');
    const reach = splashRadius(s, nuke.splash!);
    const [stacked, splashOnly, ...rest] = others;
    stacked!.hp = 6;
    Object.assign(stacked!, { x: hit.x + 30, y: hit.y }); // in the splash, nearest
    Object.assign(splashOnly!, { x: hit.x - reach + 5, y: hit.y }); // in the splash, 7th nearest
    const chained = rest.slice(0, 5);
    chained.forEach((z, i) => Object.assign(z, { x: hit.x, y: hit.y + 40 + 8 * i })); // inside the splash too
    applyHit(s, nuke, hit);
    expect(hit.hp).toBe(ARMORED_HP - 6); // the direct hit only
    expect(stacked!.alive).toBe(false); // 3 splash + 3 chain
    expect(chained.map((z) => z.hp)).toEqual([1, 1, 1, 1, 1]); // 7 - 3 - 3
    expect(splashOnly!.hp).toBe(ARMORED_HP - 3); // splash only: the 6 bolts went nearer
    expect(s.bolts.count).toBe(6);
  });
});
