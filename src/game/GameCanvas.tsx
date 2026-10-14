// The shooting round's canvas. The sim and the drawing both run on the UI thread: every frame
// steps the round, records it as one Skia picture, and sends a short report to the JS thread.
// Touches go straight to the sim on the UI thread too. Keep this component's props stable: a
// new frame callback re-registers the loop, and a new `round` starts the round over.
import {
  Canvas,
  createPicture,
  Picture,
  useFont,
  usePictureAsTexture,
  type SkPicture,
} from '@shopify/react-native-skia';
import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useFrameCallback, useSharedValue, type FrameInfo, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import type { WeaponDef } from '@/engine';
import { fontAssets } from '@/theme/fonts';

import { bakeSprites, makeKit } from './bake/kit';
import { drawScene, makeScratch } from './draw/scene';
import type { Scratch } from './draw/types';
import { dropBomb } from './sim/bomb';
import { moveAim, pressFire, releaseFire, setReduceMotion, setWeapon } from './sim/input';
import { resetReport } from './sim/report';
import { createGame } from './sim/spawn';
import { step } from './sim/step';
import type { GameConfig, GameState, Report } from './sim/types';

/** The development frame meter reports this often, in seconds. */
const METER_WINDOW = 0.5;
/** Assumed for the first frame, which has no previous one. */
const FIRST_FRAME_MS = 1000 / 60;
/** The bake makes its own sizes from the typeface; this only loads it. */
const FONT_LOAD_SIZE = 16;
const NO_SIZE = { width: 1, height: 1 };

export interface FrameStats {
  fps: number;
  /** The slowest frame in the window, in ms. */
  worstMs: number;
}

/** What identifies a round. The weapon and reduce motion can change mid-round. */
export type RoundSetup = Omit<GameConfig, 'weapon' | 'reduceMotion'>;

/** Commands the screen sends into the running round. */
export interface GameHandle {
  /** Blast the middle of the play area. The screen has already paid for it. */
  dropBomb: () => void;
}

function startGame(state: SharedValue<GameState | null>, cfg: GameConfig) {
  'worklet';
  state.value = createGame(cfg);
}

function applyWeapon(state: SharedValue<GameState | null>, weapon: WeaponDef) {
  'worklet';
  const s = state.value;
  if (s) setWeapon(s, weapon);
}

function applyReduceMotion(state: SharedValue<GameState | null>, reduceMotion: boolean) {
  'worklet';
  const s = state.value;
  if (s) setReduceMotion(s, reduceMotion);
}

function bomb(state: SharedValue<GameState | null>) {
  'worklet';
  const s = state.value;
  if (s) dropBomb(s);
}

export const GameCanvas = memo(function GameCanvas(props: {
  round: RoundSetup;
  weapon: WeaponDef;
  reduceMotion: boolean;
  onReport: (report: Report) => void;
  /** Development only: frame rate and the slowest frame, twice a second. */
  onFrameStats?: (stats: FrameStats) => void;
  ref?: Ref<GameHandle>;
}) {
  const { round, weapon, reduceMotion, onReport, onFrameStats, ref } = props;
  const { width, height, groups } = round;
  const font = useFont(fontAssets.Bungee_400Regular, FONT_LOAD_SIZE);

  // The sprite sheet waits for the font (badges and fill glyphs are Bungee); until then the
  // frame loop holds off.
  const baked = useMemo(() => (font ? bakeSprites({ groups, width, height, font }) : null), [groups, width, height, font]);
  const sheetSize = useMemo(() => (baked ? { width: baked.sheet.width, height: baked.sheet.height } : NO_SIZE), [baked]);
  const atlas = usePictureAsTexture(baked?.picture ?? null, sheetSize);
  const kit = useMemo(() => (baked ? makeKit(width, height, baked.sheet) : null), [width, height, baked]);

  // Built and mutated on the UI thread only. Reading it from JS would copy the whole round.
  const state = useSharedValue<GameState | null>(null);
  const scratch = useSharedValue<Scratch | null>(null);
  const empty = useMemo(() => createPicture(() => {}), []);
  const picture = useSharedValue<SkPicture>(empty);

  // A new round starts with whatever weapon and motion setting are current, without making
  // either one restart the round when it changes.
  const live = useRef({ weapon, reduceMotion });
  useEffect(() => {
    live.current = { weapon, reduceMotion };
  }, [weapon, reduceMotion]);
  useEffect(() => {
    scheduleOnUI(startGame, state, { ...round, ...live.current });
  }, [round, state]);
  useEffect(() => {
    scheduleOnUI(applyWeapon, state, weapon);
  }, [weapon, state]);
  useEffect(() => {
    scheduleOnUI(applyReduceMotion, state, reduceMotion);
  }, [reduceMotion, state]);

  useImperativeHandle(ref, () => ({ dropBomb: () => scheduleOnUI(bomb, state) }), [state]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((e) => {
          'worklet';
          const s = state.value;
          if (s) pressFire(s, e.x, e.y);
        })
        .onUpdate((e) => {
          'worklet';
          const s = state.value;
          if (s) moveAim(s, e.x, e.y);
        })
        .onFinalize(() => {
          'worklet';
          const s = state.value;
          if (s) releaseFire(s);
        }),
    [state],
  );

  const frame = useCallback(
    (info: FrameInfo) => {
      'worklet';
      const s = state.value;
      if (!s || !kit) return;
      let sc = scratch.value;
      if (!sc) {
        sc = makeScratch();
        scratch.value = sc;
      }
      const dtMs = info.timeSincePreviousFrame ?? FIRST_FRAME_MS;
      step(s, dtMs / 1000);

      const image = atlas.value;
      const frameScratch = sc;
      picture.value = createPicture((canvas) => drawScene(canvas, s, kit, image, frameScratch), kit.bounds);

      if (s.report.dirty) {
        scheduleOnRN(onReport, s.report); // copied now, so it can be reset straight after
        resetReport(s.report);
      }
      if (onFrameStats) {
        const m = sc.meter;
        m.t += dtMs / 1000;
        m.frames++;
        if (dtMs > m.worst) m.worst = dtMs;
        if (m.t >= METER_WINDOW) {
          scheduleOnRN(onFrameStats, { fps: m.frames / m.t, worstMs: m.worst });
          m.t = 0;
          m.frames = 0;
          m.worst = 0;
        }
      }
    },
    [state, scratch, atlas, picture, kit, onReport, onFrameStats],
  );
  useFrameCallback(frame);

  return (
    <GestureDetector gesture={gesture}>
      <View style={StyleSheet.absoluteFill} collapsable={false} accessibilityLabel="Play area">
        <Canvas style={StyleSheet.absoluteFill}>
          <Picture picture={picture} />
        </Canvas>
      </View>
    </GestureDetector>
  );
});
