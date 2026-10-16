// Release guard, run by EAS before every build (the eas-build-pre-install npm script). A
// production build stops unless the privacy and support pages are set as https URLs: App Review
// needs a working privacy policy link inside the app. They come from the profile's `env` in
// eas.json (the gitignored .env isn't uploaded). Other profiles, and local runs, pass.
const LINKS = ['EXPO_PUBLIC_PRIVACY_URL', 'EXPO_PUBLIC_SUPPORT_URL'];

const isHttps = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

if (process.env.EAS_BUILD_PROFILE === 'production') {
  const missing = LINKS.filter((name) => !isHttps(process.env[name]?.trim() ?? ''));
  if (missing.length > 0) {
    console.error(
      `Set ${missing.join(' and ')} to their published https pages before a production build, ` +
        'in build.production.env in eas.json. See docs/RELEASE.md.',
    );
    process.exit(1);
  }
}
