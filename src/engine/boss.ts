// Boss rounds (SPEC 4): on the milestone days, the round is one huge zero worth the whole day,
// fought in stages. Each stage takes the hits its HP says. When one breaks, the boss sheds a ring
// of small zeros carrying part of its value, shrinks and speeds up, and can't be hit until the ring
// is cleared; the last stage is the boss alone. The value is kept at every step, so the counter
// only ever goes down. A boss round is the round of a Yes that set a new high in its run on one of
// BOSS_DAYS (as celebrations.ts reads it), and its replays.
import type { ModeId } from './modes';
import { BOMB_EVERY, SHIELD_EVERY, type MilestoneRewards } from './rewards';
import type { ZeroGroup } from './round';

/** The days a boss round comes on. Each is a multiple of BOMB_EVERY or SHIELD_EVERY, so a new high pays a bomb or a shield. */
export const BOSS_DAYS = [7, 30, 100, 365] as const;
export type BossDay = (typeof BOSS_DAYS)[number];

/** Each stage's HP in the Shooter, by day: the boss's stages are its phases. */
export const BOSS_STAGE_HP: Readonly<Record<BossDay, readonly number[]>> = {
  7: [10, 8, 6],
  30: [24, 18, 14],
  100: [40, 32, 26, 20],
  365: [80, 64, 52, 40],
};

/**
 * A stage's HP, times this in each game (SPEC 9): a catch, a cut or a ball comes far less often
 * than a shot, so those games' bosses take fewer hits to stay about as long.
 */
export const BOSS_MODE_HP_SCALE: Readonly<Record<ModeId, number>> = {
  shooter: 1,
  orbit: 1,
  slice: 0.6,
  breaker: 0.4,
  catch: 0.3,
};

/** A broken stage sheds this share of the value the boss had, as a ring of zeros. */
export const BOSS_SHED_SHARE = 0.3;
/** A ring holds at most this many zeros; a bigger share is spread across them. */
export const BOSS_RING_MAX = 8;
/** Each ring zero takes this many hits. */
export const BOSS_RING_HP = 1;

export interface BossStage {
  /** Hits this stage takes. */
  hp: number;
  /** The zeros the boss is worth through it. */
  value: number;
  /** What it sheds when it breaks: each ring zero's value, biggest first. Empty for the last stage. */
  shed: number[];
}

export interface BossPlan {
  /** The day: the boss's value at the start. */
  n: number;
  stages: BossStage[];
  /** The distinct values above 1 that wear a ×V badge: the boss's stages, then the rings'. */
  badges: number[];
  /** Spare zero slots the rings need: the biggest ring, since the boss waits for each to clear. */
  spares: number;
}

export function isBossDay(n: number): n is BossDay {
  return (BOSS_DAYS as readonly number[]).includes(n);
}

/** `total` zeros' value over a ring of up to BOSS_RING_MAX zeros, as evenly as whole zeros allow. */
function ringValues(total: number): number[] {
  const count = Math.min(BOSS_RING_MAX, total);
  const base = Math.floor(total / count);
  const extra = total - base * count;
  return Array.from({ length: count }, (_, k) => (k < extra ? base + 1 : base));
}

/** The boss of `day`'s round, in `mode`. */
export function bossPlan(day: BossDay, mode: ModeId): BossPlan {
  const hps = BOSS_STAGE_HP[day];
  const stages: BossStage[] = [];
  let value: number = day;
  hps.forEach((base, k) => {
    const hp = Math.max(1, Math.round(base * BOSS_MODE_HP_SCALE[mode]));
    // The boss always keeps at least one zero for its last stage.
    const shed = k === hps.length - 1 ? 0 : Math.max(1, Math.min(value - 1, Math.round(value * BOSS_SHED_SHARE)));
    stages.push({ hp, value, shed: shed > 0 ? ringValues(shed) : [] });
    value -= shed;
  });
  const badges: number[] = [];
  const badge = (v: number) => {
    if (v > 1 && !badges.includes(v)) badges.push(v);
  };
  stages.forEach((s) => badge(s.value));
  stages.forEach((s) => s.shed.forEach(badge));
  return { n: day, stages, badges, spares: Math.max(0, ...stages.map((s) => s.shed.length)) };
}

/** The round's one zero: the boss, worth the whole day, with its first stage's HP. */
export function bossGroups(plan: BossPlan): ZeroGroup[] {
  const first = plan.stages[0];
  return [{ kind: 'boss', count: 1, hp: first?.hp ?? 1, value: plan.n, energyBar: true }];
}

/**
 * The boss a day's round has, or null: a boss day reached by a new high in its run, which a new
 * high's bomb or shield shows (full shields count, `shieldCapped`). Climbing back to the same day
 * within a run is an ordinary round.
 */
export function bossRoundFor(round: { n: number; rewards: MilestoneRewards }, mode: ModeId): BossPlan | null {
  const { n, rewards } = round;
  if (!isBossDay(n)) return null;
  const fresh = (n % BOMB_EVERY === 0 && rewards.bomb) || (n % SHIELD_EVERY === 0 && (rewards.shield || rewards.shieldCapped));
  return fresh ? bossPlan(n, mode) : null;
}
