// The browser's reduce-motion setting, kept current.
import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function media(): MediaQueryList | null {
  return typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY) : null;
}

export function prefersReducedMotion(): boolean {
  return media()?.matches ?? false;
}

function subscribe(onChange: () => void): () => void {
  const m = media();
  m?.addEventListener('change', onChange);
  return () => m?.removeEventListener('change', onChange);
}

export function useReduceMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}
