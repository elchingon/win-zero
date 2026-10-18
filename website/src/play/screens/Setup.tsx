// Onboarding: the goal and the check-in time. The website can't send reminders, so there's no
// reminder step: the morning reminder time keeps its default, ready for the phone app.
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { DEFAULT_CHECK_IN_TIME, DEFAULT_MORNING_TIME, firstCheckInOpenAt } from '@/engine';
import { formatClockTime } from '@/lib/format';
import { GOAL_MAX_LENGTH, RULES, SUGGESTIONS } from '@/ui/copy/rules';

import { ROUTES } from '../nav';
import { deviceCalendar } from '../platform/calendar';
import { askToKeepStorage } from '../platform/storage';
import { appStore, useApp } from '../store';
import { Chip, Em, Field, Fine, Lede } from '../ui/bits';
import { Screen } from '../ui/Screen';
import { TimeField } from '../ui/TimeField';
import { TopBar } from '../ui/TopBar';

export function Setup() {
  const navigate = useNavigate();
  const hasGoal = useApp((s) => s.goals.length > 0);
  const { h24 } = deviceCalendar();
  const [goal, setGoal] = useState('');
  const [checkInTime, setCheckInTime] = useState(DEFAULT_CHECK_IN_TIME);
  const [busy, setBusy] = useState(false);

  if (hasGoal && !busy) return <Navigate to={ROUTES.home} replace />;

  const goalOk = goal.trim().length > 0;
  const store = appStore.getState();
  // Past check-in time already: the first question is about today, straight away.
  const todayCounts = firstCheckInOpenAt({ checkInTime, now: store.now(), tz: store.timeZone() });

  const start = () => {
    setBusy(true);
    const r = appStore.getState().addGoal({ goal, checkInTime, morningTime: DEFAULT_MORNING_TIME });
    if (r.ok) {
      askToKeepStorage();
      navigate(ROUTES.home, { replace: true });
    } else {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar />
      <h1 className="h1">
        Every day you win, there&apos;s <Em>one more zero</Em> to shoot.
      </h1>
      <ul className="rules">
        {RULES.map((r) => (
          <li key={r.mark}>
            <span className={`rule-mark${r.tone ? ` tone-${r.tone}` : ''}`} aria-hidden="true">
              {r.mark}
            </span>
            <span className="body">{r.text}</span>
          </li>
        ))}
      </ul>

      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (goalOk && !busy) start();
        }}
      >
        <Field label="Your daily goal">
          {(id) => (
            <>
              <input
                id={id}
                className="input"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Something you'll do, or stop doing"
                maxLength={GOAL_MAX_LENGTH}
                autoCapitalize="sentences"
                autoComplete="off"
                enterKeyHint="done"
              />
              <div className="chips" role="group" aria-label="Suggestions">
                {SUGGESTIONS.map((s) => (
                  <Chip key={s} label={s} selected={goal.trim() === s} onPress={() => setGoal(s)} />
                ))}
              </div>
            </>
          )}
        </Field>
        <TimeField
          label="Check-in time"
          value={checkInTime}
          onChange={setCheckInTime}
          hint="An evening time works best, once your day is done."
        />
        {todayCounts ? (
          <Lede>
            It&apos;s already past {formatClockTime(checkInTime, h24)}, so today counts. Your first check-in opens as soon
            as you start, and you can answer it until midnight tomorrow.
          </Lede>
        ) : null}
        <Fine>
          Your goal and progress stay in this browser; nothing is sent anywhere. The website can&apos;t send reminders,
          so come back at your check-in time.
        </Fine>
        <button type="submit" className="btn btn-primary" disabled={!goalOk || busy}>
          Start my streak
        </button>
      </form>
    </Screen>
  );
}
