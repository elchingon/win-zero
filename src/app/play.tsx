// The shooting round: the game canvas full screen, with the HUD over it, and once the round is
// won, a line of encouragement, a popup for any Game credit its Yes earned, and then the result
// sheet over the fill. A real round is the one the latest Yes earned (its rewards are already
// banked, and only revealed here); Replay plays it again in place, with
// no effect on the streak. /play?round=bonus plays the bonus round a Game credit paid for, which
// changes nothing either. Before a round not yet played, Win Zero Plus asks which game to play it
// in (SPEC 9), and a player holding a Weapon credit is asked whether to borrow a weapon they
// haven't unlocked for it. Every round plays in the game mode and theme picked (in Settings, or
// for the game, before the round), which in Win Zero are always the Shooter and Classic.
// Development builds, and release builds made with EXPO_PUBLIC_PERF_BUILD=1 (eas build
// --profile perf), can open /play?practice=N to play any N with every weapon and a frame
// meter, and nothing about the streak changes. In Win Zero Plus, /play?practice=N&theme=<id>
// plays it in any theme, earned or not, and &mode=<id> in any game mode whose round is built,
// without changing the saved pick.
import { Redirect, router, Stack, useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PRACTICE_BEST, PRACTICE_BOMBS, PRACTICE_MAX_N } from '@/dev/demo';
import {
  composeRound,
  equippedWeapon,
  fillPlan,
  isModeId,
  isThemeId,
  modeTier,
  PLAYABLE_MODES,
  roundWeapons,
  weaponCreditOffer,
  type ModeId,
  type ThemeId,
  type WeaponId,
} from '@/engine';
import { CheerPopup } from '@/game/CheerPopup';
import { makeCues } from '@/game/cues';
import { GameCanvas, type FrameStats, type GameHandle, type RoundSetup } from '@/game/GameCanvas';
import { Hud } from '@/game/Hud';
import { hudLabel, replayMode, revealedCredits, roundOverlay } from '@/game/result';
import { ResultSheet, type ResultMode } from '@/game/ResultSheet';
import { useSfx } from '@/game/sfx';
import type { Report } from '@/game/sim/types';
import { WeaponCreditPrompt } from '@/game/WeaponCreditPrompt';
import {
  appStore,
  arsenalBestOf,
  gameModeOf,
  primarySlot,
  slotById,
  themeOf,
  totalBombs,
  useApp,
  type CreditRound,
  type RoundRecord,
} from '@/store';
import { THEME_LOOKS } from '@/theme/themes';
import { colors, fonts } from '@/theme/tokens';
import { feedback } from '@/ui/feedback';
import { useReduceMotion, useScreenReader } from '@/ui/a11y';
import { creditReveal } from '@/ui/copy/credits';
import { CrashScreen } from '@/ui/CrashScreen';
import { CreditPopup } from '@/ui/CreditPopup';
import { FEATURES } from '@/variant';

// Win Zero Plus only: the game picker before a round (SPEC 9). The literal comparison folds per
// file, so Win Zero's bundle leaves it out.
const PlusPlay: typeof import('@/plus/play') | null =
  process.env.EXPO_PUBLIC_APP_VARIANT === 'plus'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/plus/play')
    : null;

/** Practice rounds: development builds, and release builds made for measuring frame rate. */
const PRACTICE_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_PERF_BUILD === '1';

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

const NONE_BORROWED: WeaponId[] = [];

