import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * A headline number.
 *
 * A single current value is a stat tile, not a one-bar bar chart. The value
 * carries the weight, the label sits above it in muted ink, and an optional
 * sparkline gives the number a direction without a second axis or a legend.
 *
 * The figure uses tabular numerals and is never coloured by "series" - only a
 * genuine status (pending work outstanding) tints it, and that tint always
 * arrives with the word beside it.
 */
export function StatTile({
  label,
  value,
  unit,
  tone = 'neutral',
  hint,
  chart,
  className,
}: {
  label: string;
  value: number | string;
  unit?: string;
  tone?: 'neutral' | 'pending' | 'approved';
  hint?: string;
  chart?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-card flex flex-col justify-between gap-3 rounded-xl border p-4 shadow-xs',
        className,
      )}
    >
      <div className="space-y-1.5">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </p>
        <p className="flex items-baseline gap-1.5">
          <span
            className={cn(
              'font-mono text-3xl leading-none font-semibold tabular-nums',
              tone === 'pending' && 'text-pending',
              tone === 'approved' && 'text-approved',
            )}
          >
            {value}
          </span>
          {unit ? <span className="text-muted-foreground text-sm">{unit}</span> : null}
        </p>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </div>

      {chart ? <div className="-mb-1">{chart}</div> : null}
    </div>
  );
}
