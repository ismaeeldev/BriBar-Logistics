import type { CSSProperties } from 'react';

import { Journey } from '@/components/ui/journey';
import { NUMBER_LOCALE, UI } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';

export interface RouteTotal {
  routeId: string;
  code: string;
  name: string;
  origin: string;
  destination: string;
  services: number;
  serviceKm: number;
}

/**
 * Contracted kilometres by route, busiest first.
 *
 * ## The route is the subject, the distance is the measurement
 *
 * Two earlier versions got this backwards. The first gave the label and the
 * bar equal weight on separate lines; the second painted the share as a wide
 * tinted block behind the whole row, which made a five-row list look like a
 * stack of buttons and put more ink on the page than the data justified.
 *
 * Here the route is a ranked heading — position, code, then the journey it
 * runs — and the quantity is a thin rule under it with the figure at the end.
 * That is the order the question is asked in: *which* route is busiest, then
 * by how much.
 *
 * Sequential and one hue: the job is comparing magnitude, not telling routes
 * apart, so a categorical palette would add colour without adding meaning. The
 * value is direct-labelled, so there is no axis and no legend.
 */
export function RouteBars({ routes, className }: { routes: RouteTotal[]; className?: string }) {
  const peak = Math.max(1, ...routes.map((route) => route.serviceKm));

  return (
    <ol className={cn('space-y-3.5', className)}>
      {routes.map((route, index) => {
        const share = (route.serviceKm / peak) * 100;

        return (
          <li
            key={route.routeId}
            style={{ '--i': index } as CSSProperties}
            className="animate-rise stagger flex gap-3"
          >
            {/* Two digits wide and tabular, so the rules below line up
                whether the ranking runs to 3 or to 12. */}
            <span className="text-muted-foreground w-4 shrink-0 pt-0.5 text-right font-mono text-xs tabular-nums">
              {index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-mono text-sm font-semibold">
                  {route.code}
                </span>
                <span className="shrink-0 text-sm whitespace-nowrap">
                  <span className="font-mono font-medium tabular-nums">
                    {route.serviceKm.toLocaleString(NUMBER_LOCALE)}
                  </span>
                  <span className="text-muted-foreground text-xs"> km</span>
                </span>
              </div>

              <div className="mt-0.5 flex items-baseline justify-between gap-3">
                <Journey
                  origin={route.origin}
                  destination={route.destination}
                  className="text-muted-foreground min-w-0 text-xs"
                />
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {UI.common.servicesShort(route.services)}
                </span>
              </div>

              <div className="bg-muted mt-1.5 h-1 overflow-hidden rounded-full">
                <div
                  className="animate-sweep stagger h-full origin-left rounded-full"
                  style={{
                    width: `${Math.max(3, share)}%`,
                    // Darkest for the leader, lightening down the ranking, so
                    // the order is legible from colour as well as from length.
                    background: `var(--chart-${Math.max(1, 5 - index)})`,
                  }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
