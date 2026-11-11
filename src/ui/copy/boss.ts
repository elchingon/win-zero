// Boss rounds' words (SPEC 4): the HUD's label and phase, what a screen reader hears as a phase
// breaks, and the result sheet's news. Shared by the app and the website.

export const BOSS_COPY = {
  /** The HUD's label: 'BOSS · DAY 30'. */
  hud: (day: number) => `BOSS · DAY ${day}`,
  /** Under it: 'PHASE 2 OF 3'. */
  phase: (phase: number, of: number) => `PHASE ${phase} OF ${of}`,
  /** Read out as a round opens on a boss. */
  intro: (day: number, phases: number) => `Day ${day} boss. ${phases} phases. Each one it loses throws off a ring of small zeros.`,
  /** Read out as a phase breaks: the ring is out, then the boss is open again. */
  broke: (phase: number, of: number) =>
    phase === of ? `Last phase. Clear the ring, then finish the boss.` : `Phase ${phase} of ${of}. Clear the ring to hit the boss again.`,
  /** The result sheet's news, first. */
  beat: (day: number) => `You beat the Day ${day} boss.`,
  /** In the share text: 'I beat the boss, …'. */
  share: 'beat the boss',
} as const;
