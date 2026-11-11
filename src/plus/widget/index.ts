// Win Zero Plus's home-screen and lock-screen widgets (SPEC 9). _layout.tsx requires this behind the
// literal process.env.EXPO_PUBLIC_APP_VARIANT === 'plus', so Win Zero's bundle leaves it, and the
// widgets module's JavaScript, out.
export { startWidgetLinks } from './inbox';
export { widgetsNative } from './native';
export { startWidgetSync } from './sync';
