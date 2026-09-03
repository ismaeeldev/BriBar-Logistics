import { ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

/**
 * `Origin → Destination`, as the pair it is.
 *
 * Route identity used to be one long run-on string — `MAD-BCN-01 · Madrid -
 * Barcelona diario` — which is three separate facts a reader has to take apart
 * before any of them is useful. The code is the contract, and this is the
 * journey; keeping them on separate lines means each can be scanned on its
 * own.
 *
 * The arrow is an icon, not a character. An `→` in the text is announced as
 * "right arrow" by a screen reader, which is not what the journey means; hidden
 * from the accessibility tree, the two place names read as the pair they are.
 *
 * Both names truncate rather than one, so a long origin cannot squeeze the
 * destination out of the row entirely.
 */
export function Journey({
  origin,
  destination,
  className,
}: {
  origin: string;
  destination: string;
  className?: string;
}) {
  return (
    <span className={cn('flex min-w-0 items-center gap-1', className)}>
      <span className="truncate">{origin}</span>
      <ArrowRight aria-hidden className="size-3 shrink-0 opacity-60" />
      <span className="truncate">{destination}</span>
    </span>
  );
}
