/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  globalSetup: '<rootDir>/jest.global-setup.js',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/src/**/*.test.ts?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/docs/'],
  // website/ is its own package, tested with Vitest.
  // .ios-parked/ holds the other app's Xcode project (scripts/prebuild.mjs), Pods and all.
  modulePathIgnorePatterns: ['<rootDir>/docs/', '<rootDir>/website/', '<rootDir>/.ios-parked/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
