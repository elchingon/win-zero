// Golden fingerprints of the Shooter, taken before the round learned to host other modes (M5).
// Seeded rounds play the same fixed script (script.ts), and every frame folds the round's state
// into a running hash: every zero, bullet, particle, ring, beam and bolt, the fill, the counter,
// the shake and the random generator. The lines below were captured from the Shooter as it
// shipped. If one changes, the Shooter now plays differently: fix the code, never these lines.
import { describe, expect, it } from '@jest/globals';

import { WEAPONS } from '@/engine';

import { moveAim, pointerDown, pointerMove, pointerUp, pressFire, releaseFire } from '../input';
import type { GameConfig, GameState } from '../types';
import { makeCheckpoints, makeHasher, runScript, scriptConfig, type Hands, type Hasher } from './script';

const ROUNDS = [7, 60, 250, 1000] as const;

/** The touches GameCanvas made when the goldens were taken, and the website still makes. */
const PRESS: Hands = { down: pressFire, move: moveAim, up: releaseFire };
/** The touches GameCanvas makes since the round learned modes. */
const POINTER: Hands = { down: pointerDown, move: pointerMove, up: pointerUp };

/** The round as it stood before M5: only the fields that existed then, so new ones can't move it. */
function foldState(h: Hasher, s: GameState): void {
  h.num(s.n);
  h.num(s.seed);
  h.num(s.width);
  h.num(s.height);
  h.num(s.top);
  h.num(s.bottom);
  h.num(s.muzzleX);
  h.num(s.muzzleY);
  h.bool(s.reduceMotion);
  h.num(s.objectCount);
  h.bool(s.busy);
  h.str(s.phase);
  h.num(s.time);
  h.num(s.phaseT);
  h.num(s.valueLeft);
  for (const z of s.zeros) {
    h.bool(z.alive);
    h.str(z.kind);
    h.num(z.x);
    h.num(z.y);
    h.num(z.vx);
    h.num(z.vy);
    h.num(z.rx);
    h.num(z.ry);
    h.num(z.color);
    h.num(z.hp);
    h.num(z.maxHp);
    h.num(z.value);
    h.num(z.badge);
    h.bool(z.energyBar);
    h.num(z.delay);
    h.num(z.age);
    h.num(z.hitFlash);
  }
  h.num(s.bullets.count);
  for (let i = 0; i < s.bullets.count; i++) {
    const b = s.bullets.items[i]!;
    h.num(b.x);
    h.num(b.y);
    h.num(b.vx);
    h.num(b.vy);
    h.str(b.weapon.id);
  }
  h.num(s.particles.count);
  for (let i = 0; i < s.particles.count; i++) {
    const p = s.particles.items[i]!;
    h.str(p.shape);
    h.num(p.x);
    h.num(p.y);
    h.num(p.vx);
    h.num(p.vy);
    h.num(p.life);
    h.num(p.max);
    h.num(p.size);
    h.num(p.color);
    h.num(p.gravity);
    h.num(p.drag);
    h.bool(p.dragY);
    h.num(p.rot);
    h.num(p.spin);
  }
  h.num(s.rings.count);
  for (let i = 0; i < s.rings.count; i++) {
    const r = s.rings.items[i]!;
    h.num(r.x);
    h.num(r.y);
    h.num(r.r);
    h.num(r.max);
    h.num(r.t);
    h.num(r.dur);
    h.num(r.color);
    h.num(r.width);
  }
  h.num(s.beams.count);
  for (let i = 0; i < s.beams.count; i++) {
    const b = s.beams.items[i]!;
    h.num(b.x1);
    h.num(b.y1);
    h.num(b.x2);
    h.num(b.y2);
    h.num(b.t);
    h.num(b.dur);
  }
  h.num(s.bolts.count);
  for (let i = 0; i < s.bolts.count; i++) {
    const b = s.bolts.items[i]!;
    for (const x of b.xs) h.num(x);
    for (const y of b.ys) h.num(y);
    h.num(b.t);
    h.num(b.dur);
  }
  h.num(s.glyphCount);
  h.num(s.glyphSize);
  h.bool(s.overlayNumber);
  h.num(s.fillLen);
  h.str(s.weapon.id);
  h.num(s.aim);
  h.bool(s.firing);
  h.num(s.sinceShot);
  h.num(s.shake);
  h.num(s.shakeX);
  h.num(s.shakeY);
  h.num(s.flash);
  h.num(s.muzzle);
  h.num(s.rng.s);
  const r = s.report;
  h.num(r.seed);
  h.bool(r.dirty);
  h.num(r.valueLeft);
  h.num(r.shots);
  h.num(r.hits);
  h.num(r.kills);
  h.num(r.armoredKills);
  h.num(r.blasts);
  h.num(r.bombs);
  h.bool(r.final);
  h.bool(r.showResult);
}

