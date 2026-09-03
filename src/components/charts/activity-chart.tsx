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
 * One series, so there is no legend: the title names it. One hue rather than a
 * palette, because the job is trend-over-time, not telling series apart.
 *
 * ## Thin marks, and nothing else
 *
 * Columns rather than a line, because the quantity is a count of discrete
 * services per day: a line implies a value between the points that does not
 * exist — half a service is not a thing — and it slopes straight through an
 * empty day instead of showing it as empty.
 *
 * But wide filled columns made a fortnight of ordinary work look like a solid
 * block. These are thin rounded marks with air between them, so the *shape* of
 * the fortnight is what the eye gets. Everything that was not the data is
 * gone: no axis, no grid, no baseline rule, no per-day labels. What is left is
 * the marks, the two end dates, and the peak — named, because "how busy was
 * the busiest day" is the question the chart is actually asked.
 *
 * Plain elements rather than SVG. A stretched `viewBox` distorts a rounded
 * corner and a stroke into ellipses and wedges, which is exactly what a chart
 * made of thin rounded marks cannot afford.
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
  const peak = Math.max(1, ...values);
  const peakIndex = values.indexOf(Math.max(...values));

  return (
    <div className={cn('space-y-2.5', className)}>
      <div
        className="relative flex h-28 items-end gap-[3px]"
        role="img"
        aria-label={UI.admin.activityChartLabel(points.length)}
        onMouseLeave={() => setHovered(null)}
      >
        {points.map((point, index) => {
          const value = values[index] ?? 0;
          const isHovered = hovered === index;

          return (
            <button
              key={point.date}
              type="button"
              tabIndex={-1}
              aria-hidden
              onMouseEnter={() => setHovered(index)}
              // The hit target is the whole column, so a one-service day is as
              // easy to hover as the peak.
              className="group relative flex h-full flex-1 cursor-default items-end"
            >
              <span
                style={
                  {
                    // A floor rather than a true zero, so an empty day still
                    // reads as a day that happened and had nothing in it.
                    height: value === 0 ? '3px' : `${Math.max(6, (value / peak) * 100)}%`,
                    '--i': index,
                  } as CSSProperties
                }
                className={cn(
                  'animate-grow stagger w-full origin-bottom rounded-full transition-[opacity,background-color] duration-200',
                  value === 0 ? 'bg-chart-grid' : 'bg-chart-5',
                  hovered !== null && !isHovered && 'opacity-35',
                )}
              />
            </button>
          );
        })}

        {hovered !== null && points[hovered] ? (
          <Tooltip point={points[hovered]} index={hovered} total={points.length} />
        ) : null}
      </div>

      {/* Only the ends are dated: fourteen labels under a 320px chart is
          unreadable, and the range is what the reader actually needs. The peak
          is named separately because it is a fact, not an axis. */}
      <div className="text-muted-foreground flex items-baseline justify-between gap-3 font-mono text-[0.65rem]">
        <span>{points[0]?.label}</span>
        {points[peakIndex] && (values[peakIndex] ?? 0) > 0 ? (
          <span className="text-foreground font-sans text-[0.7rem] font-medium">
            {UI.admin.peakDay(points[peakIndex].label, values[peakIndex] ?? 0)}
          </span>
        ) : null}
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
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
