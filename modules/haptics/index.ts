// Android's haptics with their usage named (src/ui/feedback.ts is the only importer). Android files
// a short vibration that names no usage, as expo-haptics plays them, under touch feedback, and drops
// it while the phone's Touch feedback setting is off. Null on iPhone, the web, in tests, and in a
// development build made before this module, where feedback falls back to expo-haptics.
import { requireOptionalNativeModule } from 'expo';

/** Which of the phone's vibration settings governs a buzz: Media vibration, or Touch feedback. */
export type HapticUsage = 'media' | 'touch';

export interface AppHapticsModule {
  /**
   * Plays a waveform once: `timings` are step lengths in ms, `amplitudes` each step's strength
   * (0 is off, 255 full), the two of equal length.
   */
  play(timings: readonly number[], amplitudes: readonly number[], usage: HapticUsage): void;
}

export default requireOptionalNativeModule<AppHapticsModule>('AppHaptics');
