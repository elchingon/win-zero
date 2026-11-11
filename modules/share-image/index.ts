// Android's share sheet for a file (Win Zero Plus's share card, SPEC 9; src/plus/share/send.ts is the
// only importer). React Native's Share takes a file only on iPhone, where it shares the card itself.
// Null on iPhone, the web, in tests, and in a development build made before this module, where the
// card falls back to the text share.
import { requireOptionalNativeModule } from 'expo';

export interface ShareImageModule {
  /**
   * Opens the share sheet for the file at `uri`, a content URI the app can grant (expo-file-system's
   * File.contentUri), of type `mimeType`, under `title`. Resolves once the sheet is up.
   */
  shareAsync(uri: string, mimeType: string, title: string): Promise<void>;
}

export default requireOptionalNativeModule<ShareImageModule>('ShareImage');
