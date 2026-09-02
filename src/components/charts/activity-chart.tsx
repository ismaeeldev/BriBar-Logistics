'use client';

import { useId, useState } from 'react';

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
 * A column chart rather than a line. The underlying quantity is a count of
 * discrete services per day, and a line implies a continuous value between the
 * points that does not exist — half a service is not a thing. Columns also make
 * an empty day visibly empty rather than a segment sloping through zero.
 *
 * Hand-drawn SVG rather than a charting library: three shapes, full control of
 * the theme tokens, and nothing shipped to the browser that is not used.
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
  const id = useId();

  const values = points.map((point) =>
    metric === 'services' ? point.services : point.actualKm,
  );
  const peak = Math.max(1, ...values);

  // A fixed viewBox with preserveAspectRatio="none" lets the chart stretch to
  // any container width while the bar geometry stays computable in round
  // numbers. Text is rendered outside the SVG so it never stretches with it.
  const width = 100;
  const height = 40;
  const gap = 100 / points.length / 5;
  const barWidth = 100 / points.length - gap;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-32 w-full overflow-visible"
          role="img"
          aria-label={`Actividad diaria: ${points.length} días`}
        >
          {/* Recessive baseline; no full grid for a range this short. */}
          <line
            x1="0"
            y1={height}
            x2={width}
            y2={height}
            stroke="var(--chart-grid)"
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />

          {points.map((point, index) => {
            const value = values[index] ?? 0;
            // Always leave a sliver so an empty day still reads as a day.
            const barHeight = value === 0 ? 0.8 : Math.max(2, (value / peak) * (height - 4));
            const x = index * (100 / points.length) + gap / 2;
            const isHovered = hovered === index;

            return (
              <g key={point.date}>
                {/* Hit target spans the full column height so the tooltip is
                    reachable on a one-service day. */}
                <rect
                  x={x - gap / 2}
                  y="0"
                  width={barWidth + gap}
                  height={height}
                  fill="transparent"
                  onMouseEnter={() => setHovered(index)}
                  onMouseLeave={() => setHovered(null)}
                />
                <rect
                  x={x}
                  y={height - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx="0.6"
                  fill={value === 0 ? 'var(--chart-grid)' : 'var(--chart-5)'}
                  opacity={hovered === null || isHovered ? 1 : 0.45}
                  className="transition-opacity"
                  pointerEvents="none"
                />
              </g>
            );
          })}
        </svg>

        {hovered !== null && points[hovered] ? (
          <Tooltip point={points[hovered]} index={hovered} total={points.length} id={id} />
        ) : null}
      </div>

      {/* Only the ends are labelled: fourteen dates under a 320px chart is
          unreadable, and the range is what the reader actually needs. */}
      <div className="text-muted-foreground flex justify-between font-mono text-[0.65rem]">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function Tooltip({
  point,
  index,
  total,
  id,
}: {
  point: ActivityPoint;
  index: number;
  total: number;
  id: string;
}) {
  // Anchor from whichever edge is nearer, so the tooltip never leaves the card.
  const fromLeft = index < total / 2;
  const offset = `${((index + 0.5) / total) * 100}%`;

  return (
    <div
      id={id}
      role="tooltip"
      className="bg-foreground text-background pointer-events-none absolute -top-1 z-10 -translate-y-full rounded-md px-2 py-1.5 text-xs whitespace-nowrap shadow-lg"
      style={fromLeft ? { left: offset } : { right: `calc(100% - ${offset})` }}
    >
      <span className="font-medium">{point.label}</span>
      <span className="opacity-70">
        {' · '}
        {point.services} serv.
      </span>
      <span className="opacity-70">
        {' · '}
        <span className="font-mono">{point.actualKm}</span> km
      </span>
    </div>
  );
}
