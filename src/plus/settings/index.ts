// Win Zero Plus's parts of Settings (SPEC 9). settings.tsx requires this behind the literal
// process.env.EXPO_PUBLIC_APP_VARIANT === 'plus', so Win Zero's bundle leaves it out.
export { SETTINGS_COPY } from '../copy';
export { DaysField } from '../goals/DaysField';
export { GoalsGroup } from './GoalsGroup';
export { GoalsList } from './GoalsList';
export { PlusSections } from './PlusSections';
