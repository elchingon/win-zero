// Settings: goal wording, check-in time (through the engine, so an open window is respected),
// sound, how it works, support, about (privacy policy, help, email), erase, and the demo controls.
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { currentCheckInTime, firstUpcomingDay, opensAt, pendingWindow } from '@/engine';
import { primaryGoal } from '@/store/select';
import { formatUntil, formatWhen } from '@/lib/format';
import { GOAL_MAX_LENGTH } from '@/ui/copy/rules';
import { SUPPORT_EMAIL, SUPPORT_LINE } from '@/ui/copy/support';

import { DemoControls } from '../demo/DemoControls';
import { ROUTES } from '../nav';
import { announce } from '../platform/announce';
import { deviceCalendar } from '../platform/calendar';
import { appStore, useApp } from '../store';
import { Card, Eyebrow, Field, Fine, LinkRow, ToggleRow } from '../ui/bits';
import { Button, TextLink } from '../ui/Button';
import { Screen } from '../ui/Screen';
import { TimeField } from '../ui/TimeField';
import { TopBar } from '../ui/TopBar';

const KEPT_HINT = 'Your streak and history stay the same.';
const SAVED_HINT = `Saved. ${KEPT_HINT}`;

export function Settings() {
  const navigate = useNavigate();
  const goal = useApp(primaryGoal);
  const prefs = useApp((s) => s.prefs);
  useApp((s) => s.devClockOffsetMs); // the "next check-in" line follows the debug clock
  const { h24 } = deviceCalendar();
  const [draft, setDraft] = useState(goal?.goal ?? '');
  const [saved, setSaved] = useState(false);
  const [eraseArmed, setEraseArmed] = useState(false);

  if (!goal) return <Navigate to={ROUTES.home} replace />;

  const store = appStore.getState();
  const now = store.now();
  const tz = store.timeZone();
  const pending = pendingWindow(goal, now);
  const upcoming = opensAt(goal, firstUpcomingDay(goal, now));
  const goalChanged = draft.trim() !== goal.goal && draft.trim().length > 0;

  const saveGoal = () => {
    if (store.setGoalText(goal.goalId, draft).ok) {
      setDraft(draft.trim());
      setSaved(true);
      // Save goal goes away once saved, so say so.
      announce(SAVED_HINT);
    }
  };

  const erase = () => {
    store.erase();
    navigate(ROUTES.home, { replace: true });
  };

  return (
    <Screen>
      <TopBar right={<TextLink label="Done" to={ROUTES.home} />} />
      <h1 className="h2">Settings</h1>

      <form
        className="section"
        onSubmit={(e) => {
          e.preventDefault();
          if (goalChanged) saveGoal();
        }}
      >
        <Field label="Daily goal" hint={saved ? SAVED_HINT : KEPT_HINT}>
          {(id, describedBy) => (
            <input
              id={id}
              className="input"
              value={draft}
              maxLength={GOAL_MAX_LENGTH}
              aria-describedby={describedBy}
              autoComplete="off"
              enterKeyHint="done"
              onChange={(e) => {
                setDraft(e.target.value);
                setSaved(false);
              }}
            />
          )}
        </Field>
        {goalChanged ? (
          <button type="submit" className="btn btn-primary small start">
            Save goal
          </button>
        ) : null}
      </form>

      <div className="section">
        <TimeField
          label="Check-in time"
          value={currentCheckInTime(goal)}
          onChange={(t) => store.setCheckInTime(goal.goalId, t)}
          hint={`${pending ? `A check-in is open until ${formatUntil(pending.closesAt, now, tz, h24)}. ` : ''}Next check-in: ${formatWhen(upcoming, now, tz, h24)}.`}
        />
      </div>

      <div className="list">
        <ToggleRow label="Sound" detail="A chime for each Yes, and pops and booms in the round." value={prefs.sound} onChange={(v) => store.setPref('sound', v)} />
        <LinkRow label="How it works" detail="The slide, shields, missed days and rewards." action="Read" to={ROUTES.howItWorks} />
        <LinkRow
          label="Need support?"
          detail={`${SUPPORT_LINE.name}: ${SUPPORT_LINE.display}. ${SUPPORT_LINE.detail}`}
          action="Call"
          href={SUPPORT_LINE.tel}
          hint="Calls the helpline"
        />
      </div>

      <section className="section" aria-labelledby="about-title">
        <Eyebrow header>
          <span id="about-title">About</span>
        </Eyebrow>
        <div className="list">
          <LinkRow label="Privacy policy" detail="Your goal and history stay in this browser." action="Open" href="/privacy" />
          <LinkRow label="Help and support" detail="How Win Zero works, and fixes for common questions." action="Open" href="/support" />
          <LinkRow
            label="Email us"
            detail={SUPPORT_EMAIL}
            action="Email"
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Win Zero on the web')}`}
          />
        </div>
        <Fine>Win Zero on the web · © 2026 E7 Systems</Fine>
      </section>

      {eraseArmed ? (
        <Card tone="flare" className="erase">
          <p className="question">Erase everything?</p>
          <Fine>This deletes your goal, streak, history and rewards from this browser. It can&apos;t be undone.</Fine>
          <div className="pair">
            <Button variant="danger" label="Erase everything" onPress={erase} />
            <Button variant="ghost" label="Keep my data" onPress={() => setEraseArmed(false)} />
          </div>
        </Card>
      ) : (
        <button type="button" className="link-btn tone-flare" onClick={() => setEraseArmed(true)}>
          Erase all data
        </button>
      )}

      <DemoControls />
    </Screen>
  );
}
