// Win Zero Plus: add a goal (SPEC 9). The screen lives in src/plus, required only in Plus, so
// Win Zero's bundle leaves it out; Win Zero has this route too, and leaves it for Home.
import { Redirect } from 'expo-router';

import { FEATURES } from '@/variant';

const Plus: typeof import('@/plus/screens/AddGoal') | null =
  process.env.EXPO_PUBLIC_APP_VARIANT === 'plus'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/plus/screens/AddGoal')
    : null;

export default function AddGoalRoute() {
  if (!Plus || !FEATURES.multiGoal) return <Redirect href="/" />;
  return <Plus.AddGoal />;
}
