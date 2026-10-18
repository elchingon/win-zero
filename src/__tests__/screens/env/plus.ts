// Imported first by a screen test, before the app reads its environment: the app is Win Zero
// Plus (src/variant), with its store page set. Jest gives each test file its own environment.
process.env.EXPO_PUBLIC_APP_VARIANT = 'plus';
process.env.EXPO_PUBLIC_PLUS_STORE_URL_IOS = 'https://apps.apple.com/app/id1234567890';
