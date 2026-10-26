// Carrying a move between the two apps on one phone (SPEC 9). Metro picks transport.ios.ts or
// transport.android.ts. TypeScript reads this file for the shape both share, and any other
// platform gets this one, where nothing can move.
import type { MoveLink } from './link';

/** How a send went: Plus opened, Plus isn't on the phone, or the move couldn't be handed over. */
export type SendResult = 'opened' | 'not-installed' | 'failed';

/** A move as its link delivered it to Win Zero Plus: the id, and on Android the move itself. */
export type Delivery = Pick<Extract<MoveLink, { kind: 'import' }>, 't' | 'd'>;

export interface Transport {
  /** Win Zero: leave move `id` for Plus and open it. */
  send(id: string, payload: string): Promise<SendResult>;
  /** Win Zero Plus: the move a link delivered, or null when it can't be found. */
  receive(delivery: Delivery): string | null;
  /** Win Zero: Plus has taken move `id` from where it was left. */
  handedOver(id: string): boolean;
  /** Either app: clear away what's left of move `id`. */
  discard(id: string): void;
  /** Win Zero Plus: tell Win Zero that move `id` arrived. */
  acknowledge(id: string): Promise<void>;
}

export const transport: Transport = {
  send: async () => 'failed',
  receive: () => null,
  handedOver: () => false,
  discard: () => {},
  acknowledge: async () => {},
};
