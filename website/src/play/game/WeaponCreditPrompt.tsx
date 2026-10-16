// Before a round: use a Weapon credit? Each weapon not yet unlocked, to borrow for this round and
// its replays, laid out like Home's arsenal, and Not this time. Escape or a click outside the card
// is Not this time too, and the keyboard starts there, so Enter never spends a credit by surprise.
import type { WeaponDef, WeaponId } from '@/engine';
import { WEAPON_PROMPT } from '@/ui/copy/credits';

import { Popup } from '../ui/Popup';

export function WeaponCreditPrompt(props: {
  offer: WeaponDef[];
  /** Weapon credits held. */
  credits: number;
  onPick: (id: WeaponId) => void;
  onSkip: () => void;
}) {
  const { offer, credits, onPick, onSkip } = props;
  return (
    <Popup onDismiss={onSkip} labelledBy="weapon-credit-title">
      <h2 id="weapon-credit-title" className="popup-title">
        {WEAPON_PROMPT.title}
      </h2>
      <p className="popup-body">{WEAPON_PROMPT.body(credits)}</p>
      <ul className="list popup-list">
        {offer.map((w) => (
          <li key={w.id}>
            <button
              type="button"
              className="weapon-row"
              aria-label={WEAPON_PROMPT.option(w)}
              title={WEAPON_PROMPT.optionHint}
              onClick={() => onPick(w.id)}
            >
              <span className="weapon-day lend">DAY {w.unlockAt}</span>
              <span className="weapon-text">
                <span className="weapon-name">{w.name}</span>
                <span className="weapon-desc">{w.description}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-ghost" data-autofocus onClick={onSkip}>
        {WEAPON_PROMPT.skip}
      </button>
    </Popup>
  );
}