/** The fill's glyphs are laid out once, when the round is built. */
function foldGlyphs(h: Hasher, s: GameState): void {
  for (const g of s.glyphs) {
    h.num(g.x);
    h.num(g.y);
    h.num(g.color);
    h.num(g.delay);
  }
}

function fingerprint(cfg: GameConfig, hands: Hands = PRESS): string[] {
  const h = makeHasher();
  const lines: string[] = [];
  const due = makeCheckpoints();
  let first = true;
  runScript(cfg, hands, (s, f) => {
    if (first) {
      foldGlyphs(h, s);
      first = false;
    }
    foldState(h, s);
    if (!due(s, f)) return;
    const alive = s.zeros.filter((z) => z.alive).length;
    lines.push(`f${f} ${s.phase} ${s.valueLeft}/${s.n} alive=${alive} rng=${s.rng.s} h=${h.hex()}`);
  });
  return lines;
}

const GOLDEN: Record<(typeof ROUNDS)[number], string[]> = {
  7: [
    'f0 play 7/7 alive=7 rng=-383646175 h=8cf2e51b',
    'f5 play 7/7 alive=7 rng=-383646175 h=8234608f',
    'f99 play 5/7 alive=5 rng=-1820657709 h=34b2410b',
    'f199 play 3/7 alive=3 rng=-354255681 h=c60d9342',
    'f254 celebrate 0/7 alive=0 rng=-694274475 h=0246b57f',
    'f259 celebrate 0/7 alive=0 rng=441514471 h=cb220d73',
    'f299 celebrate 0/7 alive=0 rng=-573968381 h=96b11b8b',
    'f302 fill 0/7 alive=0 rng=-573968381 h=6af7bd0a',
    'f307 fill 0/7 alive=0 rng=-573968381 h=409676cf',
    'f399 fill 0/7 alive=0 rng=-573968381 h=d48856da',
    'f445 done 0/7 alive=0 rng=-461238587 h=11befb07',
    'f450 done 0/7 alive=0 rng=610609162 h=590b4fc3',
    'f499 done 0/7 alive=0 rng=1411539523 h=a351e229',
    'f599 done 0/7 alive=0 rng=-401542893 h=6f9beaf2',
    'f699 done 0/7 alive=0 rng=1192741529 h=92e56e6a',
    'f799 done 0/7 alive=0 rng=1275166123 h=baf3c60e',
    'f899 done 0/7 alive=0 rng=469990259 h=e2a438be',
    'f999 done 0/7 alive=0 rng=-718832787 h=c2f9e3ef',
    'f1099 done 0/7 alive=0 rng=-636408193 h=f9971817',
    'f1199 done 0/7 alive=0 rng=-553983599 h=09d50648',
  ],
  60: [
    'f0 play 60/60 alive=60 rng=-2061269844 h=d8289ad3',
    'f5 play 60/60 alive=60 rng=-2061269844 h=eaf2db79',
    'f99 play 47/60 alive=47 rng=-1648232168 h=06cf78de',
    'f199 play 20/60 alive=20 rng=-1694604674 h=2d57ccff',
    'f299 play 6/60 alive=6 rng=-1161260904 h=fb335e57',
    'f399 play 3/60 alive=3 rng=-728825125 h=fb036bfb',
    'f480 celebrate 0/60 alive=0 rng=-421855649 h=55837eed',
    'f485 celebrate 0/60 alive=0 rng=713933297 h=274f2a50',
    'f499 celebrate 0/60 alive=0 rng=458168509 h=0d548746',
    'f528 fill 0/60 alive=0 rng=330286115 h=26dcfedc',
    'f533 fill 0/60 alive=0 rng=330286115 h=723522a8',
    'f599 fill 0/60 alive=0 rng=-309125855 h=7ef13adc',
    'f689 done 0/60 alive=0 rng=29063527 h=cb7f5d6d',
    'f694 done 0/60 alive=0 rng=-794595734 h=0441ad9d',
    'f699 done 0/60 alive=0 rng=277252015 h=94a9b27e',
    'f799 done 0/60 alive=0 rng=1871536437 h=1ffae836',
    'f899 done 0/60 alive=0 rng=1066360573 h=79b09046',
    'f999 done 0/60 alive=0 rng=-626415749 h=f564d6ac',
    'f1099 done 0/60 alive=0 rng=463915397 h=13797a53',
    'f1199 done 0/60 alive=0 rng=-341260467 h=b0db9575',
  ],
  250: [
    'f0 play 250/250 alive=52 rng=217884538 h=985c10d8',
    'f5 play 250/250 alive=52 rng=217884538 h=3fd272b6',
    'f99 play 240/250 alive=42 rng=-1505196984 h=37ddc0a2',
    'f199 play 221/250 alive=32 rng=1630337760 h=a3bfab7e',
    'f299 play 152/250 alive=17 rng=-627916944 h=072cba0b',
    'f399 play 101/250 alive=11 rng=1022732375 h=2384d616',
    'f480 celebrate 0/250 alive=0 rng=1193328451 h=0fe8fab3',
    'f485 celebrate 0/250 alive=0 rng=-1965849899 h=a14883de',
    'f499 celebrate 0/250 alive=0 rng=2073352609 h=fa700223',
    'f528 fill 0/250 alive=0 rng=1945470215 h=543f171b',
    'f533 fill 0/250 alive=0 rng=1945470215 h=5430325c',
    'f599 fill 0/250 alive=0 rng=-1349166829 h=16db138e',
    'f689 done 0/250 alive=0 rng=500882381 h=ec1b9248',
    'f694 done 0/250 alive=0 rng=-322776880 h=c6ad846c',
    'f699 done 0/250 alive=0 rng=-1146436141 h=5bd19c2b',
    'f799 done 0/250 alive=0 rng=1335448739 h=acbb0b0e',
    'f899 done 0/250 alive=0 rng=-1485540229 h=346259c2',
    'f999 done 0/250 alive=0 rng=2124557297 h=f315397f',
    'f1099 done 0/250 alive=0 rng=815428157 h=113a2430',
    'f1199 done 0/250 alive=0 rng=1018158845 h=eab3bc93',
  ],
  1000: [
    'f0 play 1000/1000 alive=40 rng=1489132928 h=75ec5af9',
    'f5 play 1000/1000 alive=40 rng=1489132928 h=7cb22a7b',
    'f99 play 1000/1000 alive=40 rng=-1580044528 h=0f7c7331',
    'f199 play 950/1000 alive=38 rng=2059443492 h=a7de3532',
    'f299 play 950/1000 alive=38 rng=1772458798 h=c6008fb9',
    'f399 play 750/1000 alive=30 rng=1575474998 h=d4c06873',
    'f499 play 75/1000 alive=3 rng=-457320118 h=fb2ae6c6',
    'f599 play 25/1000 alive=1 rng=2009412162 h=829441b8',
    'f699 play 25/1000 alive=1 rng=2009412162 h=180d4676',
    'f799 play 25/1000 alive=1 rng=2009412162 h=de580a4f',
    'f899 play 25/1000 alive=1 rng=2009412162 h=b40e8224',
    'f900 celebrate 0/1000 alive=0 rng=-842796712 h=b23a8703',
    'f905 celebrate 0/1000 alive=0 rng=292992234 h=50fc9340',
    'f949 fill 0/1000 alive=0 rng=-722490618 h=bd31d9e3',
    'f954 fill 0/1000 alive=0 rng=-722490618 h=b03ae39f',
    'f999 fill 0/1000 alive=0 rng=285415934 h=91c8a49b',
    'f1099 fill 0/1000 alive=0 rng=-1783431270 h=eccf30f8',
    'f1111 done 0/1000 alive=0 rng=736335110 h=d0883d5a',
    'f1116 done 0/1000 alive=0 rng=1808182859 h=89a3b3b2',
    'f1199 done 0/1000 alive=0 rng=1202406886 h=fa6588e0',
  ],
};

