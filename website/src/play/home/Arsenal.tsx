// Weapons by unlock day with progress to the next one (the prototype's .arsenal list).
// Choosing an unlocked weapon equips it; a new unlock equips itself.
import { arsenal, equippedWeapon, nextUnlock, type GoalState, type WeaponId } from '@/engine';
import { plural } from '@/lib/format';

import { Eyebrow, Fine } from '../ui/bits';

export function Arsenal(props: { goal: GoalState; pick: WeaponId | null; onEquip: (id: WeaponId) => void }) {
  const { goal, pick, onEquip } = props;
  const next = nextUnlock(goal.bestStreak, goal.streak);
  const equipped = equippedWeapon(pick, goal.bestStreak);
  const progress = next ? next.progress : 1;
  const percent = Math.round(progress * 100);
  return (
    <section className="section" aria-labelledby="arsenal-title">
      <div className="section-head">
        <Eyebrow header>
          <span id="arsenal-title">Arsenal</span>
        </Eyebrow>
        <Fine>{next ? `${next.weapon.name} in ${plural(next.daysToGo, 'day')}` : 'Fully armed'}</Fine>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label={next ? `Next weapon: ${next.weapon.name}` : 'Every weapon unlocked'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={next ? `${plural(next.daysToGo, 'day')} to go` : 'Fully armed'}
      >
        <span className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <ul className="list arsenal">
        {arsenal(goal.bestStreak, goal.streak).map(({ weapon, unlocked, daysToGo }) => {
          const isEquipped = weapon.id === equipped.id;
          const status = isEquipped ? 'EQUIPPED' : unlocked ? 'READY' : `${daysToGo}D TO GO`;
          return (
            <li key={weapon.id}>
              <button
                type="button"
                className={`weapon-row${unlocked ? '' : ' locked'}`}
                aria-disabled={!unlocked}
                aria-pressed={isEquipped}
                aria-label={`${weapon.name}. ${weapon.description} ${
                  isEquipped ? 'Equipped.' : unlocked ? 'Ready. Equips it for your rounds.' : `Unlocks in ${plural(daysToGo, 'day')}.`
                }`}
                onClick={() => {
                  if (unlocked && !isEquipped) onEquip(weapon.id);
                }}
              >
                <span className={`weapon-day${unlocked ? ' on' : ''}`}>DAY {weapon.unlockAt}</span>
                <span className="weapon-text">
                  <span className="weapon-name">{weapon.name}</span>
                  <span className="weapon-desc">{weapon.description}</span>
                </span>
                <span className={`weapon-status${isEquipped ? ' equipped' : ''}`}>{status}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
