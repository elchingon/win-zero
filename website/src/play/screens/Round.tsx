// The shooting round: the canvas filling the screen, the HUD over it, and once the round is won,
// a line of encouragement and then the result sheet over the fill. A real round is the one the
// latest Yes earned (its rewards are already banked); Replay plays it again in place, with no
// effect on the streak. ?practice=N plays any N with every weapon and a frame meter (the demo
// controls offer it), changing nothing.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';

import { parseCount, PRACTICE_BEST, PRACTICE_BOMBS, PRACTICE_MAX_N } from '@/dev/demo';
import { composeRound, equippedWeapon, fillPlan, unlockedWeapons, type WeaponId } from '@/engine';
import { makeCues } from '@/game/cues';
import { roundOverlay, type ResultMode } from '@/game/result';
import type { Report } from '@/game/sim/types';
import type { RoundRecord } from '@/store/types';

import { CheerPopup } from '../game/CheerPopup';
import { GameCanvas, type FrameStats, type GameHandle, type RoundSetup } from '../game/GameCanvas';
import { Hud } from '../game/Hud';
import { ResultSheet } from '../game/ResultSheet';
import { ROUTES, useGoHome } from '../nav';
import { announce } from '../platform/announce';
import { loadSounds, playSound, resumeAudio, type Sound } from '../platform/audio';
import { useReduceMotion } from '../platform/motion';
import { appStore, useApp } from '../store';

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export function Round() {
  const [params] = useSearchParams();
  const practice = parseCount(params.get('practice') ?? '', PRACTICE_MAX_N);
  return practice ? <Play initialMode="practice" n={practice} best={PRACTICE_BEST} record={null} /> : <StoreRound />;
}

function StoreRound() {
  // Read once: if a day settles mid-round, the round on screen stays put.
  const [record] = useState(() => appStore.getState().round);
  const best = useApp((s) => s.goal?.bestStreak);
  if (!record || best === undefined) return <Navigate to={ROUTES.home} replace />;
  // Home only offers rounds not yet played; one that was is a replay.
  return <Play initialMode={record.played ? 'replay' : 'real'} n={record.n} best={best} record={record} />;
}

function Play(props: { initialMode: ResultMode; n: number; best: number; record: RoundRecord | null }) {
  const { initialMode, n, best, record } = props;
  const goHome = useGoHome();
  const [mode, setMode] = useState(initialMode);
  const reduceMotion = useReduceMotion();
  const sound = useApp((s) => s.prefs.sound);
  const bankedBombs = useApp((s) => s.goal?.bombs ?? 0);
  const storePick = useApp((s) => s.weapon);
  const [practicePick, setPracticePick] = useState<WeaponId | null>(storePick);
  const pick = mode === 'practice' ? practicePick : storePick;
  const weapon = useMemo(() => equippedWeapon(pick, best), [pick, best]);
  const unlocked = useMemo(() => unlockedWeapons(best), [best]);

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
  // A real round spends banked bombs. Replays and practice get free ones: a replay as many as
  // are banked, which it never touches.
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

  // The last zero went: a real round counts as played.
  useEffect(() => {
    if (over && mode === 'real') appStore.getState().finishRound();
  }, [over, mode]);

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
    setMode(mode === 'practice' ? 'practice' : 'replay');
    setLeft(n);
    setOver(false);
    setLanded(false);
    setCheered(false);
    setFreeBombs(mode === 'practice' ? PRACTICE_BOMBS : bankedBombs);
  };

  const onBomb = () => {
    if (over || bombs < 1) return;
    if (mode === 'real') {
      if (!appStore.getState().spendBomb()) return;
    } else {
      setFreeBombs((b) => b - 1);
    }
    game.current?.dropBomb();
  };

  const switchWeapon = () => {
    const i = unlocked.findIndex((w) => w.id === weapon.id);
    const next = unlocked[(i + 1) % unlocked.length];
    if (!next || next.id === weapon.id) return;
    if (mode === 'practice') setPracticePick(next.id);
    else appStore.getState().selectWeapon(next.id);
  };

  return (
    <main className="round" aria-label={mode === 'practice' ? 'Practice round' : `Day ${n} round`}>
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
          label={mode === 'practice' ? 'PRACTICE' : `DAY ${n}`}
          weaponName={weapon.name}
          canSwitch={unlocked.length > 1}
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
