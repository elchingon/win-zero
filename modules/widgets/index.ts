// Win Zero Plus's widgets' native side (SPEC 9): it saves the snapshot the widgets draw from and
// asks them to redraw. src/plus/widget/native.ts is the only importer. Null on the web, in tests,
// and in a development build made before this module, where the widgets simply aren't there.
import { requireOptionalNativeModule } from 'expo';

export interface WidgetsModule {
  /**
   * Saves `json` (a WidgetSnapshot) where the widgets read it, then has them redraw. On iPhone it
   * goes in the App Group `group`'s folder, which the widget extension shares; on Android, in the
   * app's own files, and each widget sets an alarm for its next frame.
   */
  setSnapshotAsync(json: string, group: string): Promise<void>;
}

export default requireOptionalNativeModule<WidgetsModule>('WinZeroWidgets');
