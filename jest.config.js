/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  globalSetup: '<rootDir>/jest.global-setup.js',
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/docs/'],
  modulePathIgnorePatterns: ['<rootDir>/docs/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
