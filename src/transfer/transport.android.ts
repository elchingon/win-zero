// Android: the move travels in the link, by an intent aimed at the other app's own package and
// activity, so no other app can receive it, and sending needs no <queries> entry. The launch
// is never awaited for its result: Android refuses it at once when the app isn't installed.
import { startActivityAsync } from 'expo-intent-launcher';

import { PEER } from '@/variant';

import { importLink, movedLink } from './link';
import type { SendResult, Transport } from './transport';

const VIEW = 'android.intent.action.VIEW';
/**
 * Intent.FLAG_ACTIVITY_NEW_TASK: the other app opens in its own task, and Android answers the
 * launch straight away, so intent-launcher isn't left waiting on a result that never comes.
 */
const FLAG_ACTIVITY_NEW_TASK = 0x10000000;
/** How long a launch has to be refused before it counts as opened. */
export const LAUNCH_SETTLE_MS = 1500;

/** Open `url` in the other app: refused means it isn't installed. */
function launch(url: string): Promise<SendResult> {
  return new Promise((resolve) => {
    const settled = setTimeout(() => resolve('opened'), LAUNCH_SETTLE_MS);
    const done = (result: SendResult) => {
      clearTimeout(settled);
      resolve(result);
    };
    Promise.resolve()
      .then(() =>
        startActivityAsync(VIEW, { packageName: PEER.package, className: PEER.activity, data: url, flags: FLAG_ACTIVITY_NEW_TASK }),
      )
      .then(
        () => done('opened'),
        () => done('not-installed'),
      );
  });
}

export const transport: Transport = {
  send: (id, payload) => launch(importLink(PEER.scheme, id, payload)),
  receive: ({ d }) => d,
  handedOver: () => true,
  discard: () => {},
  async acknowledge(id) {
    await launch(movedLink(PEER.scheme, id));
  },
};
