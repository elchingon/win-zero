// Release guard, run by EAS before every build (the eas-build-pre-install npm script).
// - A profile ending in -plus builds Win Zero Plus, and only those do: each sets
//   EXPO_PUBLIC_APP_VARIANT=plus in its env (eas.json), so a profile that forgot it, or a free one
//   that picked it up, stops here instead of building the wrong app.
// - A production build (production, production-plus) stops unless the privacy and support pages
//   are set as https URLs: App Review needs a working privacy policy link inside the app. They
//   come from the profile's `env` in eas.json (the gitignored .env isn't uploaded).
// Other profiles, and local runs, pass.
const LINKS = ['EXPO_PUBLIC_PRIVACY_URL', 'EXPO_PUBLIC_SUPPORT_URL'];

const isHttps = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const profile = process.env.EAS_BUILD_PROFILE ?? '';
const plus = (process.env.EXPO_PUBLIC_APP_VARIANT?.trim() ?? '') === 'plus';

if (profile && profile.endsWith('-plus') !== plus) {
  console.error(
    profile.endsWith('-plus')
      ? `The ${profile} profile builds Win Zero Plus: set EXPO_PUBLIC_APP_VARIANT to "plus" in its env in eas.json.`
      : `The ${profile} profile builds Win Zero, but EXPO_PUBLIC_APP_VARIANT is "plus". Use ${profile}-plus for Win Zero Plus.`,
  );
  process.exit(1);
}

if (/^production(-|$)/.test(profile)) {
  const missing = LINKS.filter((name) => !isHttps(process.env[name]?.trim() ?? ''));
  if (missing.length > 0) {
    console.error(
      `Set ${missing.join(' and ')} to their published https pages before a production build, ` +
        `in build.${profile}.env in eas.json. See docs/RELEASE.md.`,
    );
    process.exit(1);
  }
}
