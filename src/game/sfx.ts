// The round's sound effects (made by scripts/gen-sfx.mjs from the prototype's synthesis). Each
// sound has a few players, played round-robin, so quick repeats overlap instead of cutting
// each other off. Quiet when the player has sound off, and under the silent switch.
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';

import { appStore } from '@/store';

import boom from '../../assets/sfx/boom.wav';
import pop from '../../assets/sfx/pop.wav';
import shoot from '../../assets/sfx/shoot.wav';

const SOUNDS = {
  shoot: { source: shoot, voices: 4 },
  pop: { source: pop, voices: 4 },
  boom: { source: boom, voices: 2 },
};

export type Sound = keyof typeof SOUNDS;

interface Voices {
  play: (sound: Sound) => void;
  release: () => void;
}

function load(): Voices {
  // Mix with whatever else is playing, and respect the silent switch.
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(
    () => {},
  );
  const make = (sound: Sound) => ({
    players: Array.from({ length: SOUNDS[sound].voices }, () => createAudioPlayer(SOUNDS[sound].source)),
    next: 0,
  });
  const pools = { shoot: make('shoot'), pop: make('pop'), boom: make('boom') };
  return {
    play: (sound) => {
      const pool = pools[sound];
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