describe('the Shooter, as it shipped', () => {
  it.each(ROUNDS)('Day %i plays exactly as it did', (n) => {
    expect(fingerprint(scriptConfig(n))).toEqual(GOLDEN[n]);
  });

  // Added with the mode refactor, against the same lines.
  it.each(ROUNDS)('Day %i plays the same as the app sets it up now: the Shooter by name, through the pointer', (n) => {
    expect(fingerprint({ ...scriptConfig(n), mode: 'shooter' }, POINTER)).toEqual(GOLDEN[n]);
  });

  it.each(ROUNDS)('Day %i in a mode whose round isn’t built yet plays the Shooter', (n) => {
    expect(fingerprint({ ...scriptConfig(n), mode: 'catch' })).toEqual(GOLDEN[n]);
  });

  it('script reaches every part of the round', () => {
    const runs = ROUNDS.map((n) => runScript(scriptConfig(n), PRESS));
    for (const run of runs) {
      expect(run.phases).toEqual(['play', 'celebrate', 'fill', 'done']);
      expect([run.tally.finals, run.tally.results]).toEqual([1, 1]);
    }
    expect(runs.some((r) => r.bombed)).toBe(true);
    expect(runs.some((r) => r.finished)).toBe(true);
    expect(runs.some((r) => !r.finished)).toBe(true);
    expect(new Set(runs.flatMap((r) => r.fired))).toEqual(new Set(WEAPONS.map((w) => w.id)));
  });
});
