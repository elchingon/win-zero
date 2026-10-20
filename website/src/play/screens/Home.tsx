// Home: the goal, the numbers, today's check-in (or when the next one comes), credits and the
// bonus round, the arsenal, the history calendar, and the demo controls, folded away.
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { dayKeyAt, nextWindow, openedAtSetup, pendingWindow, type GoalState } from '@/engine';
import { primaryGoal, primaryRound } from '@/store/select';
import { formatWhen } from '@/lib/format';
import { REJECTED } from '@/ui/copy/rules';
import { startHomeRouting } from '@/ui/home/routing';

import { yesCelebration } from '../celebrate';
import { DemoControls } from '../demo/DemoControls';
import { Arsenal } from '../home/Arsenal';
import { CheckInCard } from '../home/CheckInCard';
import { CreditsCard } from '../home/CreditsCard';
import { HistoryCalendar } from '../home/HistoryCalendar';
import { Stats } from '../home/Stats';
import { BONUS_ROUND, pathForAnswer, roundFor, ROUTES } from '../nav';
import { announce } from '../platform/announce';
import { loadSounds, resumeAudio } from '../platform/audio';
import { deviceCalendar } from '../platform/calendar';
import { appStore, useApp } from '../store';
import { Card, Eyebrow, Fine, Lede } from '../ui/bits';
import { ButtonLink, TextLink } from '../ui/Button';
import { Screen } from '../ui/Screen';
import { TopBar } from '../ui/TopBar';

/** Re-check at least this often, in case the device clock jumps. */
const MAX_TIMER_MS = 60 * 60 * 1000;
/** Fire just after a window boundary, not on it. */
const BOUNDARY_SLACK_MS = 500;

export function Home() {
  const goal = useApp(primaryGoal);
  if (!goal) return <Navigate to={ROUTES.setup} replace />;
  return <HomeScreen goal={goal} />;
}

function HomeScreen({ goal }: { goal: GoalState }) {
  const navigate = useNavigate();
  const round = useApp(primaryRound);
  const pick = useApp((s) => s.weapon);
  const selectWeapon = useApp((s) => s.selectWeapon);
  const credits = useApp((s) => s.credits);
  const bonus = useApp((s) => s.bonus);
  const rejection = useApp((s) => s.rejection);
  const clockOffset = useApp((s) => s.devClockOffsetMs); // re-render when the debug clock moves
  const { h24, firstWeekday } = deviceCalendar();
  const [tick, setTick] = useState(0);

  const store = appStore.getState();
  const now = store.now();
  const tz = store.timeZone();
  const today = dayKeyAt(now, tz);
  const pending = pendingWindow(goal, now);
  const next = nextWindow(goal);
  const boundary = (pending ? pending.closesAt : next.opensAt).getTime();

  // Show the card the moment a window opens, and settle it the moment it closes.
  useEffect(() => {
    const wait = Math.max(0, boundary - appStore.getState().now().getTime()) + BOUNDARY_SLACK_MS;
    const id = window.setTimeout(() => {
      appStore.getState().refresh();
      setTick((t) => t + 1);
    }, Math.min(MAX_TIMER_MS, wait));
    return () => window.clearTimeout(id);
  }, [boundary, tick, clockOffset]);

  // An answer leaves a screen to open: the round for Yes, the notice for Not today. Otherwise,
  // whenever days settle while Home is showing, show any Slipping / Reset / Shielded news once. A
  // Yes clicked here holds its round back while the celebration covers the screen.
  useEffect(
    () =>
      startHomeRouting(appStore, (route) => {
        const open = () => navigate(pathForAnswer(route));
        const hold = route.path === '/play' ? yesCelebration.begin() : 0;
        if (hold > 0) window.setTimeout(open, hold);
        else open();
      }),
    [navigate],
  );

  // The Yes chime loads on the first press, which also lets the browser start audio.
  useEffect(() => {
    const warm = () => {
      void loadSounds();
      void resumeAudio();
    };
    window.addEventListener('pointerdown', warm, { capture: true, once: true });
    window.addEventListener('keydown', warm, { capture: true, once: true });
    return () => {
      window.removeEventListener('pointerdown', warm, { capture: true });
      window.removeEventListener('keydown', warm, { capture: true });
    };
  }, []);

  const banner = rejection ? REJECTED[rejection.reason] : null;
  useEffect(() => {
    if (banner) announce(banner);
  }, [banner]);

  const startBonus = (n: number) => {
    if (appStore.getState().startBonusRound(n)) navigate(BONUS_ROUND);
  };

  const unplayed = round && !round.played ? round : null;
  // Set up after check-in time: until the first answer, say plainly that this question is about today.
  const firstToday = goal.history.length === 0 && pending?.day === goal.firstDay && openedAtSetup(goal);
  const nextWhen = formatWhen(next.opensAt, now, tz, h24);

  return (
    <Screen>
      <TopBar right={<TextLink label="Settings" to={ROUTES.settings} />} />

      <div className="goal">
        <Eyebrow header>Daily goal</Eyebrow>
        <p className="goal-text">{goal.goal}</p>
      </div>

      <Stats goal={goal} today={today} />

      {banner ? (
        <Card tone="flare">
          <p className="banner-text">{banner}</p>
        </Card>
      ) : null}

      {unplayed ? (
        <Card>
          <p className="card-title">Your Day {unplayed.n} round is ready.</p>
          <Lede>Your rewards are already banked. Play it whenever you like.</Lede>
          <ButtonLink label="Play now" to={roundFor(goal.goalId)} />
        </Card>
      ) : null}

      {pending ? (
        <>
          {firstToday ? <Lede>Today counts: your first check-in is open now.</Lede> : null}
          <CheckInCard
            key={pending.day}
            goal={goal}
            window={pending}
            now={now}
            tz={tz}
            h24={h24}
            onYes={(at) => yesCelebration.armed(at, () => appStore.getState().answer(goal.goalId, 'yes'))}
            onNotToday={() => appStore.getState().answer(goal.goalId, 'not-today')}
          />
        </>
      ) : goal.history.length === 0 ? (
        <Card>
          <p className="card-title">You&apos;re all set.</p>
          <Lede>Your first check-in is {nextWhen}. Come back then: the website can&apos;t send reminders.</Lede>
        </Card>
      ) : (
        <Card>
          <p className="card-title">
            {goal.history.at(-1)?.result === 'yes' ? "You've checked in." : 'Thanks for checking in.'}
          </p>
          <Lede>Your next check-in is {nextWhen}.</Lede>
        </Card>
      )}

      {goal.paused ? <Fine>It&apos;s been a while. Check in whenever you&apos;re ready.</Fine> : null}

      <CreditsCard
        goal={goal}
        credits={credits}
        bonus={bonus}
        onStartBonus={startBonus}
        onPlayBonus={() => navigate(BONUS_ROUND)}
      />

      <Arsenal goal={goal} pick={pick} onEquip={selectWeapon} />

      <HistoryCalendar goal={goal} today={today} pendingDay={pending?.day ?? null} firstWeekday={firstWeekday} />

      <DemoControls />
    </Screen>
  );
}
