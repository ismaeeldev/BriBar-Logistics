import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

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
  icon,
  index = 0,
  className,
}: {
  label: string;
  value: number;
  unit?: string;
  tone?: 'neutral' | 'pending' | 'approved' | 'purple';
  /** The same measure over the previous period, if there is one. */
  previous?: number;
  /** Names the period being compared against, e.g. "vs yesterday". */
  comparison?: string;
  hint?: string;
  icon?: ReactNode;
  index?: number;
  className?: string;
}) {
  const delta = previous === undefined ? null : value - previous;

  return (
    <div
      style={{ '--i': index } as CSSProperties}
      className={cn(
        'bg-card animate-rise flex flex-row items-center gap-5 rounded-2xl border px-6 py-5 shadow-sm border-border/40 min-h-[110px]',
        className,
      )}
    >
      {icon && (
        <div className={cn(
          "shrink-0 flex items-center justify-center size-14 rounded-2xl",
          tone === 'neutral' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' : '',
          tone === 'pending' ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' : '',
          tone === 'approved' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : '',
          tone === 'purple' ? 'bg-purple-50 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400' : ''
        )}>
          {icon}
        </div>
      )}

      <div className="flex flex-col min-w-0 flex-1 justify-center">
        <p className="flex items-baseline gap-1.5 leading-none mb-1.5">
          <span className="text-[26px] font-bold tracking-tight tabular-nums text-foreground leading-none">
            <AnimatedNumber value={value} />
          </span>
          {unit ? <span className="text-muted-foreground text-sm font-medium">{unit}</span> : null}
        </p>

        <p className="text-foreground/80 font-medium text-[14px] truncate mt-1">
          {label}
        </p>

        {delta !== null && comparison ? (
          <p className="text-muted-foreground flex items-center gap-1 text-[12px] truncate">
            {delta === 0 ? (
              <Minus aria-hidden className="size-3.5" />
            ) : delta > 0 ? (
              <ArrowUpRight aria-hidden className="size-3.5" />
            ) : (
              <ArrowDownRight aria-hidden className="size-3.5" />
            )}
            <span className="tabular-nums font-medium">
              {delta === 0 ? UI.common.noChange : UI.common.delta(delta)}
            </span>
            <span>{comparison}</span>
          </p>
        ) : hint ? (
          <p className="text-muted-foreground text-[12px] truncate">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}
