import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { CSSProperties } from 'react';

import { AnimatedNumber } from '@/components/charts/animated-number';
import { UI } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';

/**
 * One operational figure, at a glance.
 *
 * Replaces the tile that came before it, which was a card with a coloured
 * accent, an icon chip and a lot of padding — four of those across the top of
 * a page read as decoration competing with the data underneath. This is a
 * number, a label, and a comparison, and nothing else: the figure carries the
 * weight and the block around it gets out of the way.
 *
 * ## The comparison is the point
 *
 * "12 services today" is a fact. "12 services today, three more than
 * yesterday" is information, and it is the version an operations manager can
 * act on. So a delta is shown whenever there is a previous period to compare
 * with, in words as well as an arrow — a bare "+3" leaves the reader working
 * out what it is +3 of.
 *
 * ## Colour
 *
 * The figure is ink, not brand. Only a genuine status tints it — work
 * outstanding is amber, signed off is green — and that tint always arrives
 * with a word beside it, never alone. A rising or falling trend is
 * deliberately *not* coloured: more kilometres is not good news or bad news
 * without context this component does not have.
 */
export function MetricBlock({
  label,
  value,
  unit,
  tone = 'neutral',
  previous,
  comparison,
  hint,
  index = 0,
  className,
}: {
  label: string;
  value: number;
  unit?: string;
  tone?: 'neutral' | 'pending' | 'approved';
  /** The same measure over the previous period, if there is one. */
  previous?: number;
  /** Names the period being compared against, e.g. "vs yesterday". */
  comparison?: string;
  hint?: string;
  index?: number;
  className?: string;
}) {
  const delta = previous === undefined ? null : value - previous;

  return (
    <div
      style={{ '--i': index } as CSSProperties}
      className={cn(
        'bg-card animate-rise stagger flex flex-col gap-1 rounded-lg border px-4 py-3',
        className,
      )}
    >
      <p className="text-muted-foreground text-[0.7rem] font-medium tracking-wide uppercase">
        {label}
      </p>

      <p className="flex items-baseline gap-1.5">
        <span
          className={cn(
            'font-mono text-2xl leading-none font-semibold tracking-tight tabular-nums',
            tone === 'pending' && 'text-pending',
            tone === 'approved' && 'text-approved',
          )}
        >
          <AnimatedNumber value={value} />
        </span>
        {unit ? <span className="text-muted-foreground text-xs">{unit}</span> : null}
      </p>

      {delta !== null && comparison ? (
        <p className="text-muted-foreground flex items-center gap-1 text-xs">
          {delta === 0 ? (
            <Minus aria-hidden className="size-3" />
          ) : delta > 0 ? (
            <ArrowUpRight aria-hidden className="size-3" />
          ) : (
            <ArrowDownRight aria-hidden className="size-3" />
          )}
          <span className="tabular-nums">
            {delta === 0 ? UI.common.noChange : UI.common.delta(delta)}
          </span>
          <span>{comparison}</span>
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
