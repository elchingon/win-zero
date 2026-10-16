// The check-in, styled like the notification the phone app sends (the prototype's .notif card).
import { isWindowToday, type CheckInWindow, type GoalState, type TimeZone } from '@/engine';
import { formatInstantTime, formatUntil } from '@/lib/format';
import { checkInStakes, stakesHint, stakesLine } from '@/ui/home/stakes';

export function CheckInCard(props: {
  goal: GoalState;
  window: CheckInWindow;
  now: Date;
  tz: TimeZone;
  h24: boolean;
  onYes: () => void;
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
        <button type="button" className="btn btn-primary yes" onClick={onYes} aria-describedby="stakes-yes">
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
