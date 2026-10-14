// The shooting round: the game canvas full screen, with the HUD over it. A real round is the
// one the latest Yes earned (its rewards are already banked); a replay plays it again with no
// effect on the streak. Development builds, and release builds made with
// EXPO_PUBLIC_PERF_BUILD=1 (eas build --profile perf), can open /play?practice=N to play any N
// with every weapon and a frame meter, and nothing about the streak changes.
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { composeRound, equippedWeapon, unlockedWeapons, type WeaponId } from '@/engine';
import { GameCanvas, type FrameStats, type GameHandle, type RoundSetup } from '@/game/GameCanvas';
import { Hud } from '@/game/Hud';
import type { Report } from '@/game/sim/types';
import { appStore, useApp } from '@/store';
import { colors, fonts } from '@/theme/tokens';
import { useReduceMotion } from '@/ui/useReduceMotion';

/** Practice rounds: development builds, and release builds made for measuring frame rate. */
const PRACTICE_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_PERF_BUILD === '1';
/** Practice rounds have every weapon. */
const PRACTICE_BEST = 100;
/** Practice rounds go up to this many zeros. */
const PRACTICE_MAX_N = 100_000;
/** Practice rounds come with this many free bombs, to try them without a long run. */
const PRACTICE_BOMBS = 9;
/** Until the result sheet moves into Play: how long the last kill shows before the result. */
const RESULT_STOPGAP_MS = 900;

type Mode = 'real' | 'replay' | 'practice';

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export default function Play() {
  const { replay, practice } = useLocalSearchParams<{ replay?: string; practice?: string }>();
  const practiceN = PRACTICE_ENABLED && practice ? Number(practice) : NaN;
  const isPractice = Number.isInteger(practiceN) && practiceN >= 1 && practiceN <= PRACTICE_MAX_N;
  return (
    <>
      {/* An iOS edge swipe would fight the aim. The HUD's ✕ leaves instead. */}
      <Stack.Screen options={{ gestureEnabled: false }} />
      {isPractice ? <Round mode="practice" n={practiceN} best={PRACTICE_BEST} /> : <StoreRound replay={replay === '1'} />}
    </>
  );
}

function StoreRound({ replay }: { replay: boolean }) {
  // Read once: if a day settles mid-round, the round on screen stays put.
  const [record] = useState(() => appStore.getState().round);
  const best = useApp((s) => s.goal?.bestStreak);
  if (!record || best === undefined) return <Redirect href="/" />;
  return <Round mode={replay || record.played ? 'replay' : 'real'} n={record.n} best={best} />;
}

function Round({ mode, n, best }: { mode: Mode; n: number; best: number }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const sound = useApp((s) => s.prefs.sound);
  const bankedBombs = useApp((s) => s.goal?.bombs ?? 0);
  const storePick = useApp((s) => s.weapon);
  const [practicePick, setPracticePick] = useState<WeaponId | null>(storePick);
  const pick = mode === 'practice' ? practicePick : storePick;
  const weapon = useMemo(() => equippedWeapon(pick, best), [pick, best]);
  const unlocked = useMemo(() => unlockedWeapons(best), [best]);

  const groups = useMemo(() => composeRound(n).groups, [n]);
  const [seed, setSeed] = useState(newSeed);
  const round = useMemo<RoundSetup>(
    () => ({ n, groups, width, height, insetTop: insets.top, insetBottom: insets.bottom, seed }),
    [n, groups, width, height, insets.top, insets.bottom, seed],
  );

  const game = useRef<GameHandle>(null);
  const [left, setLeft] = useState(n);
  const [over, setOver] = useState(false);
  // A real round spends banked bombs. Replays and practice get free ones: a replay as many as
  // are banked, which it never touches.
  const [freeBombs, setFreeBombs] = useState(() => (mode === 'practice' ? PRACTICE_BOMBS : bankedBombs));
  const bombs = mode === 'real' ? bankedBombs : freeBombs;
  const [stats, setStats] = useState<FrameStats | null>(null);
  // Reports from a round that has since been restarted are ignored.
  const seedRef = useRef(seed);

  const onReport = useCallback((r: Report) => {
    if (r.seed !== seedRef.current) return;
    setLeft(r.valueLeft);
    if (r.final) setOver(true);
  }, []);

  const restart = useCallback(() => {
    const next = newSeed();
    seedRef.current = next;
    setSeed(next);
    setLeft(n);
    setOver(false);
    setFreeBombs(mode === 'practice' ? PRACTICE_BOMBS : (appStore.getState().goal?.bombs ?? 0));
  }, [n, mode]);

  // The last zero went: a real round counts as played. Until the result sheet moves in here,
  // the result screen follows (practice just starts over).
  useEffect(() => {
    if (!over) return;
    if (mode === 'real') appStore.getState().finishRound();
    const id = setTimeout(() => {
      if (mode === 'practice') restart();
      else router.replace(mode === 'replay' ? { pathname: '/result', params: { replay: '1' } } : '/result');
    }, RESULT_STOPGAP_MS);
    return () => clearTimeout(id);
  }, [over, mode, restart]);

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
    <View style={styles.root}>
      <GameCanvas
        ref={game}
        round={round}
        weapon={weapon}
        reduceMotion={reduceMotion}
        onReport={onReport}
        onFrameStats={mode === 'practice' ? setStats : undefined}
      />
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
        // Home stays underneath, or takes Play's place when a link opened Play directly.
        onQuit={() => router.dismissTo('/')}
        controls={!over}
        hintKey={seed}
        extra={
          mode === 'practice' ? (
            <Text style={styles.meter}>
              {stats ? `${stats.fps.toFixed(0)} FPS · WORST ${stats.worstMs.toFixed(1)} MS` : 'MEASURING…'}
            </Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  meter: { marginTop: 4, fontFamily: fonts.monoSemiBold, fontSize: 11, letterSpacing: 1, color: colors.teal },
});
