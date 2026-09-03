import type { CSSProperties } from 'react';

import { NUMBER_LOCALE, UI } from '@/lib/i18n/messages';
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
 * ## The bar is the row
 *
 * This used to be a label line with a separate track underneath it — two rows
 * of vertical space per route, and the label floating free of the quantity it
 * described. Here the fill *is* the row: each route is a single band whose
 * shaded portion is its share of the leader, with the code, the name and the
 * total sitting on top of it.
 *
 * It halves the height, and it puts the comparison and the numbers in the same
 * place, so reading the ranking and reading the values is one movement of the
 * eye rather than two.
 *
 * Horizontal, because the labels are route codes and names: a vertical column
 * chart would either rotate them or truncate them, and both are worse than
 * turning the chart on its side. Sequential and one hue, because the job is
 * comparing magnitude — a categorical palette would add colour without adding
 * meaning. The value is direct-labelled, so there is no axis and no legend.
 *
 * The fill is a tint, never a saturated block: the text on top has to stay
 * readable across the boundary where the fill ends, which rules out painting
 * the bar in the chart ramp and putting ink over it.
 */
export function RouteBars({ routes, className }: { routes: RouteTotal[]; className?: string }) {
  const peak = Math.max(1, ...routes.map((route) => route.serviceKm));

  return (
    <ol className={cn('space-y-1.5', className)}>
      {routes.map((route, index) => {
        const share = (route.serviceKm / peak) * 100;

        return (
          <li
            key={route.routeId}
            style={{ '--i': index } as CSSProperties}
            className="bg-muted/60 animate-rise stagger relative flex h-11 items-center gap-3 overflow-hidden rounded-lg px-3"
          >
            {/* The quantity. Scaled from the left rather than sized by width,
                so it composites instead of laying the row out again. */}
            <span
              aria-hidden
              className="bg-primary-subtle animate-sweep stagger absolute inset-y-0 left-0 origin-left"
              style={{ width: `${Math.max(4, share)}%` }}
            />

            <span className="text-muted-foreground relative w-4 shrink-0 font-mono text-xs tabular-nums">
              {index + 1}
            </span>

            <span className="relative min-w-0 flex-1 truncate text-sm">
              <span className="font-mono font-medium">{route.code}</span>
              <span className="text-muted-foreground"> · {route.name}</span>
            </span>

            <span className="relative shrink-0 text-right text-sm">
              <span className="font-mono font-medium tabular-nums">
                {route.serviceKm.toLocaleString(NUMBER_LOCALE)}
              </span>
              <span className="text-muted-foreground text-xs"> km</span>
              <span className="text-muted-foreground ml-2 hidden text-xs sm:inline">
                {UI.common.servicesShort(route.services)}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
