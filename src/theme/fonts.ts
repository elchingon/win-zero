// Only the weights the UI uses. Subpath imports keep the other weights out of the bundle.
import { Barlow_400Regular } from '@expo-google-fonts/barlow/400Regular';
import { Barlow_500Medium } from '@expo-google-fonts/barlow/500Medium';
import { Barlow_600SemiBold } from '@expo-google-fonts/barlow/600SemiBold';
import { Barlow_700Bold } from '@expo-google-fonts/barlow/700Bold';
import { Bungee_400Regular } from '@expo-google-fonts/bungee/400Regular';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono/600SemiBold';

import type { FontFamily } from './tokens';

/** Map for expo-font's useFonts. Keys must match the family names in tokens.fonts. */
export const fontAssets = {
  Bungee_400Regular,
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  Barlow_700Bold,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
} satisfies Record<FontFamily, number>;
