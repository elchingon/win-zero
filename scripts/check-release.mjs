// Release guard, run by EAS before every build (the eas-build-pre-install npm script). A
// production build stops while the app still links to placeholder pages: App Review needs a
// working privacy policy link inside the app. Other profiles, and local runs, pass.
import { readFileSync } from 'node:fs';

const FILE = 'src/ui/support.ts';
const PLACEHOLDERS = ['[PRIVACY_URL]', '[SUPPORT_URL]'];

if (process.env.EAS_BUILD_PROFILE === 'production') {
  const source = readFileSync(new URL(`../${FILE}`, import.meta.url), 'utf8');
  const left = PLACEHOLDERS.filter((p) => source.includes(p));
  if (left.length > 0) {
    console.error(`Set ${left.join(' and ')} in ${FILE} (APP_LINKS) before a production build. See docs/RELEASE.md.`);
    process.exit(1);
  }
}
