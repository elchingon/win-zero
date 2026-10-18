// The shooting round: the canvas filling the screen, the HUD over it, and once the round is won,
// a line of encouragement and then the result sheet over the fill. A real round is the one the
// latest Yes earned (its rewards are already banked); Replay plays it again in place, with no
// effect on the streak. ?round=bonus plays the bonus round a Game credit paid for, which changes
// nothing either. Before a round not yet played, a player holding a Weapon credit is asked
// whether to borrow a weapon they haven't unlocked for it. In demo mode, ?practice=N plays any N
// with every weapon and a frame meter (the demo controls offer it), changing nothing.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Navigate, useSearchParams } from 'react-router';

import { parseCount, PRACTICE_BEST, PRACTICE_BOMBS, PRACTICE_MAX_N } from '@/dev/demo';
import { composeRound, equippedWeapon, fillPlan, roundWeapons, weaponCreditOffer, type WeaponId } from '@/engine';
import { makeCues } from '@/game/cues';
import { hudLabel, replayMode, roundOverlay, type ResultMode } from '@/game/result';
import type { Report } from '@/game/sim/types';
import { arsenalBestOf, primarySlot, slotById, totalBombs } from '@/store/select';
import type { CreditRound, RoundRecord } from '@/store/types';

import { CheerPopup } from '../game/CheerPopup';
import { GameCanvas, type FrameStats, type GameHandle, type RoundSetup } from '../game/GameCanvas';
import { Hud } from '../game/Hud';
import { ResultSheet } from '../game/ResultSheet';
import { WeaponCreditPrompt } from '../game/WeaponCreditPrompt';
import { ROUTES, useGoHome } from '../nav';
import { announce } from '../platform/announce';
import { loadSounds, playSound, resumeAudio, type Sound } from '../platform/audio';
import { useReduceMotion } from '../platform/motion';
import { appStore, demoMode, useApp } from '../store';

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

const NONE_BORROWED: WeaponId[] = [];

export function Round() {
  const [params] = useSearchParams();
  // Outside demo mode, a round of any size is a bonus round, paid for with a Game credit.
  const practice = demoMode ? parseCount(params.get('practice') ?? '', PRACTICE_MAX_N) : null;
  if (practice) {
    return <Play initialMode="practice" goalId={null} n={practice} best={PRACTICE_BEST} record={null} borrowed={NONE_BORROWED} />;
  }
  return params.get('round') === 'bonus' ? <BonusStoreRound /> : <StoreRound />;
}

function StoreRound() {
  // Read once: if a day settles mid-round, the round on screen stays put.
  const [slot] = useState(() => primarySlot(appStore.getState()));
  const best = useApp(arsenalBestOf);
  const record = slot?.round;
  if (!slot || !record) return <Navigate to={ROUTES.home} replace />;
  const goalId = slot.goal.goalId;
  // Home only offers rounds not yet played; one that was is a replay.
  return (
    <WeaponCreditGate target={{ round: 'daily', goalId }} fresh={!record.played} best={best} borrowed={record.borrowed}>
      {(borrowed) => (
        <Play
          initialMode={record.played ? 'replay' : 'real'}
          goalId={goalId}
          n={record.n}
          best={best}
          record={record}
          borrowed={borrowed}
        />
      )}
    </WeaponCreditGate>
  );
}

const BONUS: CreditRound = { round: 'bonus' };

function BonusStoreRound() {
  const [bonus] = useState(() => appStore.getState().bonus);
  const best = useApp(arsenalBestOf);
  const hasGoal = useApp((s) => s.goals.length > 0);
  if (!bonus || !hasGoal) return <Navigate to={ROUTES.home} replace />;
  return (
    <WeaponCreditGate target={BONUS} fresh={!bonus.played} best={best} borrowed={bonus.borrowed}>
      {(borrowed) => <Play initialMode="bonus" goalId={null} n={bonus.n} best={best} record={null} borrowed={borrowed} />}
    </WeaponCreditGate>
  );
}

