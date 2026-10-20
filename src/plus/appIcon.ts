// Win Zero Plus's home-screen icon (SPEC 9): the app's own or a theme's. The phone remembers which
// one is showing, so the app never stores it. Plus-only: require this behind the literal
// process.env.EXPO_PUBLIC_APP_VARIANT === 'plus', so Win Zero's bundle leaves it and the native
// module's JavaScript out.
import { DEFAULT_ICON, isAppIconId, type AppIconId } from '@/engine/icons';

import AppIcons from '../../modules/app-icons';

/** Whether this phone can switch the icon (always on Android; on iPhone, as iOS says). */
export function iconSwitching(): Promise<boolean> {
  return AppIcons.isSupportedAsync();
}

/** The icon on the home screen now. */
export async function currentIcon(): Promise<AppIconId> {
  const name = await AppIcons.getIconAsync();
  return name !== null && isAppIconId(name) ? name : DEFAULT_ICON;
}

/**
 * Puts `id`'s icon on the home screen, and resolves to the icon showing afterwards. iOS tells the
 * user it changed; Android closes the app if it was opened from the icon being replaced.
 */
export async function setIcon(id: AppIconId): Promise<AppIconId> {
  await AppIcons.setIconAsync(id === DEFAULT_ICON ? null : id);
  return currentIcon();
}
