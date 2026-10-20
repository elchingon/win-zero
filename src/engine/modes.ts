// Game modes (SPEC 9). Win Zero Plus plays every round in the mode picked in Settings › Games;
// Win Zero, and the website, always play the Shooter. Each mode's seven power-up tiers line up
// with WEAPONS, so they unlock by the shared arsenal's reach, a Weapon credit lends one, and the
// round's damage numbers stay the weapons'. A mode is offered only once its round is built.
import { WEAPONS, type WeaponId } from './weapons';

export type ModeId = 'shooter' | 'catch' | 'orbit' | 'slice' | 'breaker';

export interface ModeDef {
  id: ModeId;
  name: string;
  /** The best streak that opens the mode. */
  unlockAt: number;
  /** Power-up names, one per WEAPONS tier, weakest first. */
  tiers: readonly string[];
}

/** The free game, and every app's fallback. */
export const DEFAULT_MODE: ModeId = 'shooter';
/** Every mode is open from the start (SPEC 9). */
export const MODE_UNLOCK_AT = 1;

const WEAPON_NAMES: readonly string[] = WEAPONS.map((w) => w.name);

export const MODES: readonly ModeDef[] = [
  { id: 'shooter', name: 'Shooter', unlockAt: MODE_UNLOCK_AT, tiers: WEAPON_NAMES },
  {
    id: 'catch',
    name: 'Catch',
    unlockAt: MODE_UNLOCK_AT,
    tiers: ['Cup', 'Twin Cups', 'Net', 'Magnet', 'Chain Catch', 'Vacuum Beam', 'Black Hole'],
  },
  { id: 'orbit', name: 'Orbit', unlockAt: MODE_UNLOCK_AT, tiers: WEAPON_NAMES },
  {
    id: 'slice',
    name: 'Slice',
    unlockAt: MODE_UNLOCK_AT,
    tiers: ['Blade', 'Twin Blade', 'Wide Arc', 'Explosive Cut', 'Arcing Cut', 'Lingering Blade', 'Nova'],
  },
  {
    id: 'breaker',
    name: 'Breaker',
    unlockAt: MODE_UNLOCK_AT,
    tiers: ['1 ball', '2 balls', 'Multi-ball', 'Fireball', 'Lightning Ball', 'Laser Paddle', 'Mega Ball'],
  },
];

export const MODE_IDS: readonly ModeId[] = MODES.map((m) => m.id);

/**
 * Modes whose round is built: its sim and drawing. Nothing else is offered, even in Plus. Each
 * mode joins as its round lands (M7). The sim reads this too, and plays anything else as the
 * Shooter.
 */
export const PLAYABLE_MODES: readonly ModeId[] = ['shooter', 'catch', 'orbit', 'slice'];

export interface ModeOptions {
  /** This app offers modes beyond the Shooter (Win Zero Plus). */
  modesEnabled: boolean;
}

export function isModeId(v: unknown): v is ModeId {
  return MODE_IDS.some((id) => id === v);
}

export function modeById(id: ModeId): ModeDef {
  const m = MODES.find((x) => x.id === id);
  if (!m) throw new RangeError(`Unknown mode: ${id}`);
  return m;
}

/** The modes a player can pick: just the Shooter in Win Zero; in Plus, every built mode open at `best`. */
export function availableModes(best: number, { modesEnabled }: ModeOptions): ModeDef[] {
  if (!modesEnabled) return [modeById(DEFAULT_MODE)];
  const reach = Math.max(MODE_UNLOCK_AT, best);
  return MODES.filter((m) => PLAYABLE_MODES.includes(m.id) && m.unlockAt <= reach);
}

/** The player's pick while it's available, otherwise the Shooter. */
export function equippedMode(pick: ModeId | null, best: number, opts: ModeOptions): ModeId {
  return pick && availableModes(best, opts).some((m) => m.id === pick) ? pick : DEFAULT_MODE;
}

/** What `mode` calls the power-up at `weapon`'s tier: "Net" for the Scatter Gun in Catch. */
export function modeTier(mode: ModeId, weapon: WeaponId): string {
  const tier = WEAPONS.findIndex((w) => w.id === weapon);
  return modeById(mode).tiers[tier] ?? WEAPONS[tier]?.name ?? weapon;
}
