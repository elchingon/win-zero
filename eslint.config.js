// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // website/ has its own lint config.
    ignores: ['dist/*', 'docs/*', '.expo/*', 'website/*'],
  },
  {
    // Win Zero Plus's own code (src/plus) is required only where it's gated on the variant, with
    // the literal comparison release builds fold, so the free bundle leaves it out. A static import
    // would pull it into both apps.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/plus/**', 'src/**/__tests__/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/plus', '@/plus/*'],
              message: "Plus-only code: require it behind process.env.EXPO_PUBLIC_APP_VARIANT === 'plus'.",
            },
          ],
        },
      ],
    },
  },
  {
    // Shared with the website (the same list as website/plugins/shared-guard.ts): pure TypeScript
    // that runs in a browser too. Skia is allowed for types only, which the website stands in for.
    files: [
      'src/engine/**/*.ts',
      'src/game/sim/**/*.ts',
      'src/game/draw/**/*.ts',
      'src/game/cues.ts',
      'src/game/look.ts',
      'src/game/result.ts',
      'src/game/shareText.ts',
      'src/store/createAppStore.ts',
      'src/store/migrate.ts',
      'src/store/notice.ts',
      'src/store/types.ts',
      'src/store/id.ts',
      'src/store/lifecycle.ts',
      'src/lib/format.ts',
      'src/lib/calendar.ts',
      'src/theme/tokens.ts',
      'src/ui/home/stakes.ts',
      'src/ui/home/routing.ts',
      'src/ui/copy/**/*.ts',
      'src/dev/seedRun.ts',
      'src/dev/demo.ts',
    ],
    ignores: ['src/**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            { regex: '^(react|react-dom|react-native)(/.*)?$', message: 'Shared with the website: no React or React Native.' },
            { regex: '^(react-native-|@react-native)', message: 'Shared with the website: no React Native packages.' },
            { regex: '^(expo|expo-[^/]+|@expo/.+)(/.*)?$', message: 'Shared with the website: no Expo.' },
            {
              regex: '^@shopify/',
              allowTypeImports: true,
              message: 'Shared with the website: Skia for types only (`import type`).',
            },
            {
              regex: '^@/(variant|plus)(/.*)?$',
              message: 'Shared with the website: never ask which app this is; take names and limits as parameters.',
            },
          ],
        },
      ],
      // The website's bundle has no process.env, and the variant must come in as a parameter.
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'Shared with the website: take the value as a parameter.' },
      ],
    },
  },
  {
    // jest.mock factories load their stand-ins with require(), which is how jest expects it.
    files: ['src/**/__tests__/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
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
    // The game sim runs on the UI thread as worklets: plain data in, no platform imports.
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
    },
  },
  {
    // Sim and scene drawing both run as worklets: no clock or Math.random (the seeded generator
    // lives in the game state), no classes, and no use before definition, because the worklets
    // plugin turns function declarations into constants captured when the module loads.
    files: ['src/game/sim/**/*.ts', 'src/game/draw/**/*.ts'],
    ignores: ['src/game/*/__tests__/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Worklets take dt; they never read the clock.',
        },
        { selector: "NewExpression[callee.name='Date']", message: 'Worklets take dt; they never read the clock.' },
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: 'Use the seeded generator in the game state (sim/rng.ts).',
        },
        {
          selector: "CallExpression[callee.object.name='performance'][callee.property.name='now']",
          message: 'Worklets take dt; they never read the clock.',
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
