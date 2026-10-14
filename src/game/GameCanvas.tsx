// The shooting round's canvas. The sim and the drawing both run on the UI thread: every frame
// steps the round, records it as one Skia picture, and sends a short report to the JS thread.
// Keep this component's props stable: a new frame callback re-registers the loop.
import { Canvas, createPicture, Picture, usePictureAsTexture, type SkPicture } from '@shopify/react-native-skia';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useFrameCallback, useSharedValue, type FrameInfo, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { bakeSprites, makeKit } from './bake/kit';
import { drawScene, makeScratch } from './draw/scene';
import type { Scratch } from './draw/types';
import { resetReport } from './sim/report';
import { createGame } from './sim/spawn';
import { step } from './sim/step';
import type { GameConfig, GameState, Report } from './sim/types';

/** The development frame meter reports this often, in seconds. */
const METER_WINDOW = 0.5;
/** Assumed for the first frame, which has no previous one. */
const FIRST_FRAME_MS = 1000 / 60;

export interface FrameStats {
  fps: number;
  /** The slowest frame in the window, in ms. */
  worstMs: number;
}

function startGame(state: SharedValue<GameState | null>, cfg: GameConfig) {
  'worklet';
  state.value = createGame(cfg);
}

export const GameCanvas = memo(function GameCanvas(props: {
  config: GameConfig;
  onReport: (report: Report) => void;
  /** Development only: frame rate and the slowest frame, twice a second. */
  onFrameStats?: (stats: FrameStats) => void;
}) {
  const { config, onReport, onFrameStats } = props;
  const { width, height, groups } = config;
  const objectCount = groups.reduce((sum, g) => sum + g.count, 0);
  const armored = groups.some((g) => g.kind === 'armored');

  const baked = useMemo(
    () => bakeSprites({ objectCount, width, height, armored }),
    [objectCount, width, height, armored],
  );
  const sheetSize = useMemo(() => ({ width: baked.sheet.width, height: baked.sheet.height }), [baked]);
  const atlas = usePictureAsTexture(baked.picture, sheetSize);
  const kit = useMemo(() => makeKit(width, height, baked.sheet), [width, height, baked]);

  // Built and mutated on the UI thread only. Reading it from JS would copy the whole round.
  const state = useSharedValue<GameState | null>(null);
  const scratch = useSharedValue<Scratch | null>(null);
  const empty = useMemo(() => createPicture(() => {}), []);
  const picture = useSharedValue<SkPicture>(empty);

  useEffect(() => {
    scheduleOnUI(startGame, state, config);
  }, [config, state]);

  const frame = useCallback(
    (info: FrameInfo) => {
      'worklet';
      const s = state.value;
      if (!s) return;
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
    <Canvas style={StyleSheet.absoluteFill}>
      <Picture picture={picture} />
    </Canvas>
  );
});
