'use client';

import type { CSSProperties } from 'react';
import { useState } from 'react';

import { UI } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';

export interface ActivityPoint {
  /** `yyyy-MM-dd`. */
  date: string;
  /** Short label for the axis, e.g. "02/09". */
  label: string;
  services: number;
  actualKm: number;
}

/**
 * Daily activity over a fixed window (SRS 16.2 — the dashboard's sense of
 * whether work is flowing).
 *
 * ## What went wrong before, twice
 *
 * The first version was wide filled columns, which made an ordinary fortnight
 * look like a solid block. The second stripped that back to thin marks with no
 * axis at all, which was minimal and told the reader nothing: without a scale
 * a bar chart is a texture, and "is six a lot?" had no answer on the page.
 *
 * This one keeps the restraint and puts the analysis back. A y-axis with three
 * ticks, gridlines behind the bars rather than over them, and every bar
 * hoverable for the exact figures. That is the smallest amount of chart
 * furniture that makes the shape readable as a quantity.
 *
 * Columns rather than a line, because the quantity is a count of discrete
 * services per day: a line implies a value between the points that does not
 * exist — half a service is not a thing — and it slopes straight through an
 * empty day instead of showing it as empty.
 *
 * One series, so there is no legend: the title names it. One hue, because the
 * job is trend-over-time, not telling series apart. Plain elements rather than
 * SVG, so rounded corners stay round instead of being stretched into wedges by
 * a scaled viewBox.
 */
export function ActivityChart({
  points,
  metric = 'services',
  className,
}: {
  points: ActivityPoint[];
  metric?: 'services' | 'actualKm';
  className?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  const values = points.map((point) =>
    metric === 'services' ? point.services : point.actualKm,
  );
  const observed = Math.max(0, ...values);

  // A scale that ends on a round number the axis can actually label. Without
  // this the top tick reads "6.5 services", which is not a thing either.
  const ceiling = Math.max(2, niceCeiling(observed));
  const ticks = [ceiling, Math.round(ceiling / 2), 0];

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex gap-2">
        {/* The scale. `justify-between` against the plot's own height keeps
            each label on its gridline without a second set of magic numbers. */}
        <div
          aria-hidden
          className="text-muted-foreground flex h-32 shrink-0 flex-col justify-between text-right font-mono text-[0.65rem] tabular-nums"
        >
          {ticks.map((tick) => (
            <span key={tick} className="leading-none">
              {tick}
            </span>
          ))}
        </div>

        <div
          className="relative h-32 flex-1"
          role="img"
          aria-label={UI.admin.activityChartLabel(points.length)}
          onMouseLeave={() => setHovered(null)}
        >
          {/* Gridlines sit behind the bars and stop at the plot edge, so they
              read as a scale rather than as content. */}
          <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
            {ticks.map((tick) => (
              <span key={tick} className="bg-chart-grid h-px w-full" />
            ))}
          </div>

          <div className="relative flex h-full items-end gap-[3px]">
            {points.map((point, index) => {
              const value = values[index] ?? 0;
              const isHovered = hovered === index;

              return (
                <span
                  key={point.date}
                  onMouseEnter={() => setHovered(index)}
                  // The hit target is the whole column, so a one-service day is
                  // as easy to hover as the peak.
                  className="flex h-full flex-1 items-end"
                >
                  <span
                    style={
                      {
                        // A floor rather than a true zero, so an empty day still
                        // reads as a day that happened and had nothing in it.
                        height: value === 0 ? '2px' : `${(value / ceiling) * 100}%`,
                        '--i': index,
                      } as CSSProperties
                    }
                    className={cn(
                      'animate-grow stagger w-full origin-bottom rounded-t-[3px] transition-opacity duration-200',
                      value === 0 ? 'bg-chart-grid' : 'bg-chart-4',
                      hovered !== null && !isHovered && 'opacity-40',
                    )}
                  />
                </span>
              );
            })}
          </div>

          {hovered !== null && points[hovered] ? (
            <Tooltip point={points[hovered]} index={hovered} total={points.length} />
          ) : null}
        </div>
      </div>

      {/* Only the ends are dated: fourteen labels under a 320px chart is
          unreadable, and the range is what the reader actually needs. */}
      <div className="text-muted-foreground flex justify-between pl-6 font-mono text-[0.65rem]">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/**
 * The next round number at or above `value`, for the top of the scale.
 *
 * 1, 2, 5 and 10 per decade — the steps that divide by two into another whole
 * number, which is what lets the midpoint tick be an integer too.
 */
function niceCeiling(value: number): number {
  if (value <= 0) return 2;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return 10 * magnitude;
}

function Tooltip({
  point,
  index,
  total,
}: {
  point: ActivityPoint;
  index: number;
  total: number;
}) {
  // Anchor from whichever edge is nearer, so the tooltip never leaves the card.
  const fromLeft = index < total / 2;
  const offset = `${((index + 0.5) / total) * 100}%`;

  return (
    <div
      role="tooltip"
      className="bg-foreground text-background animate-fade pointer-events-none absolute -top-1 z-10 -translate-y-full rounded-md px-2 py-1.5 text-xs whitespace-nowrap shadow-lg"
      style={fromLeft ? { left: offset } : { right: `calc(100% - ${offset})` }}
    >
      <span className="font-medium">{point.label}</span>
      <span className="opacity-70">
        {' · '}
        {UI.common.servicesShort(point.services)}
      </span>
      <span className="opacity-70">
        {' · '}
        <span className="font-mono">{point.actualKm}</span> km
      </span>
    </div>
  );
}
