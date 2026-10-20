// The round's sound effects (made by scripts/gen-sfx.mjs, mostly from the prototype's
// synthesis). Each sound has a few players, played round-robin, so quick repeats overlap
// instead of cutting each other off. Quiet when the player has sound off, and under the
// silent switch. Win Zero Plus's game modes add a bounce and a swish, which only Plus carries.
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';

import { appStore } from '@/store';

import boom from '../../assets/sfx/boom.wav';
import fanfare from '../../assets/sfx/fanfare.wav';
import pop from '../../assets/sfx/pop.wav';
import shoot from '../../assets/sfx/shoot.wav';

// Each app bundles only the sounds it plays: release builds inline the variant, and Metro folds
// the literal comparison and drops the other require.
const BOUNCE: number | null =
  process.env.EXPO_PUBLIC_APP_VARIANT === 'plus' ? require('../../assets/sfx/bounce.wav') : null;
const SWISH: number | null =
  process.env.EXPO_PUBLIC_APP_VARIANT === 'plus' ? require('../../assets/sfx/swish.wav') : null;

export type Sound = 'shoot' | 'pop' | 'boom' | 'fanfare' | 'bounce' | 'swish';

/** A sound with no source isn't in this app, and plays as silence. */
const SOUNDS: Record<Sound, { source: number | null; voices: number }> = {
  shoot: { source: shoot, voices: 4 },
  pop: { source: pop, voices: 4 },
  boom: { source: boom, voices: 2 },
  fanfare: { source: fanfare, voices: 1 },
  bounce: { source: BOUNCE, voices: 4 },
  swish: { source: SWISH, voices: 3 },
};

interface Voices {
  play: (sound: Sound) => void;
  release: () => void;
}

function load(): Voices {
  // Mix with whatever else is playing, and respect the silent switch.
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(
    () => {},
  );
  const make = (sound: Sound) => {
    const { source, voices } = SOUNDS[sound];
    return { players: source === null ? [] : Array.from({ length: voices }, () => createAudioPlayer(source)), next: 0 };
  };
  const pools: Record<Sound, ReturnType<typeof make>> = {
    shoot: make('shoot'),
    pop: make('pop'),
    boom: make('boom'),
    fanfare: make('fanfare'),
    bounce: make('bounce'),
    swish: make('swish'),
  };
  return {
    play: (sound) => {
      const pool = pools[sound];
      if (pool.players.length === 0) return;
      const player = pool.players[pool.next % pool.players.length];
      pool.next++;
      if (!player) return;
      try {
        player.seekTo(0).catch(() => {});
        player.play();
      } catch {
        // A player that failed to load stays silent.
      }
    },
    release: () => {
      for (const { players } of Object.values(pools)) for (const p of players) p.remove();
    },
  };
}

/** A stable `play(sound)` for the life of the screen. Players are made on mount and freed on unmount. */
export function useSfx(): (sound: Sound) => void {
  const voices = useRef<Voices | null>(null);
  useEffect(() => {
    const v = load();
    voices.current = v;
    return () => {
      voices.current = null;
      v.release();
    };
  }, []);
  return useCallback((sound: Sound) => {
    if (appStore.getState().prefs.sound) voices.current?.play(sound);
  }, []);
}
