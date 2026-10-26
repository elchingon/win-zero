// A link to a screen this app doesn't have (an old link, or one meant for the other app: Win Zero
// or Win Zero Plus) lands on Home instead of an error.
import { Redirect } from 'expo-router';

export default function NotFound() {
  return <Redirect href="/" />;
}
