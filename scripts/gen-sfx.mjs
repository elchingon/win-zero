#!/usr/bin/env node
// Renders the game's sound effects to assets/sfx/*.wav, porting the prototype's Web Audio
// synthesis (docs/prototype/win-zero.html, sfx()): the shot's falling square chirp, the pop
// of filtered noise, and the big boom (noise plus a sinking sine). No dependencies; the noise
// is seeded, so running it again writes the same files.
//
//   node scripts/gen-sfx.mjs        (or: npm run gen:sfx)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sfx');
/** The loudest sample across all the sounds lands here, keeping their relative levels. */
const PEAK = 0.89;
/** Short fades at the very ends, so nothing clicks. */
const FADE_IN_S = 0.001;
const FADE_OUT_S = 0.004;
/** Web Audio's default biquad Q, in dB. */
const DEFAULT_Q_DB = 1;
const NOISE_SEED = 0x5eed;

/** Web Audio's exponentialRampToValueAtTime from `from` at 0 to `to` at `end`, holding after. */
const expRamp = (from, to, end) => (t) => (t >= end ? to : from * (to / from) ** (t / end));

/** A seeded uniform noise source in [-1, 1) (mulberry32). */
function noise(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

/** A low-pass biquad (RBJ cookbook, as Web Audio's) whose cutoff follows `cutoff(t)`. */
function lowpass(qDb) {
  const q = 10 ** (qDb / 20);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  return (x, freq) => {
    const w = (2 * Math.PI * Math.min(freq, RATE * 0.49)) / RATE;
    const alpha = Math.sin(w) / (2 * q);
    const cos = Math.cos(w);
    const a0 = 1 + alpha;
    const b0 = (1 - cos) / 2 / a0;
    const b1 = (1 - cos) / a0;
    const b2 = b0;
    const a1 = (-2 * cos) / a0;
    const a2 = (1 - alpha) / a0;
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  };
}

/** A band-limited square wave: odd harmonics up to Nyquist, so the chirp doesn't alias. */
function square() {
  let phase = 0;
  return (freq) => {
    phase += (2 * Math.PI * freq) / RATE;
    let v = 0;
    for (let k = 1; k * freq < RATE / 2; k += 2) v += Math.sin(k * phase) / k;
    return (4 / Math.PI) * v;
  };
}

function sine() {
  let phase = 0;
  return (freq) => {
    phase += (2 * Math.PI * freq) / RATE;
    return Math.sin(phase);
  };
}

function render(seconds, sample) {
  const out = new Float64Array(Math.round(seconds * RATE));
  for (let i = 0; i < out.length; i++) out[i] = sample(i / RATE);
  return out;
}

// --- The sounds, as in the prototype ------------------------------------------------------

/** Square 900 → 180 Hz over 80 ms, gain 0.04 fading out over 90 ms. */
function shoot() {
  const osc = square();
  const freq = expRamp(900, 180, 0.08);
  const gain = expRamp(0.04, 0.0001, 0.09);
  return render(0.1, (t) => osc(freq(t)) * gain(t));
}

/** Noise through a low-pass sweeping 1800 → 200 Hz over 0.3 s, gain 0.35 fading over 0.32 s. */
function pop() {
  const rand = noise(NOISE_SEED);
  const filter = lowpass(DEFAULT_Q_DB);
  const cutoff = expRamp(1800, 200, 0.3);
  const gain = expRamp(0.35, 0.0001, 0.32);
  return render(0.35, (t) => filter(rand(), cutoff(t)) * gain(t));
}

/** Noise low-passed 2400 → 60 Hz over 1.4 s (gain 0.9 over 1.5 s), plus a 90 → 30 Hz sine (gain 0.6 over 1.3 s). */
function boom() {
  const rand = noise(NOISE_SEED + 1);
  const filter = lowpass(DEFAULT_Q_DB);
  const cutoff = expRamp(2400, 60, 1.4);
  const gain = expRamp(0.9, 0.0001, 1.5);
  const osc = sine();
  const freq = expRamp(90, 30, 1.2);
  const thump = expRamp(0.6, 0.0001, 1.3);
  return render(1.5, (t) => filter(rand(), cutoff(t)) * gain(t) + (t < 1.3 ? osc(freq(t)) * thump(t) : 0));
}

// --- Output ---------------------------------------------------------------------------------

function fadeEnds(samples) {
  const fadeIn = Math.round(FADE_IN_S * RATE);
  const fadeOut = Math.round(FADE_OUT_S * RATE);
  for (let i = 0; i < fadeIn && i < samples.length; i++) samples[i] *= i / fadeIn;
  for (let i = 0; i < fadeOut && i < samples.length; i++) samples[samples.length - 1 - i] *= i / fadeOut;
  return samples;
}

/** 16-bit mono PCM WAV. */
function wav(samples, scale) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i] * scale));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const sounds = { shoot: shoot(), pop: pop(), boom: boom() };
for (const s of Object.values(sounds)) fadeEnds(s);
const loudest = Math.max(...Object.values(sounds).map((s) => s.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));
const scale = PEAK / loudest;
mkdirSync(OUT, { recursive: true });
for (const [name, samples] of Object.entries(sounds)) {
  const file = join(OUT, `${name}.wav`);
  writeFileSync(file, wav(samples, scale));
  const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0) * scale;
  console.log(`${name}.wav  ${(samples.length / RATE).toFixed(2)} s  peak ${peak.toFixed(3)}`);
}
