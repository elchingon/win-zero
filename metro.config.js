// Expo's Metro config, plus one thing: release bundles inline EXPO_PUBLIC_* values as literals,
// and Metro's transform cache doesn't key on them. So a local release build could reuse JS
// inlined for the other app (Win Zero vs Win Zero Plus, see app.config.ts) or for another
// profile's URLs. Keying the cache on those values rebuilds what changed. EAS builds start with an
// empty cache either way.
const crypto = require('node:crypto');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const publicEnv = Object.keys(process.env)
  .filter((name) => name.startsWith('EXPO_PUBLIC_'))
  .sort()
  .map((name) => `${name}=${process.env[name]}`)
  .join('\n');
config.cacheVersion = crypto.createHash('sha256').update(publicEnv).digest('hex').slice(0, 16);

module.exports = config;
