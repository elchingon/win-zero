// iPhone: the move waits in the folder only the two apps share (the App Group in app.json), and
// the link that opens Plus carries only its id, so an app that claims the scheme learns nothing.
// A development build without the group (one made before it) puts the move in the link instead,
// and Plus accepts that in development only.
import { File, Paths } from 'expo-file-system';
import { Linking } from 'react-native';

import { APP_GROUP, PEER } from '@/variant';

import { importLink, movedLink } from './link';
import type { Transport } from './transport';

/** Where move `id` waits, or null without the shared folder. The id can't name another file. */
function fileFor(id: string): File | null {
  const shared = Paths.appleSharedContainers[APP_GROUP];
  return shared ? new File(shared, `move-${id}.wz1`) : null;
}

function discard(id: string): void {
  try {
    const file = fileFor(id);
    if (file?.exists) file.delete();
  } catch {
    // Already gone, or nothing more to be done.
  }
}

export const transport: Transport = {
  async send(id, payload) {
    let file: File | null;
    try {
      file = fileFor(id);
      file?.create({ overwrite: true });
      file?.write(payload);
    } catch {
      return 'failed';
    }
    if (!file && !__DEV__) return 'failed';
    try {
      await Linking.openURL(importLink(PEER.scheme, id, file ? undefined : payload));
      return 'opened';
    } catch {
      discard(id); // Plus isn't here to take it
      return 'not-installed';
    }
  },

  receive({ t, d }) {
    if (__DEV__ && d) return d;
    try {
      const file = fileFor(t);
      return file?.exists ? file.textSync() : null;
    } catch {
      return null;
    }
  },

  // Only an app in the group can take the file, so a link alone can't stop Win Zero's reminders.
  handedOver(id) {
    try {
      return !fileFor(id)?.exists;
    } catch {
      return false;
    }
  },

  discard,

  async acknowledge(id) {
    await Linking.openURL(movedLink(PEER.scheme, id)).catch(() => {});
  },
};
