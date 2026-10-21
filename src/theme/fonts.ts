// Only the weights the UI uses. Subpath imports keep the other weights out of the bundle.
import { Barlow_400Regular } from '@expo-google-fonts/barlow/400Regular';
import { Barlow_500Medium } from '@expo-google-fonts/barlow/500Medium';
import { Barlow_600SemiBold } from '@expo-google-fonts/barlow/600SemiBold';
import { Barlow_700Bold } from '@expo-google-fonts/barlow/700Bold';
import { Barlow_800ExtraBold } from '@expo-google-fonts/barlow/800ExtraBold';
import { Bungee_400Regular } from '@expo-google-fonts/bungee/400Regular';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono/600SemiBold';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold';
import { JetBrainsMono_800ExtraBold } from '@expo-google-fonts/jetbrains-mono/800ExtraBold';

import type { FontFamily } from './tokens';

/** Map for expo-font. Keys must match the family names in tokens.fonts. */
export const fontAssets = {
  Bungee_400Regular,
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  Barlow_700Bold,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
} satisfies Record<FontFamily, number>;

/**
 * Bold text (Settings › Accessibility, or iOS Bold Text): each family name loads a heavier weight,
 * so every style gets heavier text without naming new fonts. Bungee has only the one weight.
 */
export const boldFontAssets = {
  Bungee_400Regular,
  Barlow_400Regular: Barlow_600SemiBold,
  Barlow_500Medium: Barlow_700Bold,
  Barlow_600SemiBold: Barlow_700Bold,
  Barlow_700Bold: Barlow_800ExtraBold,
  JetBrainsMono_500Medium: JetBrainsMono_700Bold,
  JetBrainsMono_600SemiBold: JetBrainsMono_800ExtraBold,
} satisfies Record<FontFamily, number>;

export function fontAssetsFor(bold: boolean): Record<FontFamily, number> {
  return bold ? boldFontAssets : fontAssets;
}
