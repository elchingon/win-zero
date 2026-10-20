'worklet';
// The per-frame summary the sim sends to the JS thread (HUD counter, sounds, haptics, result).
import type { Report } from './types';

export function makeReport(valueLeft: number, seed: number): Report {
  return {
    seed,
    dirty: true,
    valueLeft,
    shots: 0,
    hits: 0,
    kills: 0,
    armoredKills: 0,
    blasts: 0,
    bombs: 0,
    bounces: 0,
    swishes: 0,
    final: false,
    showResult: false,
  };
}

/** Start the next frame's report. The seed and valueLeft carry over; the counts start again. */
export function resetReport(report: Report): void {
  report.dirty = false;
  report.shots = 0;
  report.hits = 0;
  report.kills = 0;
  report.armoredKills = 0;
  report.blasts = 0;
  report.bombs = 0;
  report.bounces = 0;
  report.swishes = 0;
  report.final = false;
  report.showResult = false;
}
