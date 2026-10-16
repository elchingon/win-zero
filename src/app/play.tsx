// The shooting round: the game canvas full screen, with the HUD over it, and once the round is
// won, a line of encouragement and then the result sheet over the fill. A real round is the one
// the latest Yes earned (its rewards are already banked); Replay plays it again in place, with
// no effect on the streak. /play?round=bonus plays the bonus round a Game credit paid for, which
// changes nothing either. Before a round not yet played, a player holding a Weapon credit is
// asked whether to borrow a weapon they haven't unlocked for it.
// Development builds, and release builds made with EXPO_PUBLIC_PERF_BUILD=1 (eas build
// --profile perf), can open /play?practice=N to play any N with every weapon and a frame
// meter, and nothing about the streak changes.
import { Redirect, router, Stack, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PRACTICE_BEST, PRACTICE_BOMBS, PRACTICE_MAX_N } from '@/dev/demo';
import { composeRound, equippedWeapon, fillPlan, roundWeapons, weaponCreditOffer, type WeaponId } from '@/engine';
import { CheerPopup } from '@/game/CheerPopup';
import { makeCues } from '@/game/cues';
import { GameCanvas, type FrameStats, type GameHandle, type RoundSetup } from '@/game/GameCanvas';
import { Hud } from '@/game/Hud';
import { hudLabel, replayMode, roundOverlay } from '@/game/result';
import { ResultSheet, type ResultMode } from '@/game/ResultSheet';
import { useSfx } from '@/game/sfx';
import type { Report } from '@/game/sim/types';
import { WeaponCreditPrompt } from '@/game/WeaponCreditPrompt';
import { appStore, useApp, type CreditRound, type RoundRecord } from '@/store';
import { colors, fonts } from '@/theme/tokens';
import { feedback } from '@/ui/feedback';
import { useReduceMotion, useScreenReader } from '@/ui/a11y';
import { CrashScreen } from '@/ui/CrashScreen';

/** Practice rounds: development builds, and release builds made for measuring frame rate. */
const PRACTICE_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_PERF_BUILD === '1';

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

const NONE_BORROWED: WeaponId[] = [];

export default function Play() {
  const { practice, round } = useLocalSearchParams<{ practice?: string; round?: string }>();
  const practiceN = PRACTICE_ENABLED && practice ? Number(practice) : NaN;
  const isPractice = Number.isInteger(practiceN) && practiceN >= 1 && practiceN <= PRACTICE_MAX_N;
  return (
    <>
      {/* An iOS edge swipe would fight the aim. The HUD's ✕ leaves instead. */}
      <Stack.Screen options={{ gestureEnabled: false }} />
      {isPractice ? (
        <Round initialMode="practice" n={practiceN} best={PRACTICE_BEST} record={null} borrowed={NONE_BORROWED} />
      ) : round === 'bonus' ? (
        <BonusStoreRound />
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
  return (
    <WeaponCreditGate target="daily" fresh={!record.played} best={best} borrowed={record.borrowed}>
      {(borrowed) => (
        <Round initialMode={record.played ? 'replay' : 'real'} n={record.n} best={best} record={record} borrowed={borrowed} />
      )}
    </WeaponCreditGate>
  );
}

function BonusStoreRound() {
  const [bonus] = useState(() => appStore.getState().bonus);
  const best = useApp((s) => s.goal?.bestStreak);
  if (!bonus || best === undefined) return <Redirect href="/" />;
  return (
    <WeaponCreditGate target="bonus" fresh={!bonus.played} best={best} borrowed={bonus.borrowed}>
      {(borrowed) => <Round initialMode="bonus" n={bonus.n} best={best} record={null} borrowed={borrowed} />}
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
    <View style={styles.root}>
      <WeaponCreditPrompt offer={offer} credits={credits.balance.weapon} onPick={pick} onSkip={() => setAsked(true)} />
    </View>
  );
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

function Round(props: {
  initialMode: ResultMode;
  n: number;
  best: number;
  /** The day's round; null for bonus and practice rounds. */
  record: RoundRecord | null;
  /** Weapons not yet unlocked that a Weapon credit lent this round. */
  borrowed: WeaponId[];
}) {
  const { initialMode, n, best, record, borrowed } = props;
  // Replay turns a real round into a replay.
  const [mode, setMode] = useState(initialMode);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const screenReader = useScreenReader();
  const sound = useApp((s) => s.prefs.sound);
  const bankedBombs = useApp((s) => s.goal?.bombs ?? 0);
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
  // A real round spends banked bombs. Replays, bonus rounds and practice get free ones: a replay or
  // a bonus round as many as are banked, which it never touches.
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

  // The last zero went: a real round or a bonus round counts as played.
  useEffect(() => {
    if (!over) return;
    if (mode === 'real') appStore.getState().finishRound();
    if (mode === 'bonus') appStore.getState().finishBonusRound();
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
    const i = weapons.findIndex((w) => w.id === weapon.id);
    const next = weapons[(i + 1) % weapons.length];
    if (!next || next.id === weapon.id) return;
    if (localPick) setRoundPick(next.id);
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
          canSwitch={weapons.length > 1}
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
