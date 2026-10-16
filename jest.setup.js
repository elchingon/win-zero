/* global jest -- jest provides it to setup files */
// AsyncStorage is a native module; jest-expo doesn't mock it.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// jest-expo reports Expo Go, so importing expo-notifications warns that remote push is gone
// from Expo Go. The app runs in a development build and uses local notifications only.
jest.mock('expo-notifications/build/warnOfExpoGoPushUsage', () => ({ warnOfExpoGoPushUsage: () => {} }));
