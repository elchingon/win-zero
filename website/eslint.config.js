// Lint for the website. The shared app code under ../src is linted by the app's own config.
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    extends: [reactHooks.configs.flat['recommended-latest']],
    rules: {
      // The website runs in a browser: native packages can't load (plugins/shared-guard.ts
      // also stops the build).
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react-native', 'react-native-*', '@react-native/*'], message: 'Native-only; the website is plain React.' },
            { group: ['expo', 'expo-*', '@expo/*'], message: 'Native-only; the website is plain React.' },
          ],
        },
      ],
    },
  },
  {
    files: ['plugins/**', 'scripts/**', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
]);
