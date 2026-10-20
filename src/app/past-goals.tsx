// Win Zero Plus: the goals archived, from Settings › Goals (SPEC 9). The screen lives
// in src/plus, required only in Plus, so Win Zero's bundle leaves it out; Win Zero has this route
// too, and leaves it for Home.
import { Redirect } from 'expo-router';

import { FEATURES } from '@/variant';

const Plus: typeof import('@/plus/screens/PastGoals') | null =
  process.env.EXPO_PUBLIC_APP_VARIANT === 'plus'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/plus/screens/PastGoals')
    : null;

export default function PastGoalsRoute() {
  if (!Plus || !FEATURES.multiGoal) return <Redirect href="/" />;
  return <Plus.PastGoals />;
}
