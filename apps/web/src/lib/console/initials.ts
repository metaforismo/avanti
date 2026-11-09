/** Up to two initials for an avatar. Whole code points, so an accent or an emoji survives. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => Array.from(part)[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
