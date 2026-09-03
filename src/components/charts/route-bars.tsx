import type { CSSProperties } from 'react';

import { UI } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';

export interface RouteTotal {
  routeId: string;
  code: string;
  name: string;
  services: number;
  serviceKm: number;
}

/**
 * Contracted kilometres by route, busiest first.
 *
 * Horizontal bars, because the labels are route codes and names — a vertical
 * column chart would either rotate them or truncate them, and both are worse
 * than turning the chart on its side.
 *
 * Sequential, one hue, more-is-darker: the job is comparing magnitude, not
 * telling routes apart, so a categorical palette would add colour without
 * adding meaning. The value is direct-labelled at the end of each bar, so the
 * chart needs no axis and no legend.
 *
 * Plain divs rather than SVG — a bar chart is a list of proportional widths,
 * and HTML gives text wrapping and hover states for free.
 *
 * The bars sweep out from the axis on first paint, one after another. That is
 * the ranking being drawn rather than an effect: the eye follows the order the
 * chart is sorted in. It animates a `transform`, not a `width`, so it
 * composites instead of laying the page out five more times.
 */
export function RouteBars({ routes, className }: { routes: RouteTotal[]; className?: string }) {
  const peak = Math.max(1, ...routes.map((route) => route.serviceKm));

  // Darkest step for the leader, lightest for the tail, so the ranking is
  // legible from colour alone as well as from length.
  const steps = [
    'var(--chart-5)',
    'var(--chart-4)',
    'var(--chart-3)',
    'var(--chart-2)',
    'var(--chart-1)',
  ];

  return (
    <ul className={cn('space-y-3', className)}>
      {routes.map((route, index) => {
        const share = (route.serviceKm / peak) * 100;

        return (
          <li
            key={route.routeId}
            style={{ '--i': index } as CSSProperties}
            className="animate-rise stagger group space-y-1.5"
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-mono font-medium">{route.code}</span>
                <span className="text-muted-foreground"> · {route.name}</span>
              </span>
              <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                <span className="text-foreground font-medium">{route.serviceKm}</span> km
                <span className="opacity-60">
                  {' · '}
                  {UI.common.servicesShort(route.services)}
                </span>
              </span>
            </div>

            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className="animate-sweep stagger h-full origin-left rounded-full transition-transform duration-300 group-hover:scale-y-125"
                style={{
                  width: `${Math.max(2, share)}%`,
                  background: steps[Math.min(index, steps.length - 1)],
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
