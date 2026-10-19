// A player that clears rounds, for the clear test: it aims at the lowest zero, leading it by the
// shot's flight, and holds on, through the same pointer calls the canvas makes. Every frame it
// checks what must hold in any mode (the counter, ×V, the board's edges, the effect caps and
// the order of phases) and keeps what broke, rather than failing on the spot.
import { composeRound, fillPlan, type ModeId, type WeaponDef } from '@/engine';

import { armorBadges } from '../badges';
import { BIG_BULLET_SPEED, BULLET_SPEED, MAX_BEAMS, MAX_BOLTS, MAX_BULLETS, MAX_PARTICLES, MAX_RINGS } from '../constants';
import { hittable } from '../hit';
import { pointerDown, pointerMove } from '../input';
import { resetReport } from '../report';
import { createGame } from '../spawn';
import { step } from '../step';
import type { GameConfig, GameState, Phase, Zero } from '../types';

export const BOT_FPS = 60;
/** Give up on a round after this long. */
export const LIMIT_S = 240;
export const LIMIT_FRAMES = LIMIT_S * BOT_FPS;
/** Keep this many broken rules per round: enough to see what went wrong. */
const MAX_VIOLATIONS = 10;
/** Rounding slack for positions on the board's edges. */
const EDGE_EPSILON = 1e-6;

const PHASES: readonly Phase[] = ['play', 'celebrate', 'fill', 'done'];

export interface Screen {
  name: string;
  width: number;
  height: number;
  insetTop: number;
  insetBottom: number;
}

/** A mid-range Android phone and a big tablet: the smallest and biggest boards. */
export const SCREENS: readonly Screen[] = [
  { name: 'phone', width: 360, height: 780, insetTop: 24, insetBottom: 48 },
  { name: 'tablet', width: 1024, height: 1366, insetTop: 24, insetBottom: 20 },
];

/** Where to aim to meet `z`, leading it by the shot's flight time (bounces aside). */
export function lead(s: GameState, z: Zero): { x: number; y: number } {
  const speed = s.weapon.pattern === 'beam' ? Infinity : s.weapon.splash ? BIG_BULLET_SPEED : BULLET_SPEED;
  let x = z.x;
  let y = z.y;
  for (let i = 0; i < 2; i++) {
    const t = Math.hypot(x - s.muzzleX, y - s.muzzleY) / speed;
    x = z.x + z.vx * t;
    y = z.y + z.vy * t;
  }
  return { x, y };
}

/** The lowest zero that can be hit. */
export function target(s: GameState): Zero | null {
  let best: Zero | null = null;
  for (const z of s.zeros) if (hittable(z) && (!best || z.y > best.y)) best = z;
  return best;
}

export function roundConfig(n: number, opts: { mode: ModeId; weapon: WeaponDef; screen: Screen; seed: number }): GameConfig {
  const { width, height, insetTop, insetBottom } = opts.screen;
  return {
    n,
    groups: composeRound(n).groups,
    fill: fillPlan(n),
    width,
    height,
    insetTop,
    insetBottom,
    weapon: opts.weapon,
    seed: opts.seed,
    reduceMotion: false,
    mode: opts.mode,
  };
}

export interface Cleared {
  state: GameState;
  frames: number;
  finals: number;
  results: number;
  violations: string[];
}

/** The round as built matches composeRound: each group's zeros, worth its value, wearing its badge. */
function checkStart(s: GameState, cfg: GameConfig, broke: (what: string) => void): void {
  const badges = armorBadges(cfg.groups);
  let i = 0;
  let total = 0;
  for (const g of cfg.groups) {
    for (let k = 0; k < g.count; k++, i++) {
      const z = s.zeros[i];
      if (!z) return broke(`zero ${i} missing`);
      if (z.kind !== g.kind || z.value !== g.value || z.hp !== g.hp || z.maxHp !== g.hp || z.energyBar !== g.energyBar) {
        broke(`zero ${i} isn't its group's: ${z.kind} ×${z.value} ${z.hp} HP`);
      }
      const badge = z.kind === 'armored' ? badges[z.badge] : undefined;
      if (z.kind === 'armored' ? badge !== z.value : z.badge !== -1) broke(`zero ${i} wears the wrong badge`);
      total += z.value;
    }
  }
  if (i !== s.zeros.length) broke(`${s.zeros.length} zeros for ${i} in the groups`);
  if (total !== cfg.n || s.valueLeft !== cfg.n) broke(`worth ${total}, counting ${s.valueLeft}, for Day ${cfg.n}`);
}

