// The encouragement that pops up over the zeros when a round lands, before the result sheet:
// one line to carry into the next check-in. Some sincere, some cheeky, all supportive. No
// drinking slang and nothing about losing a streak: some people here are working on sobriety.
// Shared by the app and the website.

export const CHEERS: readonly string[] = [
  "You kept a promise to yourself today. That's no small thing.",
  "Today's you came through. Tomorrow's you says thanks.",
  'Be proud of this one. Stay strong till your next check-in.',
  "Strong today, strong tomorrow. You've got this.",
  'Every zero is a day you chose yourself.',
  'Progress is quiet most days. Today it went boom.',
  'Small steps still move you forward. Keep stepping.',
  'Whatever tomorrow brings, today still counts.',
  "You're a total zero, and we mean that as a compliment.",
  'Nothing to see here. Just you, quietly winning.',
  'Zero to hero, one check-in at a time.',
  'Keep calm and zero on.',
  "That's a whole lot of nothing, and it looks great on you.",
  'Nice aim. Keep it on the goal until your next check-in.',
  "Stick to your guns. Tomorrow's zero is waiting.",
  'Count your zeros, not your worries.',
  'Mathematically, a zero adds nothing. Yours add everything.',
  "Your zeros called. They'd love some company tomorrow.",
  'Big boom energy. Carry it into tomorrow.',
  'Plot twist: nothing has never felt this good.',
];

function shuffled(lines: readonly string[], random: () => number): string[] {
  const out = [...lines];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * The next line, each call: every line once in a random order, then a fresh shuffle. A new
 * shuffle never opens with the line the last one ended on, so no line shows twice in a row.
 */
export function cheerDeck(random: () => number = Math.random): () => string {
  let deck: string[] = [];
  let next = 0;
  return () => {
    if (next >= deck.length) {
      const last = deck[deck.length - 1];
      deck = shuffled(CHEERS, random);
      if (deck.length > 1 && deck[0] === last) [deck[0], deck[1]] = [deck[1]!, deck[0]!];
      next = 0;
    }
    return deck[next++]!;
  };
}
