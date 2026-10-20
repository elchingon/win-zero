// The check-in, styled like the notification the phone app sends (the prototype's .notif card).
import type { MouseEvent } from 'react';

import { isWindowToday, type CheckInWindow, type GoalState, type TimeZone } from '@/engine';
import type { Point } from '@/game/yes';
import { formatInstantTime, formatUntil } from '@/lib/format';
import { checkInStakes, stakesHint, stakesLine } from '@/ui/home/stakes';

export function CheckInCard(props: {
  goal: GoalState;
  window: CheckInWindow;
  now: Date;
  tz: TimeZone;
  h24: boolean;
  /** `at`: where Yes was clicked, for the celebration to start from. */
  onYes: (at: Point) => void;
  onNotToday: () => void;
}) {
  const { goal, window, now, tz, h24, onYes, onNotToday } = props;
  const when = isWindowToday(window, now) ? 'today' : 'yesterday';
  const stakes = checkInStakes(goal);
  return (
    <section className="checkin" aria-labelledby="checkin-question">
      <div className="checkin-head" aria-hidden="true">
        <span className="app-icon">
          <span />
        </span>
        <span>WIN ZERO</span>
        <span className="when">{formatInstantTime(window.opensAt, tz, h24)}</span>
      </div>
      <h2 id="checkin-question" className="question">
        Did you stick to “{goal.goal}” {when}?
      </h2>
      <div className="checkin-lines">
        <p className="stakes">{stakesLine(stakes)}</p>
        <p className="until">Open until {formatUntil(window.closesAt, now, tz, h24)}.</p>
      </div>
      <div className="checkin-actions">
        <button type="button" className="btn btn-primary yes" onClick={(e) => onYes(clickPoint(e))} aria-describedby="stakes-yes">
          Yes, I did
        </button>
        <button type="button" className="btn btn-ghost no" onClick={onNotToday} aria-describedby={stakes.notToday ? 'stakes-no' : undefined}>
          Not today
        </button>
        <span id="stakes-yes" className="sr-only">
          {stakesHint(stakes.yes)}
        </span>
        {stakes.notToday ? (
          <span id="stakes-no" className="sr-only">
            {stakesHint(stakes.notToday)}
          </span>
        ) : null}
      </div>
    </section>
  );
}

/** Where a click landed; for a keyboard's Enter or Space (no pointer), the button's middle. */
function clickPoint(e: MouseEvent<HTMLElement>): Point {
  if (e.detail > 0) return { x: e.clientX, y: e.clientY };
  const r = e.currentTarget.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