/**
 * Before a round not yet played: while a Weapon credit could lend it a weapon, ask, then start the
 * round with what it borrowed. A borrow is saved on the round, so coming back to it doesn't ask
 * again; Not this time holds until the player leaves.
 */
function WeaponCreditGate(props: {
  target: CreditRound;
  /** The round hasn't been played yet. */
  fresh: boolean;
  best: number;
  borrowed: WeaponId[];
  children: (borrowed: WeaponId[]) => ReactNode;
}) {
  const { target, fresh, best, children } = props;
  const credits = useApp((s) => s.credits);
  const [borrowed, setBorrowed] = useState(props.borrowed);
  const [asked, setAsked] = useState(!fresh);
  const offer = asked ? [] : weaponCreditOffer(credits, best, borrowed);
  if (offer.length === 0) return children(borrowed);

  const pick = (id: WeaponId) => {
    if (appStore.getState().borrowWeapon(target, id)) setBorrowed([...borrowed, id]);
    setAsked(true);
  };
  return (
    <main className="round" aria-label={target.round === 'bonus' ? 'Bonus round' : 'Your round'}>
      <WeaponCreditPrompt offer={offer} credits={credits.balance.weapon} onPick={pick} onSkip={() => setAsked(true)} />
    </main>
  );
}

function Play(props: {
  initialMode: ResultMode;
  /** The goal whose round this is; null for bonus and practice rounds. */
  goalId: string | null;
  n: number;
  best: number;
  /** The day's round; null for bonus and practice rounds. */
  record: RoundRecord | null;
  /** Weapons not yet unlocked that a Weapon credit lent this round. */
  borrowed: WeaponId[];
}) {
  const { initialMode, goalId, n, best, record, borrowed } = props;
  const goHome = useGoHome();
  const [mode, setMode] = useState(initialMode);
  const reduceMotion = useReduceMotion();
  const sound = useApp((s) => s.prefs.sound);
  // A goal's round has that goal's bombs; a bonus round gets as many as every goal has banked.
  const bankedBombs = useApp((s) => (goalId ? (slotById(s, goalId)?.goal.bombs ?? 0) : totalBombs(s)));
  const storePick = useApp((s) => s.weapon);
  // Practice, and a round with a borrowed weapon, keep their pick to themselves: the saved pick is
  // always a weapon the player has unlocked. A borrowed weapon starts equipped.
  const localPick = initialMode === 'practice' || borrowed.length > 0;
  const [roundPick, setRoundPick] = useState<WeaponId | null>(() => borrowed.at(-1) ?? storePick);
  const pick = localPick ? roundPick : storePick;
  const weapon = useMemo(() => equippedWeapon(pick, best, borrowed), [pick, best, borrowed]);
  const weapons = useMemo(() => roundWeapons(best, borrowed), [best, borrowed]);

  const groups = useMemo(() => composeRound(n).groups, [n]);
  const fill = useMemo(() => fillPlan(n), [n]);
  const [seed, setSeed] = useState(newSeed);
  const round = useMemo<RoundSetup>(() => ({ n, groups, fill, seed }), [n, groups, fill, seed]);

  const game = useRef<GameHandle>(null);
  const [left, setLeft] = useState(n);
  const [over, setOver] = useState(false);
  const [landed, setLanded] = useState(false);
  const [cheered, setCheered] = useState(false);
  const overlay = roundOverlay(landed, mode, cheered);
  // A real round spends banked bombs. Replays, bonus rounds and practice get free ones: a replay or
  // a bonus round as many as are banked, which it never touches.
  const [freeBombs, setFreeBombs] = useState(() => (mode === 'practice' ? PRACTICE_BOMBS : bankedBombs));
  const bombs = mode === 'real' ? bankedBombs : freeBombs;
  const [stats, setStats] = useState<FrameStats | null>(null);
  // Reports from a round that has since been restarted are ignored.
  const seedRef = useRef(seed);

  // Sounds load now and play once a press has let the browser start audio.
  useEffect(() => {
    void loadSounds();
    const resume = () => resumeAudio();
    window.addEventListener('pointerdown', resume, { capture: true });
    window.addEventListener('keydown', resume, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', resume, { capture: true });
      window.removeEventListener('keydown', resume, { capture: true });
    };
  }, []);

  const play = useCallback((s: Sound) => {
    if (appStore.getState().prefs.sound) playSound(s);
  }, []);
  const [cues] = useState(makeCues);
  const onReport = useCallback(
    (r: Report) => {
      if (r.seed !== seedRef.current) return;
      setLeft(r.valueLeft);
      if (r.final) setOver(true);
      if (r.showResult) setLanded(true);
      const c = cues(r, performance.now());
      if (c.shoot) play('shoot');
      if (c.pop) play('pop');
      if (c.boom) play('boom');
    },
    [cues, play],
  );

  // The last zero went: a real round or a bonus round counts as played.
  useEffect(() => {
    if (!over) return;
    if (mode === 'real' && goalId) appStore.getState().finishRound(goalId);
    if (mode === 'bonus') appStore.getState().finishBonusRound();
  }, [over, mode, goalId]);

  // The encouragement arrives with a fanfare.
  useEffect(() => {
    if (overlay === 'cheer') play('fanfare');
  }, [overlay, play]);

  // The fill runs a few seconds before the result sheet; say the round is won right away.
  useEffect(() => {
    if (over) announce('Round cleared.');
  }, [over]);

  /** Finish round: the game is visual, so a keyboard or screen reader can clear it in one go. */
  const finish = () => {
    if (!over) game.current?.finishAll();
  };

  const dismissCheer = useCallback(() => setCheered(true), []);

  /** Play the same round again, right here, with fresh positions and free bombs. */
  const replay = () => {
    const next = newSeed();
    seedRef.current = next;
    setSeed(next);
    setMode(replayMode(mode));
    setLeft(n);
    setOver(false);
    setLanded(false);
    setCheered(false);
    setFreeBombs(mode === 'practice' ? PRACTICE_BOMBS : bankedBombs);
  };

  const onBomb = () => {
    if (over || bombs < 1) return;
    if (mode === 'real') {
      if (!goalId || !appStore.getState().spendBomb(goalId)) return;
    } else {
      setFreeBombs((b) => b - 1);
    }
    game.current?.dropBomb();
  };

  const switchWeapon = () => {
    const i = weapons.findIndex((w) => w.id === weapon.id);
    const next = weapons[(i + 1) % weapons.length];
    if (!next || next.id === weapon.id) return;
    if (localPick) setRoundPick(next.id);
    else appStore.getState().selectWeapon(next.id);
  };

  const name = mode === 'practice' ? 'Practice round' : mode === 'bonus' ? 'Bonus round' : `Day ${n} round`;

  return (
    <main className="round" aria-label={name}>
      <GameCanvas
        ref={game}
        round={round}
        weapon={weapon}
        reduceMotion={reduceMotion}
        onReport={onReport}
        onFrameStats={mode === 'practice' ? setStats : undefined}
      />
      {overlay === 'sheet' ? (
        <ResultSheet n={n} mode={mode} record={record} onBack={goHome} onReplay={replay} />
      ) : overlay === 'cheer' ? (
        <CheerPopup onDismiss={dismissCheer} />
      ) : (
        <Hud
          left={left}
          total={n}
          label={hudLabel(mode, n)}
          weaponName={weapon.name}
          canSwitch={weapons.length > 1}
          onSwitchWeapon={switchWeapon}
          bombs={bombs}
          bombEnabled={!over && bombs > 0}
          onBomb={onBomb}
          sound={sound}
          onToggleSound={() => appStore.getState().setPref('sound', !sound)}
          onQuit={goHome}
          controls={!over}
          hintKey={seed}
          onFinish={finish}
          extra={
            mode === 'practice' ? (
              <p className="meter">{stats ? `${stats.fps.toFixed(0)} FPS · WORST ${stats.worstMs.toFixed(1)} MS · ${stats.pixelRatio}×` : 'MEASURING…'}</p>
            ) : null
          }
        />
      )}
    </main>
  );
}
