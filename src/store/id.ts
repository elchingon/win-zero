// A random v4-format UUID for stable record IDs (SPEC 8). Hermes has no crypto.randomUUID and
// expo-crypto isn't installed; uniqueness on one device is all a goal ID needs.
export function makeId(random: () => number = Math.random): string {
  const hex = (digits: number) =>
    Math.floor(random() * 16 ** digits)
      .toString(16)
      .padStart(digits, '0');
  const variant = (8 + Math.floor(random() * 4)).toString(16);
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
}
