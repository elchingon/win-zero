// Where the app is, for notification handling: the screen on top, reported by the root layout,
// or null before the navigator has mounted.
import { router } from 'expo-router';

let currentPath: string | null = null;

export function reportPath(path: string | null): void {
  currentPath = path;
}

export function getCurrentPath(): string | null {
  return currentPath;
}

/**
 * Whether to bring Home forward after a notification response. Home opens what the answer left
 * (the round or the notice) or shows its banner. Not when Home is already showing, nor over the
 * Notice screen (Home takes over once it closes), nor before the navigator mounts (Home is the
 * first screen then).
 */
export function shouldGoHome(path: string | null): boolean {
  return path !== null && path !== '/' && path !== '/notice';
}

export function toHome(): void {
  if (shouldGoHome(currentPath)) router.dismissTo('/');
}
