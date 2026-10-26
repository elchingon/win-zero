// Win Zero Plus's Xcode project builds Win Zero Plus. Xcode's build scripts bundle the JavaScript
// (expo export:embed) and embed the app config (expo-constants), and both read
// EXPO_PUBLIC_APP_VARIANT (app.config.ts). A build started in Xcode doesn't have the shell's
// environment, so without this, a Release build of Plus made in Xcode ran Win Zero's JavaScript
// inside Plus's app. Each of those scripts sources ios/.xcode.env first, so the variant is pinned
// there. Only Plus uses this plugin (PLUS_ONLY_PLUGINS in app.config.ts): Win Zero's project never
// sets the variable. EAS profiles set it anyway, so there it says the same thing twice.
// Plain CommonJS, so the Expo CLI loads it as it is.
const fs = require('node:fs');
const path = require('node:path');

const ENV_FILE = '.xcode.env';
const COMMENT = "# Win Zero Plus (app.config.ts): Xcode's build scripts bundle this app's JavaScript and config.";
const PIN = 'export EXPO_PUBLIC_APP_VARIANT=plus';
/** Lines this plugin owns: any that set the variant, and its comment. */
const OWNED = /^\s*(?:export\s+)?EXPO_PUBLIC_APP_VARIANT=|^# Win Zero Plus \(app\.config\.ts\):/;
/** What the Expo template's .xcode.env would say, if the file has gone. */
const NODE_LINE = 'export NODE_BINARY=$(command -v node)';

/** .xcode.env with the variant pinned to Plus: once, at the end, whatever it said before. */
function pinVariant(text) {
  const kept = text.split('\n').filter((line) => !OWNED.test(line));
  while (kept.length > 0 && kept[kept.length - 1].trim() === '') kept.pop();
  return [...kept, ...(kept.length > 0 ? [''] : []), COMMENT, PIN, ''].join('\n');
}

/** @param {import('expo/config').ExpoConfig} config */
function withXcodeVariant(config) {
  // Loaded here, so pinVariant can be tested without the CLI's dependencies.
  const { withDangerousMod } = require('expo/config-plugins');
  return withDangerousMod(config, [
    'ios',
    async (c) => {
      const file = path.join(c.modRequest.platformProjectRoot, ENV_FILE);
      const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : `${NODE_LINE}\n`;
      fs.writeFileSync(file, pinVariant(text));
      return c;
    },
  ]);
}

module.exports = withXcodeVariant;
module.exports.pinVariant = pinVariant;
