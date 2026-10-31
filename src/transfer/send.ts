// Win Zero's side of a move to Win Zero Plus (SPEC 9): build the move, hand it over, and fall back
// to Plus's store page when Plus isn't on the phone. The Move screen and Home's cards call these.
import Constants from 'expo-constants';

import { appStore, type AppStore } from '@/store';
import { openOr, openPage } from '@/ui/support';
import { PEER, PLUS_STORE_URL } from '@/variant';

import { MoveCodecError } from './codec';
import { makeMove } from './envelope';
import { transport, type SendResult } from './transport';

export type MoveOutResult = SendResult | 'too-large';

/**
 * Send the move and open Plus. A try after the first has the same id, so Plus adds the credits
 * once. A first try that went nowhere leaves nothing behind; a later one leaves the earlier one
 * waiting, as it may have arrived.
 */
export async function sendMoveOut(store: AppStore = appStore): Promise<MoveOutResult> {
  const retry = store.getState().moveOut?.status === 'sent';
  const id = store.getState().startMoveOut();
  if (!id) return 'failed';
  const undo = () => {
    if (!retry) store.getState().cancelMoveOut();
  };
  let payload: string;
  try {
    const s = store.getState();
    payload = makeMove({ id, now: s.now(), appVersion: Constants.expoConfig?.version ?? '', state: s });
  } catch (error) {
    undo();
    return error instanceof MoveCodecError && error.reason === 'too-large' ? 'too-large' : 'failed';
  }
  const result = await transport.send(id, payload);
  if (result === 'opened') return result;
  undo();
  if (result === 'not-installed') openPlusStore();
  return result;
}

/** Open Win Zero Plus's store page. */
export function openPlusStore(): void {
  if (PLUS_STORE_URL) openPage(PLUS_STORE_URL);
}

/** Open Win Zero Plus, or its store page when it isn't on the phone. */
export function openPlus(): void {
  openOr(`${PEER.scheme}://`, openPlusStore);
}

/** Win Zero: the user says the move finished. Reminders stop here, as when Plus confirms. */
export function confirmMoveByHand(store: AppStore = appStore): void {
  const id = store.getState().moveOut?.id;
  if (id && store.getState().confirmMovedOut(id)) transport.discard(id);
}

/** Win Zero: stop waiting on a move, and clear away what was left for Plus. */
export function cancelMove(store: AppStore = appStore): void {
  const id = store.getState().moveOut?.id;
  store.getState().cancelMoveOut();
  if (id) transport.discard(id);
}
