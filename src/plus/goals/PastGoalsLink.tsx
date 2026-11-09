// Setup's way to Past goals (SPEC 9), once a goal has been archived: with no goal left, Settings
// has nothing to show, so this is the way back to them.
import { router } from 'expo-router';

import { useApp } from '@/store';
import { LinkButton } from '@/ui/Button';

import { PAST_COPY } from '../copy';

export function PastGoalsLink() {
  const past = useApp((s) => s.archived.length > 0);
  if (!past) return null;
  return <LinkButton label={PAST_COPY.title} accessibilityHint={PAST_COPY.openHint} onPress={() => router.push('/past-goals')} />;
}
