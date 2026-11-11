// Win Zero Plus's share card (SPEC 9). ResultSheet.tsx requires this behind the literal
// process.env.EXPO_PUBLIC_APP_VARIANT === 'plus', so Win Zero's bundle leaves it, and the
// share-image module's JavaScript, out.
export { ShareMilestoneLink } from './ShareMilestoneLink';
