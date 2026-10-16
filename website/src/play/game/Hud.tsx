// The round's heads-up display, as in the app and the prototype's #hud: zeros left and the day at
// the top left, sound and leave at the top right, the weapon switch and the bomb along the bottom,
// and a hint that fades once play starts. Only its buttons take presses; anywhere else aims and
// fires. Finish round stays hidden until it gets keyboard focus.
import type { ReactNode } from 'react';

export function Hud(props: {
  left: number;
  total: number;
  /** "DAY 30", "BONUS" or "PRACTICE". */
  label: string;
  weaponName: string;
  canSwitch: boolean;
  onSwitchWeapon: () => void;
  bombs: number;
  bombEnabled: boolean;
  onBomb: () => void;
  sound: boolean;
  onToggleSound: () => void;
  onQuit: () => void;
  /** Weapon, bomb and finish buttons; hidden once the round is won. */
  controls: boolean;
  /** Changes when a round starts, to show the hint again. */
  hintKey: number;
  onFinish: () => void;
  /** The practice round's frame meter, under the counter. */
  extra?: ReactNode;
}) {
  const p = props;
  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-count">
          <p className="hud-numbers" aria-label={`${p.left} of ${p.total} zeros left`}>
            <span className="hud-left">{p.left.toLocaleString('en-US')}</span>
            <span className="hud-total">/ {p.total.toLocaleString('en-US')} LEFT</span>
          </p>
          <p className="eyebrow hud-day">{p.label}</p>
          {p.extra}
        </div>
        <div className="hud-buttons">
          <button type="button" className="hud-btn" role="switch" aria-checked={p.sound} aria-label="Sound" onClick={p.onToggleSound}>
            {p.sound ? 'SOUND ON' : 'SOUND OFF'}
          </button>
          <button type="button" className="hud-btn quit" aria-label="Leave the round" title="Back to base" onClick={p.onQuit}>
            ✕
          </button>
        </div>
      </div>

      <p key={p.hintKey} className="hud-hint" aria-hidden="true">
        Hold anywhere to fire
      </p>

      {p.controls ? (
        <div className="hud-bottom">
          <button
            type="button"
            className="hud-btn weapon"
            aria-label={`Weapon: ${p.weaponName}${p.canSwitch ? '. Switches to your next weapon' : ''}`}
            disabled={!p.canSwitch}
            onClick={p.onSwitchWeapon}
          >
            <span className="weapon-small">{p.canSwitch ? 'WEAPON · TAP TO SWITCH' : 'WEAPON'}</span>
            <span className="weapon-current">{p.weaponName}</span>
          </button>
          <button type="button" className="hud-btn finish" onClick={p.onFinish}>
            FINISH ROUND
          </button>
          <button
            type="button"
            className="hud-btn bomb"
            aria-label={`Bomb, ${p.bombs} left. Blasts every zero near the middle`}
            disabled={!p.bombEnabled}
            onClick={p.onBomb}
          >
            <span className="bomb-dot" aria-hidden="true" />
            <span className="bomb-count">{p.bombs}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
