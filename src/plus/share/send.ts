// Sending the share card (SPEC 9): the PNG goes to the cache folder, then to the share sheet. On
// iPhone, React Native's Share takes the file itself (and Save Image saves it to Photos); on
// Android, the share-image module hands it to the chooser. If anything fails, the text share
// opens instead, so Share always does something.
import { File, Paths } from 'expo-file-system';
import { Platform, Share } from 'react-native';

import { shareMilestone } from '@/game/share';

import ShareImage from '../../../modules/share-image';
import { SHARE_CARD_COPY } from '../copy';

/** The card's file in the cache folder, written over each time. */
export const CARD_FILE = 'win-zero-milestone.png';

/** Share `png`, or `text` if the card can't go. Says which went. */
export async function sendCard(png: Uint8Array | null, text: string): Promise<'card' | 'text'> {
  try {
    if (png && (Platform.OS === 'ios' || ShareImage)) {
      const file = new File(Paths.cache, CARD_FILE);
      file.create({ overwrite: true });
      file.write(png);
      if (Platform.OS === 'ios') await Share.share({ url: file.uri });
      else await ShareImage?.shareAsync(file.contentUri, 'image/png', SHARE_CARD_COPY.title);
      return 'card';
    }
  } catch {
    // The words go instead.
  }
  shareMilestone(text);
  return 'text';
}
