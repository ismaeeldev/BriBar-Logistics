import { NUMBER_LOCALE } from '@/lib/i18n/messages';
import { formatEuros } from '@/lib/money/money';
import { cn } from '@/lib/utils/cn';

export interface MarginTrendPoint {
  year: number;
  month: number;
  revenueCents: number;
  marginCents: number;
}

/**
 * Monthly operating margin, one column per month (ERP roadmap Phase 6,
 * replacing `00Dashboard`'s margin pivot chart).
 *
 * Plain flex columns, not a charting library — the same choice every other
 * chart in `src/components/charts/` makes. Bar height is the margin's
 * magnitude against the largest month; a losing month is tinted
 * `destructive` and carries a downward marker so colour is never the only
 * signal. The signed figure is in each column's tooltip.
 */
export function MarginTrend({
  points,
  className,
}: {
  points: MarginTrendPoint[];
  className?: string;
}) {
  const peak = Math.max(1, ...points.map((point) => Math.abs(point.marginCents)));

  return (
    <div className={cn('w-full', className)}>
      <div className="flex h-44 items-end gap-1.5 overflow-x-auto">
        {points.map((point) => {
          const isLoss = point.marginCents < 0;
          const height = Math.max(2, (Math.abs(point.marginCents) / peak) * 100);

          return (
            <div
              key={`${point.year}-${point.month}`}
              className="flex min-w-5.5 flex-1 flex-col items-center justify-end gap-1"
              title={`${String(point.month).padStart(2, '0')}/${point.year} · ${formatEuros(
                point.marginCents,
                NUMBER_LOCALE,
              )}`}
            >
              {isLoss ? <span className="text-destructive text-[10px] leading-none">▼</span> : null}
              <div
                className={cn(
                  'w-full rounded-sm transition-all',
                  isLoss ? 'bg-destructive/70' : 'bg-emerald-500/80',
                )}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-1.5 overflow-x-auto border-t border-border/40 pt-1.5">
        {points.map((point) => (
          <span
            key={`${point.year}-${point.month}-label`}
            className="text-muted-foreground min-w-5.5 flex-1 text-center text-[10px] tabular-nums"
          >
            {String(point.month).padStart(2, '0')}
          </span>
        ))}
      </div>
    </div>
  );
}
