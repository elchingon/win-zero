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
]);
