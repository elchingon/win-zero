// Home's celebrations after a milestone's round, as on the app: a quote, congratulations, what the
// round earned in its own panels, and a push to keep going. Each shows once. The round takes Home's
// place, so Home opens it on the way back, with the Yes celebration's chime.
import { useEffect, useId } from 'react';

import { celebrationFor } from '@/engine';
import { arsenalBestOf, celebrationSlot, gameModeOf } from '@/store/select';
import { CELEBRATION_MARK_BOX, CELEBRATION_MARKS } from '@/theme/tokens';
import { celebrationCopy } from '@/ui/copy/celebrations';

import { yesCelebration } from '../celebrate';
import { appStore, useApp } from '../store';
import { Button } from '../ui/Button';
import { Popup } from '../ui/Popup';

export function Celebrations() {
  const slot = useApp(celebrationSlot);
  const best = useApp(arsenalBestOf);
  const gameMode = useApp(gameModeOf);
  const title = useId();

  const celebration = slot?.round ? celebrationFor(slot.round) : null;
  const id = celebration?.id ?? null;

  useEffect(() => {
    if (id) yesCelebration.cue();
  }, [id]);

  if (!slot?.round || !celebration || !id) return null;

  const close = () => appStore.getState().seeTip(id);
  const tip = celebrationCopy(celebration, { round: slot.round, goal: slot.goal, best, gameMode, icons: false });
  return (
    <Popup onDismiss={close} labelledBy={title} fixed>
      <h2 id={title} className="popup-title">
        {tip.title}
      </h2>
      <div className="hint-body">
        <p className="celebration-quote">{tip.quote}</p>
        {tip.lines.map((line) => (
          <p key={line} className="hint-line">
            {line}
          </p>
        ))}
        {tip.highlights.map((highlight) => (
          <div key={highlight.title} className="celebration-panel">
            <h3 className="celebration-panel-title">
              <svg viewBox={`0 0 ${CELEBRATION_MARK_BOX} ${CELEBRATION_MARK_BOX}`} aria-hidden="true">
                <path d={CELEBRATION_MARKS[highlight.kind]} />
              </svg>
              {highlight.title}
            </h3>
            {highlight.lines.map((line) => (
              <p key={line} className="hint-line">
                {line}
              </p>
            ))}
          </div>
        ))}
        <p className="hint-line">{tip.closing}</p>
      </div>
      <Button label={tip.button} onPress={close} />
    </Popup>
  );
}