/** Play `cfg` until the result sheet, or LIMIT_FRAMES. */
export function clearRound(cfg: GameConfig): Cleared {
  const s = createGame(cfg);
  const violations: string[] = [];
  let frame = 0;
  const broke = (what: string) => {
    if (violations.length < MAX_VIOLATIONS) violations.push(`${what} (frame ${frame})`);
  };
  checkStart(s, cfg, broke);

  const wasAlive: boolean[] = s.zeros.map((z) => z.alive);
  let finals = 0;
  let results = 0;
  let held = false;
  let lastLeft = s.valueLeft;
  let phaseAt = 0;
  for (; frame < LIMIT_FRAMES && s.phase !== 'done'; frame++) {
    for (let i = 0; i < s.zeros.length; i++) wasAlive[i] = s.zeros[i]?.alive ?? false;
    const z = target(s);
    if (z && s.phase === 'play') {
      const aim = lead(s, z);
      if (held) pointerMove(s, aim.x, aim.y);
      else pointerDown(s, aim.x, aim.y);
      held = true;
    }
    step(s, 1 / BOT_FPS);

    // The counter is the value of the zeros still standing, and only ever goes down.
    let left = 0;
    let armoredDied = 0;
    for (let i = 0; i < s.zeros.length; i++) {
      const zero = s.zeros[i]!;
      if (zero.alive) {
        left += zero.value;
        // A zero on the board stays on it.
        if (
          hittable(zero) &&
          (zero.x < zero.rx - EDGE_EPSILON ||
            zero.x > s.width - zero.rx + EDGE_EPSILON ||
            zero.y < s.top + zero.ry - EDGE_EPSILON ||
            zero.y > s.bottom - zero.ry + EDGE_EPSILON)
        ) {
          broke(`zero ${i} left the board at (${zero.x.toFixed(1)}, ${zero.y.toFixed(1)})`);
        }
      } else if (wasAlive[i] && zero.kind === 'armored') {
        armoredDied++;
      }
    }
    if (s.valueLeft !== left) broke(`counter ${s.valueLeft}, zeros standing worth ${left}`);
    if (s.report.valueLeft !== s.valueLeft) broke(`reported ${s.report.valueLeft}, counter ${s.valueLeft}`);
    if (s.valueLeft < 0 || s.valueLeft > lastLeft) broke(`counter went from ${lastLeft} to ${s.valueLeft}`);
    if (s.report.armoredKills !== armoredDied) broke(`${s.report.armoredKills} armored kills reported, ${armoredDied} went`);
    lastLeft = s.valueLeft;

    if (s.bullets.count > MAX_BULLETS) broke(`${s.bullets.count} bullets`);
    if (s.particles.count > MAX_PARTICLES) broke(`${s.particles.count} particles`);
    if (s.rings.count > MAX_RINGS) broke(`${s.rings.count} rings`);
    if (s.beams.count > MAX_BEAMS) broke(`${s.beams.count} beams`);
    if (s.bolts.count > MAX_BOLTS) broke(`${s.bolts.count} bolts`);

    const at = PHASES.indexOf(s.phase);
    if (at < phaseAt) broke(`went back to ${s.phase}`);
    phaseAt = at;

    // What GameCanvas does after each frame.
    if (s.report.final) finals++;
    if (s.report.showResult) results++;
    resetReport(s.report);
  }
  return { state: s, frames: frame, finals, results, violations };
}
