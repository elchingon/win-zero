/* global jest -- jest provides it to setup files */
// AsyncStorage is a native module; jest-expo doesn't mock it.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// jest-expo reports Expo Go, so importing expo-notifications warns that remote push is gone
// from Expo Go. The app runs in a development build and uses local notifications only.
jest.mock('expo-notifications/build/warnOfExpoGoPushUsage', () => ({ warnOfExpoGoPushUsage: () => {} }));
// Win Zero Plus's app-icons module is native: a stand-in that remembers the icon, and refuses a
// name the app doesn't have, as the real one does.
jest.mock('./modules/app-icons', () => {
  const NAMES = ['classic', 'neon', 'mono', 'pastel', 'ember', 'aurora', 'gold'];
  let icon = null;
  return {
    __esModule: true,
    default: {
      isSupportedAsync: jest.fn(async () => true),
      getIconAsync: jest.fn(async () => icon),
      setIconAsync: jest.fn(async (name) => {
        if (name !== null && !NAMES.includes(name)) throw new Error(`This app has no icon named "${name}".`);
        icon = name;
        return name;
      }),
    },
  };
});
