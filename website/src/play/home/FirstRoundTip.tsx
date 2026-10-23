// Home's tip after the first Yes's round, as on the app: a word for starting, how the app works,
// and when the next check-in comes. Shown once. The round takes Home's place, so Home opens it on
// the way back.
import { useId } from 'react';

import { nextWindow } from '@/engine';
import { formatWhen } from '@/lib/format';
import { firstRoundTipSlot } from '@/store/select';
import { firstRoundTip } from '@/ui/copy/tips';

import { deviceCalendar } from '../platform/calendar';
import { appStore, useApp } from '../store';
import { Button } from '../ui/Button';
import { Popup } from '../ui/Popup';

const close = () => appStore.getState().seeTip('first-round');

export function FirstRoundTip() {
  const slot = useApp(firstRoundTipSlot);
  const title = useId();
  if (!slot?.round) return null;

  const store = appStore.getState();
  const tip = firstRoundTip({
    next: slot.round.n + 1,
    nextWhen: formatWhen(nextWindow(slot.goal).opensAt, store.now(), store.timeZone(), deviceCalendar().h24),
    earnedCredit: slot.round.rewards.credits.some((g) => g.kind === 'game'),
  });
  return (
    <Popup onDismiss={close} labelledBy={title} fixed>
      <h2 id={title} className="popup-title">
        {tip.title}
      </h2>
      <div className="hint-body">
        {tip.lines.map((line) => (
          <p key={line} className="hint-line">
            {line}
          </p>
        ))}
      </div>
      <Button label={tip.button} onPress={close} />
    </Popup>
  );
}
