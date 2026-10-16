// Saying something to a screen reader without moving focus: a polite live region, like React
// Native's announceForAccessibility.
let region: HTMLElement | null = null;

function liveRegion(): HTMLElement {
  if (region && document.body.contains(region)) return region;
  region = document.createElement('div');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('role', 'status');
  region.className = 'sr-only';
  document.body.appendChild(region);
  return region;
}

export function announce(text: string): void {
  const r = liveRegion();
  // Clear first, so the same words twice are read twice.
  r.textContent = '';
  window.setTimeout(() => {
    r.textContent = text;
  }, 50);
}
