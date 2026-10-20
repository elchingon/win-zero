// Win Zero Plus's home-screen icon (SPEC 9), native side: an activity-alias per icon on Android and
// an alternate icon on iPhone, both set up by the config plugin (plugin/withAppIcons.js). Only
// src/plus/appIcon.ts imports this. Win Zero links the native code too, but never calls it.
import { requireNativeModule } from 'expo';

interface AppIconsModule {
  /** This app can switch icons: it has some, and the phone allows it. */
  isSupportedAsync(): Promise<boolean>;
  /** The icon showing now, by name; null is the app's own icon. */
  getIconAsync(): Promise<string | null>;
  /** Shows `name`'s icon (null: the app's own) and resolves to it. Rejects a name the app doesn't have. */
  setIconAsync(name: string | null): Promise<string | null>;
}

export default requireNativeModule<AppIconsModule>('AppIcons');
