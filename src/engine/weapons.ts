// Weapons (SPEC 5). Unlocked by bestStreak, so a reset never takes one away.

export type WeaponId = 'pea' | 'twin' | 'scatter' | 'rocket' | 'chain' | 'laser' | 'nuke';

/** How a shot leaves the turret. `beam` hits every zero on the line instantly. */
export type FirePattern = 'single' | 'parallel' | 'fan' | 'beam';

export interface SplashSpec {
  damage: number;
  /** Radius = max(minRadiusPx, min(width, height) * radiusFraction), as in the prototype. */
  radiusFraction: number;
  minRadiusPx: number;
}

export interface ChainSpec {
  damage: number;
  /** Nearest live zeros to the one hit (it isn't counted). */
  targets: number;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** bestStreak needed to unlock. */
  unlockAt: number;
  description: string;
  pattern: FirePattern;
  projectiles: number;
  /** Damage to the zero each projectile hits, or to every zero on a beam's line. */
  damage: number;
  /** Damage to other zeros near the hit. The zero hit directly takes `damage` only. */
  splash?: SplashSpec;
  chain?: ChainSpec;
}

export const WEAPONS: readonly WeaponDef[] = [
  {
    id: 'pea',
    name: 'Pea Shooter',
    unlockAt: 1,
    description: 'One bullet per shot.',
    pattern: 'single',
    projectiles: 1,
    damage: 1,
  },
  {
    id: 'twin',
    name: 'Twin Barrel',
    unlockAt: 3,
    description: 'Two bullets side by side.',
    pattern: 'parallel',
    projectiles: 2,
    damage: 1,
  },
  {
    id: 'scatter',
    name: 'Scatter Gun',
    unlockAt: 7,
    description: 'Five pellets in a fan.',
    pattern: 'fan',
    projectiles: 5,
    damage: 1,
  },
  {
    id: 'rocket',
    name: 'Rocket',
    unlockAt: 14,
    description: 'Hits hard and splashes every zero nearby.',
    pattern: 'single',
    projectiles: 1,
    damage: 3,
    splash: { damage: 2, radiusFraction: 0.2, minRadiusPx: 70 },
  },
  {
    id: 'chain',
    name: 'Chain Zapper',
    unlockAt: 30,
    description: 'Lightning jumps to 4 more zeros.',
    pattern: 'single',
    projectiles: 1,
    damage: 2,
    chain: { damage: 1, targets: 4 },
  },
  {
    id: 'laser',
    name: 'Rail Laser',
    unlockAt: 60,
    description: 'Burns through every zero in its line.',
    pattern: 'beam',
    projectiles: 1,
    damage: 2,
  },
  {
    id: 'nuke',
    name: 'Zero Nuke',
    unlockAt: 100,
    description: 'A rocket that chain-zaps on impact.',
    pattern: 'single',
    projectiles: 1,
    damage: 6,
    splash: { damage: 3, radiusFraction: 0.26, minRadiusPx: 90 },
    chain: { damage: 3, targets: 6 },
  },
];

/** Hold-to-fire rate. */
export const FIRE_RATE_HZ = 6;
export const BOMB_DAMAGE = 8;
/** Bomb radius as a fraction of the screen's longest side, centered on the play area. */
export const BOMB_RADIUS_FRACTION = 0.42;

/** The Pea Shooter is always available, even before the first Yes. */
const STARTER_UNLOCK = 1;

export function weaponById(id: WeaponId): WeaponDef {
  const w = WEAPONS.find((x) => x.id === id);
  if (!w) throw new RangeError(`Unknown weapon: ${id}`);
  return w;
}

export function unlockedWeapons(bestStreak: number): WeaponDef[] {
  const reach = Math.max(STARTER_UNLOCK, bestStreak);
  return WEAPONS.filter((w) => w.unlockAt <= reach);
}

export function isUnlocked(id: WeaponId, bestStreak: number): boolean {
  return weaponById(id).unlockAt <= Math.max(STARTER_UNLOCK, bestStreak);
}

/** The highest unlocked weapon. */
export function defaultWeapon(bestStreak: number): WeaponDef {
  const unlocked = unlockedWeapons(bestStreak);
  return unlocked[unlocked.length - 1] ?? weaponById('pea');
}

/** Weapons that become available when bestStreak goes from `prevBest` to `nextBest`. */
export function newlyUnlocked(prevBest: number, nextBest: number): WeaponDef[] {
  const before = Math.max(STARTER_UNLOCK, prevBest);
  return unlockedWeapons(nextBest).filter((w) => w.unlockAt > before);
}

export interface NextUnlock {
  weapon: WeaponDef;
  /** Yes answers still needed: the current streak has to reach the unlock day. */
  daysToGo: number;
  /** 0..1 progress from the previous unlock tier, for the Home progress bar. */
  progress: number;
}

export function nextUnlock(bestStreak: number, streak: number): NextUnlock | null {
  const reach = Math.max(STARTER_UNLOCK, bestStreak);
  const weapon = WEAPONS.find((w) => w.unlockAt > reach);
  if (!weapon) return null;
  const prevTier = [...WEAPONS].reverse().find((w) => w.unlockAt <= reach)?.unlockAt ?? 0;
  const progress = (streak - prevTier) / (weapon.unlockAt - prevTier);
  return {
    weapon,
    daysToGo: weapon.unlockAt - streak,
    progress: Math.min(1, Math.max(0, progress)),
  };
}
