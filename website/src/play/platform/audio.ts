// The round's sound effects on the web: the phone app's own WAVs (scripts/gen-sfx.mjs), played
// through Web Audio. Each sound has a few voices; a quick repeat past them cuts off the oldest,
// as the app's round-robin players do. Browsers only start audio after a tap, so the context
// resumes on the first press.
import boom from '@assets/sfx/boom.wav?url';
import pop from '@assets/sfx/pop.wav?url';
import shoot from '@assets/sfx/shoot.wav?url';

const SOUNDS = {
  shoot: { url: shoot, voices: 4 },
  pop: { url: pop, voices: 4 },
  boom: { url: boom, voices: 2 },
} as const;

export type Sound = keyof typeof SOUNDS;

let context: AudioContext | null = null;
const buffers = new Map<Sound, AudioBuffer>();
const playing = new Map<Sound, AudioBufferSourceNode[]>();
let loading: Promise<void> | null = null;

function audioContext(): AudioContext | null {
  if (context) return context;
  const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  // Mix with other audio, and stay quiet under iOS's silent switch, as the app does.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = 'ambient';
  context = new Ctor();
  return context;
}

/** Fetch and decode the sounds, once. */
export function loadSounds(): Promise<void> {
  const ctx = audioContext();
  if (!ctx) return Promise.resolve();
  loading ??= Promise.all(
    (Object.keys(SOUNDS) as Sound[]).map(async (sound) => {
      try {
        const data = await (await fetch(SOUNDS[sound].url)).arrayBuffer();
        buffers.set(sound, await ctx.decodeAudioData(data));
      } catch {
        // A sound that won't load stays silent.
      }
    }),
  ).then(() => undefined);
  return loading;
}

/** Call from a tap or key press: browsers keep audio suspended until one. */
export function resumeAudio(): void {
  const ctx = audioContext();
  if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => {});
}

export function playSound(sound: Sound): void {
  const ctx = context;
  const buffer = buffers.get(sound);
  if (!ctx || !buffer || ctx.state !== 'running') return;
  const voices = playing.get(sound) ?? [];
  if (voices.length >= SOUNDS[sound].voices) {
    const oldest = voices.shift();
    try {
      oldest?.stop();
    } catch {
      // Already finished.
    }
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.onended = () => {
    const list = playing.get(sound);
    const i = list?.indexOf(source) ?? -1;
    if (list && i >= 0) list.splice(i, 1);
  };
  voices.push(source);
  playing.set(sound, voices);
  source.start();
}
