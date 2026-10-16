// Sharing a milestone: the browser's share sheet where there is one, otherwise the clipboard.
export type ShareResult = 'shared' | 'copied' | 'failed';

export async function shareText(text: string): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (e) {
      // Dismissing the sheet isn't a failure worth a fallback.
      if (e instanceof DOMException && e.name === 'AbortError') return 'failed';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
