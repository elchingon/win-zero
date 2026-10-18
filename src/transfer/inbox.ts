// Where a move's link waits for the app (SPEC 9). +native-intent reads links before React and
// the store are ready, so it leaves a move's link here rather than in the route: Win Zero Plus's
// /import reads a delivery, and Win Zero acts on Plus's confirmation once storage has been read.
import type { AppStore } from '@/store/createAppStore';
import { whenHydrated } from '@/store/lifecycle';

import type { MoveLink } from './link';
import type { Delivery, Transport } from './transport';

export interface PendingImport extends Delivery {
  /** Counts deliveries, so the same link arriving again still reads as new. */
  seq: number;
}

let pendingImport: PendingImport | null = null;
let pendingAcks: string[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function deliver(link: MoveLink): void {
  if (link.kind === 'import') pendingImport = { t: link.t, d: link.d, seq: ++seq };
  else pendingAcks = [...pendingAcks, link.t];
  notify();
}

/** Win Zero Plus: the move waiting to be taken in, if one is. */
export const importDelivery = (): PendingImport | null => pendingImport;

export function clearImport(): void {
  if (!pendingImport) return;
  pendingImport = null;
  notify();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Win Zero: act on Plus's confirmations, once storage has been read and only for a move that has
 * left where it was put. On iPhone only an app in the group can take it, so a link alone can't
 * stop this app's reminders. Returns a cleanup.
 */
export function startMoveAcks(store: AppStore, transport: Pick<Transport, 'handedOver'>): () => void {
  const waits: (() => void)[] = [];
  const take = () => {
    const acks = pendingAcks;
    pendingAcks = [];
    for (const t of acks) {
      waits.push(
        whenHydrated(store, () => {
          if (transport.handedOver(t)) store.getState().confirmMovedOut(t);
        }),
      );
    }
  };
  take(); // one that arrived with the launch
  const unsubscribe = subscribe(take);
  return () => {
    unsubscribe();
    waits.forEach((stop) => stop());
  };
}
