import type { ComponentType, CSSProperties, ReactNode } from 'react';

import { AnimatedNumber } from '@/components/charts/animated-number';
import { cn } from '@/lib/utils/cn';

const TONES = {
  neutral: {
    figure: 'text-foreground',
    chip: 'bg-primary-subtle text-primary-subtle-foreground',
    rule: 'bg-primary',
  },
  pending: {
    figure: 'text-pending',
    chip: 'bg-pending-surface text-pending',
    rule: 'bg-pending',
  },
  approved: {
    figure: 'text-approved',
    chip: 'bg-approved-surface text-approved',
    rule: 'bg-approved',
  },
} as const;

/**
 * A headline number.
 *
 * A single current value is a stat tile, not a one-bar bar chart. The figure
 * carries the weight; everything around it is set to stay out of its way — a
 * small uppercase label, a muted hint, and an icon chip that identifies the
 * measure without repeating the label in a second colour.
 *
 * Three deliberate pieces of movement, each short and each once:
 *
 *   - a rule across the top wipes in, so a row of tiles resolves left to right
 *     rather than appearing as a block;
 *   - the figure counts up (see `AnimatedNumber`);
 *   - the tile lifts under the pointer, the only thing here that happens more
 *     than once.
 *
 * The figure uses tabular numerals and is never coloured by "series" — only a
 * genuine status tints it, and that tint always arrives with a word beside it.
 */
export function StatTile({
  label,
  value,
  unit,
  tone = 'neutral',
  hint,
  icon: Icon,
  chart,
  index = 0,
  className,
}: {
  label: string;
  /** A number counts up; a string is rendered as given. */
  value: number | string;
  unit?: string;
  tone?: keyof typeof TONES;
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
  chart?: ReactNode;
  /** Position in the row, so the entrance staggers across it. */
  index?: number;
  className?: string;
}) {
  const palette = TONES[tone];

  return (
    <div
      style={{ '--i': index } as CSSProperties}
      className={cn(
        'bg-card lift stagger animate-rise relative flex flex-col justify-between gap-3 overflow-hidden rounded-xl border p-4 shadow-xs',
        className,
      )}
    >
      {/* Scaled from the left edge rather than animating `width`, so the
          browser can run it off the main thread. */}
      <span
        aria-hidden
        className={cn(
          'animate-sweep stagger absolute inset-x-0 top-0 h-0.5 origin-left',
          palette.rule,
        )}
      />

      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {label}
          </p>
          {Icon ? (
            <span
              aria-hidden
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-lg',
                palette.chip,
              )}
            >
              <Icon className="size-3.5" />
            </span>
          ) : null}
        </div>

        <p className="flex items-baseline gap-1.5">
          <span
            className={cn(
              'font-mono text-3xl leading-none font-semibold tracking-tight tabular-nums',
              palette.figure,
            )}
          >
            {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
          </span>
          {unit ? <span className="text-muted-foreground text-sm">{unit}</span> : null}
        </p>

        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </div>

      {chart ? <div className="-mb-1">{chart}</div> : null}
    </div>
  );
}
