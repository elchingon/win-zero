// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'docs/*', '.expo/*'],
  },
  {
    // The rules engine is pure: no UI or platform imports, and `now` is always injected.
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-*', 'react/*'], message: 'src/engine must stay free of React.' },
            { group: ['expo', 'expo-*', '@expo/*'], message: 'src/engine must stay free of Expo.' },
            { group: ['@/*', '@shopify/*', 'zustand', 'zustand/*'], message: 'src/engine imports only engine modules and date libraries.' },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Pass `now` in; the engine never reads the clock.',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Pass `now` in; the engine never reads the clock.',
        },
      ],
    },
  },
  {
    // The game sim runs on the UI thread as worklets: plain data in, no platform imports, no
    // clock or Math.random (the seeded generator lives in the state), and no use before
    // definition, because the worklets plugin turns function declarations into constants.
    files: ['src/game/sim/**/*.ts'],
    ignores: ['src/game/sim/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-*', 'react/*'], message: 'src/game/sim must stay free of React.' },
            { group: ['expo', 'expo-*', '@expo/*'], message: 'src/game/sim must stay free of Expo.' },
            {
              group: ['@/*', '!@/engine', '!@/engine/*', '@shopify/*', 'zustand', 'zustand/*'],
              message: 'src/game/sim imports only sim modules and the engine.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'The sim takes dt; it never reads the clock.',
        },
        { selector: "NewExpression[callee.name='Date']", message: 'The sim takes dt; it never reads the clock.' },
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: 'Use the seeded generator in the game state (rng.ts).',
        },
        {
          selector: "CallExpression[callee.object.name='performance'][callee.property.name='now']",
          message: 'The sim takes dt; it never reads the clock.',
        },
        { selector: 'ClassDeclaration', message: 'Worklets can’t carry classes to the UI thread; use plain objects.' },
      ],
      '@typescript-eslint/no-use-before-define': [
        'error',
        { functions: true, classes: true, variables: true, typedefs: false, ignoreTypeReferences: true },
      ],
    },
  },
]);
