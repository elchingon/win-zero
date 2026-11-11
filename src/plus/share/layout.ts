// The share card's layout (SPEC 9), in points: the round's fill on top, and a panel under it with
// the day, "N zeros down", what the round did and the app's name. Pure: text is measured by the
// caller's fonts, so the words always fit, however long a power-up's name.
import type { CardWords } from './words';

/** The card: 4:5, drawn at 3× for a 1080 × 1350 image. The fill takes the top, the words the panel. */
export const CARD = { width: 360, height: 450, scale: 3, fill: 280 } as const;
/** The panel's side margins, and where its lines sit, in points. */
export const CARD_PAD = 24;
const DAY_SIZE = 34;
const ZEROS_SIZE = 18;
const DID_SIZE = 14;
const DID_LINE = 19;
const DID_LINES = 3;
const FOOTER_SIZE = 10;
const DAY_BASELINE = CARD.fill + 46;
const ZEROS_BASELINE = DAY_BASELINE + 28;
const DID_BASELINE = ZEROS_BASELINE + 24;
const FOOTER_BASELINE = CARD.height - 14;

export type CardFont = 'display' | 'body' | 'mono';
export type CardColor = 'amber' | 'fg' | 'muted';

export interface CardLine {
  text: string;
  font: CardFont;
  size: number;
  color: CardColor;
  /** Where its baseline starts, in points. */
  x: number;
  y: number;
}

/** A line of text's width at a size, in points. */
export type Measure = (text: string, font: CardFont, size: number) => number;

/** `text` in lines no wider than `width`, broken between words; at most `max`, the last cut short with an ellipsis. */
export function wrap(text: string, width: number, measure: (t: string) => number, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  let last = `${kept[max - 1] ?? ''}…`;
  while (last.length > 1 && measure(last) > width) last = `${last.slice(0, -2)}…`;
  kept[max - 1] = last;
  return kept;
}

/** The size, up to `size`, that fits `text` in `width`. */
function fit(text: string, font: CardFont, size: number, width: number, measure: Measure): number {
  const w = measure(text, font, size);
  return w > width ? (size * width) / w : size;
}

/** Every line of the panel, where it goes. */
export function cardLayout(words: CardWords, measure: Measure): CardLine[] {
  const width = CARD.width - 2 * CARD_PAD;
  const lines: CardLine[] = [
    { text: words.day, font: 'display', size: fit(words.day, 'display', DAY_SIZE, width, measure), color: 'amber', x: CARD_PAD, y: DAY_BASELINE },
    { text: words.zeros, font: 'body', size: fit(words.zeros, 'body', ZEROS_SIZE, width, measure), color: 'fg', x: CARD_PAD, y: ZEROS_BASELINE },
  ];
  if (words.did) {
    wrap(words.did, width, (t) => measure(t, 'body', DID_SIZE), DID_LINES).forEach((text, i) => {
      lines.push({ text, font: 'body', size: DID_SIZE, color: 'muted', x: CARD_PAD, y: DID_BASELINE + i * DID_LINE });
    });
  }
  lines.push({
    text: words.footer,
    font: 'mono',
    size: fit(words.footer, 'mono', FOOTER_SIZE, width, measure),
    color: 'muted',
    x: CARD_PAD,
    y: FOOTER_BASELINE,
  });
  return lines;
}
