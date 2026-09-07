/**
 * A deterministic accent for a person's avatar chip.
 *
 * The classes are translucent tints (`bg-*-500/15`) over a mid-tone text and
 * ring, which read acceptably on both the light and the dark page background —
 * the codebase resolves the theme onto `data-theme` rather than through the
 * `prefers-color-scheme` media query, so Tailwind's `dark:` variant is not
 * wired up and a fixed both-theme palette is used instead (same approach as the
 * icon chips elsewhere in the admin lists).
 */
const PALETTE = [
  { bg: 'bg-blue-500/15', text: 'text-blue-600', ring: 'ring-blue-500/25' },
  { bg: 'bg-violet-500/15', text: 'text-violet-600', ring: 'ring-violet-500/25' },
  { bg: 'bg-emerald-500/15', text: 'text-emerald-600', ring: 'ring-emerald-500/25' },
  { bg: 'bg-amber-500/15', text: 'text-amber-600', ring: 'ring-amber-500/25' },
  { bg: 'bg-rose-500/15', text: 'text-rose-600', ring: 'ring-rose-500/25' },
] as const;

export function getUserColor(name: string): { bg: string; text: string; ring: string } {
  const hash = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return PALETTE[hash % PALETTE.length]!;
}

export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0]!.charAt(0) + words[1]!.charAt(0)).toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase();
}
