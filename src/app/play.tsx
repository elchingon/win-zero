// The shooting round: the game canvas full screen, with the HUD over it, and once the round is
// won, a line of encouragement and then the result sheet over the fill. A real round is the one
// the latest Yes earned (its rewards are already banked); Replay plays it again in place, with
// no effect on the streak.
// Development builds, and release builds made with EXPO_PUBLIC_PERF_BUILD=1 (eas build
// --profile perf), can open /play?practice=N to play any N with every weapon and a frame
// meter, and nothing about the streak changes.
import { Redirect, router, Stack, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PRACTICE_BEST, PRACTICE_BOMBS, PRACTICE_MAX_N } from '@/dev/demo';
import { composeRound, equippedWeapon, fillPlan, unlockedWeapons, type WeaponId } from '@/engine';
import { CheerPopup } from '@/game/CheerPopup';
import { makeCues } from '@/game/cues';
import { GameCanvas, type FrameStats, type GameHandle, type RoundSetup } from '@/game/GameCanvas';
import { Hud } from '@/game/Hud';
import { hudLabel, replayMode, roundOverlay } from '@/game/result';
import { ResultSheet, type ResultMode } from '@/game/ResultSheet';
import { useSfx } from '@/game/sfx';
import type { Report } from '@/game/sim/types';
import { appStore, useApp, type RoundRecord } from '@/store';
import { colors, fonts } from '@/theme/tokens';
import { feedback } from '@/ui/feedback';
import { useReduceMotion, useScreenReader } from '@/ui/a11y';
import { CrashScreen } from '@/ui/CrashScreen';

/** Practice rounds: development builds, and release builds made for measuring frame rate. */
const PRACTICE_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_PERF_BUILD === '1';

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export default function Play() {
  const { practice } = useLocalSearchParams<{ practice?: string }>();
  const practiceN = PRACTICE_ENABLED && practice ? Number(practice) : NaN;
  const isPractice = Number.isInteger(practiceN) && practiceN >= 1 && practiceN <= PRACTICE_MAX_N;
  return (
    <>
      {/* An iOS edge swipe would fight the aim. The HUD's ✕ leaves instead. */}
      <Stack.Screen options={{ gestureEnabled: false }} />
      {isPractice ? (
        <Round initialMode="practice" n={practiceN} best={PRACTICE_BEST} record={null} />
      ) : (
        <StoreRound />
      )}
    </>
  );
}

function StoreRound() {
  // Read once: if a day settles mid-round, the round on screen stays put.
  const [record] = useState(() => appStore.getState().round);
  const best = useApp((s) => s.goal?.bestStreak);
  if (!record || best === undefined) return <Redirect href="/" />;
  // Home only offers rounds not yet played; one that was is a replay.
  return <Round initialMode={record.played ? 'replay' : 'real'} n={record.n} best={best} record={record} />;
}

/** Back to Home: underneath Play, or taking its place when a link opened Play directly. */
const toBase = () => router.dismissTo('/');

/**
 * A render crash in the round. The Yes and its rewards were saved when it was answered, so
 * nothing is lost, and Home still offers a round that wasn't finished. Errors thrown in the
 * UI-thread worklets (Skia drawing, Reanimated) aren't React render errors, so no boundary
 * catches them.
 */
export function ErrorBoundary({ error }: ErrorBoundaryProps) {
  return (
    <CrashScreen
      eyebrow="Round stopped"
      title={['The round hit ', 'a snag.']}
      body={['Your Yes counts, and its rewards are already banked. Nothing is lost.']}
      action="Back to base"
      onAction={toBase}
      error={error}
    />
  );
}

function Round(props: { initialMode: ResultMode; n: number; best: number; record: RoundRecord | null }) {
  const { initialMode, n, best, record } = props;
  // Replay turns a real round into a replay.
  const [mode, setMode] = useState(initialMode);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const screenReader = useScreenReader();
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
  const round = useMemo<RoundSetup>(
    () => ({ n, groups, fill, width, height, insetTop: insets.top, insetBottom: insets.bottom, seed }),
    [n, groups, fill, width, height, insets.top, insets.bottom, seed],
  );

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

  const play = useSfx();
  const [cues] = useState(makeCues);
  const onReport = useCallback(
    (r: Report) => {
      if (r.seed !== seedRef.current) return;
      setLeft(r.valueLeft);
      if (r.final) setOver(true);
      if (r.showResult) setLanded(true);
      const c = cues(r, Date.now());
      if (c.shoot) play('shoot');
      if (c.pop) play('pop');
      if (c.boom) play('boom');
      if (c.killHaptic) feedback.kill();
      if (c.bombHaptic) feedback.bomb();
      if (c.boomHaptic) feedback.boom();
    },
    [cues, play],
  );

  // The last zero went: a real round counts as played.
  useEffect(() => {
    if (over && mode === 'real') appStore.getState().finishRound();
  }, [over, mode]);

  // The encouragement arrives with a fanfare and a light tap.
  useEffect(() => {
    if (overlay !== 'cheer') return;
    play('fanfare');
    feedback.cheer();
  }, [overlay, play]);

  // The fill runs a few seconds before the result sheet; say the round is won right away.
  useEffect(() => {
    if (over && screenReader) AccessibilityInfo.announceForAccessibility('Round cleared.');
  }, [over, screenReader]);

  /** Finish round: the game is visual, so a screen reader can clear it in one go. */
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
    // VoiceOver's magic tap (a two-finger double-tap) finishes the round too.
    <View style={styles.root} onMagicTap={finish}>
      <GameCanvas
        ref={game}
        round={round}
        weapon={weapon}
        reduceMotion={reduceMotion}
        onReport={onReport}
        onFrameStats={mode === 'practice' ? setStats : undefined}
      />
      {overlay === 'sheet' ? (
        <ResultSheet n={n} mode={mode} record={record} onBack={toBase} onReplay={replay} />
      ) : overlay === 'cheer' ? (
        <CheerPopup onDismiss={dismissCheer} />
      ) : (
        <Hud
          left={left}
          total={n}
          label={hudLabel(mode, n)}
          weaponName={weapon.name}
          canSwitch={unlocked.length > 1}
          onSwitchWeapon={switchWeapon}
          bombs={bombs}
          bombEnabled={!over && bombs > 0}
          onBomb={onBomb}
          sound={sound}
          onToggleSound={() => appStore.getState().setPref('sound', !sound)}
          onQuit={toBase}
          controls={!over}
          hintKey={seed}
          onFinish={screenReader ? finish : undefined}
          extra={
            mode === 'practice' ? (
              <Text style={styles.meter}>
                {stats ? `${stats.fps.toFixed(0)} FPS · WORST ${stats.worstMs.toFixed(1)} MS` : 'MEASURING…'}
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  meter: { marginTop: 4, fontFamily: fonts.monoSemiBold, fontSize: 11, letterSpacing: 1, color: colors.teal },
});
