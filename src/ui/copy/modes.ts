// The round's words per game mode (SPEC 9): the hint as a round starts, and what the HUD calls
// the power-up it switches between. The power-ups' own names come from the engine (MODES).
// Shared by the app and the website.
import { modeTier, type ModeId, type WeaponDef } from '@/engine';

export interface ModeCopy {
  /** Shown over the board as the round starts, then fades. */
  hint: string;
  /** What the switch button calls the power-up: "Weapon: Rocket". */
  tier: string;
  /** Read out on the switch button. */
  switchHint: string;
}

export const MODE_COPY: Record<ModeId, ModeCopy> = {
  shooter: { hint: 'Hold anywhere to fire', tier: 'Weapon', switchHint: 'Switches to your next weapon' },
  catch: { hint: 'Slide anywhere to catch the zeros', tier: 'Catcher', switchHint: 'Switches to your next catcher' },
  orbit: { hint: 'Hold anywhere to fire all round', tier: 'Weapon', switchHint: 'Switches to your next weapon' },
  slice: { hint: 'Swipe across the zeros to slice them', tier: 'Power-up', switchHint: 'Switches to your next power-up' },
  breaker: { hint: 'Slide anywhere to move the paddle', tier: 'Power-up', switchHint: 'Switches to your next power-up' },
};

export interface PowerUp {
  /** What the mode calls it: 'Twin Cups' for the Twin Barrel's tier in Catch. */
  name: string;
  /** The weapon's description, where the mode's power-up is the weapon itself (the Shooter, Orbit). */
  description: string | null;
  /** The word for one: 'weapon', 'catcher' or 'power-up'. */
  kind: string;
}

/** `weapon`'s tier in `mode`, in words. In the Shooter, the weapon itself. */
export function powerUp(mode: ModeId, weapon: WeaponDef): PowerUp {
  const name = modeTier(mode, weapon.id);
  return {
    name,
    description: name === weapon.name ? weapon.description : null,
    kind: MODE_COPY[mode].tier.toLowerCase(),
  };
}
