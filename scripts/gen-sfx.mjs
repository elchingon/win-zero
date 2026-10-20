#!/usr/bin/env node
// Renders the game's sound effects to assets/sfx/*.wav, porting the prototype's Web Audio
// synthesis (docs/prototype/win-zero.html, sfx()): the shot's falling square chirp, the pop
// of filtered noise, and the big boom (noise plus a sinking sine). Plus three the prototype
// doesn't have: the horn fanfare that brings up the encouragement after a round, and Win Zero
// Plus's game modes' bounce (a catch, a ball off the paddle) and swish (a blade). No
// dependencies; the noise is seeded, so running it again writes the same files.
//
//   node scripts/gen-sfx.mjs        (or: npm run gen:sfx)
import { Buffer } from 'node:buffer';
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

/** A band-pass biquad (RBJ cookbook, 0 dB peak, as Web Audio's) whose center follows `center(t)`. `q` is linear. */
function bandpass(q) {
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  return (x, freq) => {
    const w = (2 * Math.PI * Math.min(freq, RATE * 0.49)) / RATE;
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    const b0 = alpha / a0;
    const b2 = -alpha / a0;
    const a1 = (-2 * Math.cos(w)) / a0;
    const a2 = (1 - alpha) / a0;
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
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

/** A band-limited sawtooth: every harmonic at 1/k up to Nyquist, the buzz a brass tone starts from. */
function saw() {
  let phase = 0;
  return (freq) => {
    phase += (2 * Math.PI * freq) / RATE;
    let v = 0;
    for (let k = 1; k * freq < RATE / 2; k++) v += Math.sin(k * phase) / k;
    return (2 / Math.PI) * v;
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

// --- The fanfare (new, not in the prototype) ---------------------------------------------

const G4 = 392;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
/** Each horn is two saws this far apart, so it sounds like a section rather than one buzzer. */
const DETUNE_CENTS = 4;
const HORN_ATTACK_S = 0.015;
const HORN_RELEASE_S = 0.06;
/** A brass attack: the low-pass opens from 2x to 7x the note's pitch, then settles at 4x. */
const BLAT_OPEN_S = 0.04;
const BLAT_SETTLE_S = 0.12;
/** A gentle vibrato that eases in on held notes. */
const VIBRATO_HZ = 5.5;
const VIBRATO_DEPTH = 0.005;
const VIBRATO_IN_S = 0.15;
/** Kept under the boom's peak, so adding the fanfare doesn't change the other sounds' levels. */
const FANFARE_GAIN = 0.2;

/** One horn note from `start` for `length` seconds (plus its release), at `level`. */
function horn(freq, start, length, level) {
  const voices = [saw(), saw()];
  const spread = [2 ** (DETUNE_CENTS / 1200), 2 ** (-DETUNE_CENTS / 1200)];
  const filter = lowpass(DEFAULT_Q_DB);
  const open = expRamp(2, 7, BLAT_OPEN_S);
  const settle = expRamp(7, 4, BLAT_SETTLE_S);
  return (t) => {
    const u = t - start;
    if (u < 0 || u > length + HORN_RELEASE_S) return 0;
    const env = Math.min(1, u / HORN_ATTACK_S) * (u > length ? 1 - (u - length) / HORN_RELEASE_S : 1);
    const ease = Math.min(1, Math.max(0, (u - VIBRATO_IN_S) / VIBRATO_IN_S));
    const f = freq * (1 + VIBRATO_DEPTH * ease * Math.sin(2 * Math.PI * VIBRATO_HZ * u));
    const buzz = (voices[0](f * spread[0]) + voices[1](f * spread[1])) / 2;
    const cutoff = f * (u < BLAT_OPEN_S ? open(u) : settle(u - BLAT_OPEN_S));
    return filter(buzz, cutoff) * env * level;
  };
}

/** Ta-da-da-DAAA: G4, C5, E5 picked up quickly, then a C major chord that rings. */
function fanfare() {
  const notes = [
    horn(G4, 0, 0.08, 1),
    horn(C5, 0.1, 0.08, 1),
    horn(E5, 0.2, 0.08, 1),
    horn(C5, 0.3, 0.65, 0.8),
    horn(E5, 0.3, 0.65, 0.8),
    horn(G5, 0.3, 0.65, 0.8),
  ];
  return render(0.3 + 0.65 + HORN_RELEASE_S, (t) => notes.reduce((sum, note) => sum + note(t), 0) * FANFARE_GAIN);
}

// --- The game modes' sounds (new, not in the prototype) ----------------------------------

/** Bounce: a rubbery thunk, a sine sinking 420 → 190 Hz over 90 ms, over a faint low-passed click. */
const BOUNCE_GAIN = 0.24;
const BOUNCE_S = 0.15;
const BOUNCE_CLICK = 0.1;
const BOUNCE_CLICK_S = 0.012;
const BOUNCE_CLICK_HZ = 3000;

function bounce() {
  const osc = sine();
  const freq = expRamp(420, 190, 0.09);
  const gain = expRamp(BOUNCE_GAIN, 0.0001, BOUNCE_S - 0.01);
  const rand = noise(NOISE_SEED + 3);
  const filter = lowpass(DEFAULT_Q_DB);
  const click = expRamp(BOUNCE_CLICK, 0.0001, BOUNCE_CLICK_S);
  return render(BOUNCE_S, (t) => osc(freq(t)) * gain(t) + filter(rand(), BOUNCE_CLICK_HZ) * click(t));
}

/** Swish: noise through a band-pass sweeping 2600 → 700 Hz, swelling over 25 ms, gone by 0.22 s. */
const SWISH_GAIN = 0.42;
const SWISH_Q = 1.4;
const SWISH_RISE_S = 0.025;
const SWISH_S = 0.22;

function swish() {
  const rand = noise(NOISE_SEED + 2);
  const filter = bandpass(SWISH_Q);
  const center = expRamp(2600, 700, 0.18);
  const fade = expRamp(SWISH_GAIN, 0.0001, SWISH_S - SWISH_RISE_S - 0.005);
  return render(SWISH_S, (t) => filter(rand(), center(t)) * (t < SWISH_RISE_S ? (SWISH_GAIN * t) / SWISH_RISE_S : fade(t - SWISH_RISE_S)));
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

const peakOf = (samples) => samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

const sounds = { shoot: shoot(), pop: pop(), boom: boom(), fanfare: fanfare(), bounce: bounce(), swish: swish() };
for (const s of Object.values(sounds)) fadeEnds(s);
// The boom sets the shared scale. A louder sound would quietly change every other file.
for (const [name, samples] of Object.entries(sounds)) {
  if (name !== 'boom' && peakOf(samples) >= peakOf(sounds.boom)) {
    throw new Error(`The ${name} (peak ${peakOf(samples).toFixed(3)}) would outshout the boom; lower its gain.`);
  }
}
const loudest = Math.max(...Object.values(sounds).map(peakOf));
const scale = PEAK / loudest;
mkdirSync(OUT, { recursive: true });
for (const [name, samples] of Object.entries(sounds)) {
  const file = join(OUT, `${name}.wav`);
  writeFileSync(file, wav(samples, scale));
  const peak = peakOf(samples) * scale;
  console.log(`${name}.wav  ${(samples.length / RATE).toFixed(2)} s  peak ${peak.toFixed(3)}`);
}
