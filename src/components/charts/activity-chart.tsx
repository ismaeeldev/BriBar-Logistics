'use client';

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
 * Generates a smooth bezier curve path for a set of points.
 */
function smoothPath(points: [number, number][]) {
  if (points.length === 0) return '';
  const first = points[0];
  if (points.length === 1 && first) return `M ${first[0]},${first[1]}`;
  
  return points.reduce((acc, point, i, a) => {
    if (!point) return acc;
    if (i === 0) return `M ${point[0]},${point[1]}`;
    const prev = a[i - 1];
    if (!prev) return acc;
    const cp1x = prev[0] + (point[0] - prev[0]) * 0.4;
    const cp1y = prev[1];
    const cp2x = point[0] - (point[0] - prev[0]) * 0.4;
    const cp2y = point[1];
    return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${point[0]},${point[1]}`;
  }, '');
}

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

  // A scale that ends on a round number the axis can actually label.
  const ceiling = Math.max(2, niceCeiling(observed));
  const ticks = [ceiling, Math.round(ceiling / 2), 0];

  // Calculate coordinates (X: 0 to 100, Y: 100 to 0)
  const pointCoords = points.map((_, index) => {
    const x = points.length > 1 ? (index / (points.length - 1)) * 100 : 50;
    const y = 100 - ((values[index] ?? 0) / ceiling) * 100;
    return [x, y] as [number, number];
  });

  const pathD = smoothPath(pointCoords);
  const areaD = `${pathD} L 100,100 L 0,100 Z`;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex gap-2">
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
          {/* Gridlines */}
          <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
            {ticks.map((tick) => (
              <span key={tick} className="bg-chart-grid h-px w-full" />
            ))}
          </div>

          {/* SVG Area Chart */}
          <svg 
            className="absolute inset-0 h-full w-full overflow-visible" 
            preserveAspectRatio="none" 
            viewBox="0 0 100 100"
          >
            <defs>
              <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <path 
              d={areaD} 
              fill="url(#area-gradient)" 
              className="animate-fade" 
            />
            <path 
              d={pathD} 
              fill="none" 
              stroke="var(--primary)" 
              strokeWidth="2" 
              vectorEffect="non-scaling-stroke" 
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Draw dots */}
            {pointCoords.map(([x, y], i) => (
              <circle 
                key={i} 
                cx={x} 
                cy={y} 
                r="4" 
                fill="var(--background)" 
                stroke="var(--primary)" 
                strokeWidth="2" 
                vectorEffect="non-scaling-stroke" 
                className={cn(
                  "transition-all duration-200 pointer-events-none origin-center", 
                  hovered === i ? "opacity-100 scale-125" : "opacity-0 scale-75"
                )} 
                style={{ transformOrigin: `${x}% ${y}%` }}
              />
            ))}
          </svg>

          {/* Invisible hover overlay zones */}
          <div className="absolute inset-0 flex z-10">
            {points.map((point, index) => (
              <div 
                key={point.date} 
                className="h-full flex-1 cursor-crosshair" 
                onMouseEnter={() => setHovered(index)}
              />
            ))}
          </div>

          {hovered !== null && points[hovered] ? (
            <Tooltip point={points[hovered]} index={hovered} total={points.length} />
          ) : null}
        </div>
      </div>

      <div className="text-muted-foreground flex justify-between pl-6 font-mono text-[0.65rem]">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

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
  const fromLeft = index < total / 2;
  const offset = `${((index + 0.5) / total) * 100}%`;

  return (
    <div
      role="tooltip"
      className="bg-foreground text-background animate-fade pointer-events-none absolute -top-1 z-20 -translate-y-full rounded-md px-2 py-1.5 text-xs whitespace-nowrap shadow-lg"
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
