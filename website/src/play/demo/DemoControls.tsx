// The demo controls, folded away like the prototype's and the phone app's development tools.
// Practice rounds work anywhere: they change nothing. Moving the clock and jumping to a day run in
// demo mode, on a copy of the progress (platform/mode.ts), so the real streak is never touched.
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { debugReadout, JUMP_DAYS, parseCount, PRACTICE_MAX_N } from '@/dev/demo';
import { SEED_MAX_N } from '@/dev/seedRun';
import { MS_PER_DAY, MS_PER_HOUR, pendingWindow } from '@/engine';

import { ROUTES } from '../nav';
import { enterDemo, leaveDemo } from '../platform/mode';
import { appStore, demoMode, storagePersistent, useApp } from '../store';
import { Eyebrow, Fine } from '../ui/bits';
import { Button, LinkButton } from '../ui/Button';

function PracticeRound() {
  const navigate = useNavigate();
  const [text, setText] = useState('60');
  const n = parseCount(text, PRACTICE_MAX_N);
  return (
    <>
      <Eyebrow>Practice round</Eyebrow>
      <Fine>Plays N zeros with every weapon and a frame meter. Nothing about your streak changes.</Fine>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (n) navigate(`${ROUTES.round}?practice=${n}`);
        }}
      >
        <input
          className="input small"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`1–${PRACTICE_MAX_N}`}
          aria-label="Zeros in the practice round"
        />
        <button type="submit" className="btn btn-primary small" disabled={!n}>
          Play
        </button>
      </form>
    </>
  );
}

function DemoTools() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const goal = useApp((s) => s.goal);
  const offset = useApp((s) => s.devClockOffsetMs);
  const [customDay, setCustomDay] = useState('');
  const store = appStore.getState();
  const now = store.now();
  const pending = goal ? pendingWindow(goal, now) : null;
  const custom = parseCount(customDay, SEED_MAX_N);

  // The answer leaves Home the round to open, so from Settings, go back to Home.
  const jump = (n: number) => {
    if (store.devJumpToDay(n)?.ok && pathname !== ROUTES.home) navigate(ROUTES.home);
  };

  return (
    <>
      <Eyebrow>Debug clock</Eyebrow>
      <Fine>
        Moving forward settles days as if that time had passed. Going back doesn&apos;t undo them; leave demo mode to
        start again from your real progress.
      </Fine>
      <div className="readout" role="status">
        {debugReadout(goal, now, store.timeZone(), offset).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <div className="button-row">
        <Button small variant="ghost" label="+1 hour" onPress={() => store.advanceDevClock(MS_PER_HOUR)} />
        <Button small variant="ghost" label="+1 day" onPress={() => store.advanceDevClock(MS_PER_DAY)} />
        <Button small variant="ghost" label="+7 days" onPress={() => store.advanceDevClock(7 * MS_PER_DAY)} />
        <Button
          small
          variant="ghost"
          label="Next check-in"
          hint="Moves the clock to when the next check-in opens"
          onPress={() => store.devSkipToNextCheckIn()}
          disabled={!goal || !!pending}
        />
        <Button small variant="ghost" label="Real time" onPress={() => store.resetDevClock()} disabled={offset === 0} />
      </div>

      <Eyebrow>Jump to day</Eyebrow>
      <Fine>Rebuilds the demo history as N−1 days of Yes, then checks in and starts the Day N round.</Fine>
      <div className="button-row">
        {JUMP_DAYS.map((n) => (
          <Button key={n} small variant="ghost" label={`Day ${n}`} onPress={() => jump(n)} disabled={!goal} />
        ))}
      </div>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (custom) jump(custom);
        }}
      >
        <input
          className="input small"
          inputMode="numeric"
          value={customDay}
          onChange={(e) => setCustomDay(e.target.value)}
          placeholder={`1–${SEED_MAX_N}`}
          aria-label="Day to jump to"
        />
        <button type="submit" className="btn btn-primary small" disabled={!goal || !custom}>
          Go
        </button>
      </form>

      <PracticeRound />

      <Button
        variant="ghost"
        label="Leave demo mode"
        hint="Back to your real progress"
        onPress={() => {
          leaveDemo();
          window.location.assign('/play');
        }}
      />
    </>
  );
}

function StartDemo() {
  const [failed, setFailed] = useState(false);
  return (
    <>
      <Eyebrow>Demo mode</Eyebrow>
      <Fine>
        Move the clock, jump to any day to try later weapons and armored zeros, and see how missed days and slips play
        out. Demo mode works on a copy of your progress, so your real streak isn&apos;t touched.
      </Fine>
      <Button
        small
        label="Start demo mode"
        disabled={!storagePersistent}
        onPress={() => {
          if (enterDemo()) window.location.assign('/play');
          else setFailed(true);
        }}
      />
      {!storagePersistent || failed ? (
        <Fine>Demo mode needs this browser to keep site data, which it isn&apos;t doing right now.</Fine>
      ) : null}
      <PracticeRound />
    </>
  );
}

export function DemoControls() {
  const [open, setOpen] = useState(demoMode);
  return (
    <div className="demo">
      <LinkButton label={open ? 'Hide demo controls' : 'Demo controls'} onPress={() => setOpen(!open)} />
      {open ? <div className="demo-box">{demoMode ? <DemoTools /> : <StartDemo />}</div> : null}
    </div>
  );
}