export default function Play() {
  const { practice, round, goal, theme, mode } = useLocalSearchParams<{
    practice?: string;
    round?: string;
    goal?: string;
    theme?: string;
    mode?: string;
  }>();
  const practiceN = PRACTICE_ENABLED && practice ? Number(practice) : NaN;
  const isPractice = Number.isInteger(practiceN) && practiceN >= 1 && practiceN <= PRACTICE_MAX_N;
  // A practice round in Plus can try on any theme, and any mode whose round is built; anything
  // else wears the equipped ones.
  const practiceTheme = FEATURES.themes && isThemeId(theme) ? theme : undefined;
  const practiceMode = FEATURES.extraModes && isModeId(mode) && PLAYABLE_MODES.includes(mode) ? mode : undefined;
  return (
    <>
      {/* An iOS edge swipe would fight the aim. The HUD's ✕ leaves instead. */}
      <Stack.Screen options={{ gestureEnabled: false }} />
      {isPractice ? (
        <Round
          // A link to the screen already showing only changes its params, and a round reads its
          // mode and theme once: a practice link that names others starts a new round.
          key={`${practiceN}:${practiceMode}:${practiceTheme}`}
          initialMode="practice"
          goalId={null}
          n={practiceN}
          best={PRACTICE_BEST}
          record={null}
          borrowed={NONE_BORROWED}
          theme={practiceTheme}
          gameMode={practiceMode}
        />
      ) : round === 'bonus' ? (
        <BonusStoreRound />
      ) : (
        <StoreRound goalId={goal} />
      )}
    </>
  );
}

/** `goalId`'s round; without one (an old link), the first round waiting, or the first goal's. */
function StoreRound({ goalId: wanted }: { goalId?: string }) {
  // Read once: if a day settles mid-round, the round on screen stays put.
  const [slot] = useState(() => {
    const s = appStore.getState();
    if (wanted) return slotById(s, wanted);
    return s.goals.find((g) => g.round && !g.round.played) ?? primarySlot(s);
  });
  const best = useApp(arsenalBestOf);
  const record = slot?.round;
  if (!slot || !record) return <Redirect href="/" />;
  const goalId = slot.goal.goalId;
  // Home only offers rounds not yet played; one that was is a replay.
  const round = (
    <WeaponCreditGate target={{ round: 'daily', goalId }} fresh={!record.played} best={best} borrowed={record.borrowed}>
      {(borrowed) => (
        <Round
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
  return PlusPlay ? <PlusPlay.ModeGate fresh={!record.played}>{round}</PlusPlay.ModeGate> : round;
}

const BONUS: CreditRound = { round: 'bonus' };

function BonusStoreRound() {
  const [bonus] = useState(() => appStore.getState().bonus);
  const best = useApp(arsenalBestOf);
  const hasGoal = useApp((s) => s.goals.length > 0);
  if (!bonus || !hasGoal) return <Redirect href="/" />;
  const round = (
    <WeaponCreditGate target={BONUS} fresh={!bonus.played} best={best} borrowed={bonus.borrowed}>
      {(borrowed) => <Round initialMode="bonus" goalId={null} n={bonus.n} best={best} record={null} borrowed={borrowed} />}
    </WeaponCreditGate>
  );
  return PlusPlay ? <PlusPlay.ModeGate fresh={!bonus.played}>{round}</PlusPlay.ModeGate> : round;
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
  // The game the round will play in, which names what a credit lends (SPEC 9).
  const [mode] = useState(() => gameModeOf(appStore.getState()));
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
      <WeaponCreditPrompt
        offer={offer}
        credits={credits.balance.weapon}
        mode={mode}
        onPick={pick}
        onSkip={() => setAsked(true)}
      />
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
  /** The goal whose round this is; null for bonus and practice rounds. */
  goalId: string | null;
  n: number;
  best: number;
  /** The day's round; null for bonus and practice rounds. */
  record: RoundRecord | null;
  /** Weapons not yet unlocked that a Weapon credit lent this round. */
  borrowed: WeaponId[];
  /** A practice round's theme, from its link; otherwise the equipped one. */
  theme?: ThemeId;
  /** A practice round's game mode, from its link; otherwise the equipped one. */
  gameMode?: ModeId;
}) {
  const { initialMode, goalId, n, best, record, borrowed, theme, gameMode: linkMode } = props;
  // Replay turns a real round into a replay.
  const [mode, setMode] = useState(initialMode);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const screenReader = useScreenReader();
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
  // Read once: replays keep the round's mode and theme.
  const [gameMode] = useState(() => linkMode ?? gameModeOf(appStore.getState()));
  const [look] = useState(() => THEME_LOOKS[theme ?? themeOf(appStore.getState())]);

  const groups = useMemo(() => composeRound(n).groups, [n]);
  const fill = useMemo(() => fillPlan(n), [n]);
  const [seed, setSeed] = useState(newSeed);
  const round = useMemo<RoundSetup>(
    () => ({ n, groups, fill, width, height, insetTop: insets.top, insetBottom: insets.bottom, seed, mode: gameMode }),
    [n, groups, fill, width, height, insets.top, insets.bottom, seed, gameMode],
  );

  const game = useRef<GameHandle>(null);
  const [left, setLeft] = useState(n);
  const [over, setOver] = useState(false);
  const [landed, setLanded] = useState(false);
  const [cheered, setCheered] = useState(false);
  // The Game credits the Yes earned, revealed once the cheer is dismissed.
  const earned = useMemo(() => revealedCredits(mode, record), [mode, record]);
  const [revealed, setRevealed] = useState(false);
  const gameCredits = useApp((s) => s.credits.balance.game);
  const overlay = roundOverlay(landed, mode, cheered, earned.length > 0 && !revealed);
  // A real round spends banked bombs. Replays, bonus rounds and practice get free ones: a replay or
  // a bonus round as many as are banked, which it never touches.
  const [freeBombs, setFreeBombs] = useState(() => (mode === 'practice' ? PRACTICE_BOMBS : bankedBombs));
  const bombs = mode === 'real' ? bankedBombs : freeBombs;
  const [stats, setStats] = useState<FrameStats | null>(null);
  // Reports from a round that has since been restarted are ignored.
  const seedRef = useRef(seed);

  const play = useSfx();
  const [cues] = useState(() => makeCues(gameMode));
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
      if (c.bounce) play('bounce');
      if (c.swish) play('swish');
      if (c.killHaptic) feedback.kill();
      if (c.bombHaptic) feedback.bomb();
      if (c.boomHaptic) feedback.boom();
    },
    [cues, play],
  );

  // The last zero went: a real round or a bonus round counts as played.
  useEffect(() => {
    if (!over) return;
    if (mode === 'real' && goalId && record) appStore.getState().finishRound(goalId, record.day);
    if (mode === 'bonus') appStore.getState().finishBonusRound();
  }, [over, mode, goalId, record]);

  // The encouragement arrives with a fanfare and a light tap; a Game credit with the Yes chime.
  useEffect(() => {
    if (overlay === 'cheer') {
      play('fanfare');
      feedback.cheer();
    } else if (overlay === 'credit') {
      play('yes');
      feedback.success();
    }
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
  const dismissCredit = useCallback(() => setRevealed(true), []);

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

  return (
    // VoiceOver's magic tap (a two-finger double-tap) finishes the round too.
    <View style={styles.root} onMagicTap={finish}>
      <GameCanvas
        ref={game}
        round={round}
        look={look}
        weapon={weapon}
        reduceMotion={reduceMotion}
        onReport={onReport}
        onFrameStats={mode === 'practice' ? setStats : undefined}
      />
      {overlay === 'sheet' ? (
        <ResultSheet n={n} mode={mode} goalId={goalId} record={record} gameMode={gameMode} onBack={toBase} onReplay={replay} />
      ) : overlay === 'cheer' ? (
        <CheerPopup onDismiss={dismissCheer} />
      ) : overlay === 'credit' ? (
        <CreditPopup news={creditReveal(earned, gameCredits)} onDismiss={dismissCredit} />
      ) : (
        <Hud
          left={left}
          total={n}
          label={hudLabel(mode, n)}
          mode={gameMode}
          tierName={modeTier(gameMode, weapon.id)}
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
