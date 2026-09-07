import type { CSSProperties } from 'react';

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

export function RouteBars({ routes, className }: { routes: RouteTotal[]; className?: string }) {
  const peak = Math.max(1, ...routes.map((route) => route.serviceKm));

  return (
    <ol className={cn('space-y-5', className)}>
      {routes.map((route, index) => {
        const share = (route.serviceKm / peak) * 100;

        return (
          <li
            key={route.routeId}
            style={{ '--i': index } as CSSProperties}
            className="animate-rise stagger flex items-center gap-4"
          >
            {/* Circular Progress Indicator */}
            <div className="relative flex shrink-0 items-center justify-center size-10">
               <svg className="size-full -rotate-90" viewBox="0 0 36 36">
                  {/* Background Circle */}
                  <path
                    className="stroke-muted"
                    fill="none"
                    strokeWidth="3.5"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Progress Circle */}
                  <path
                    className="stroke-primary animate-draw"
                    fill="none"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={`${share}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
               </svg>
               <span className="absolute text-[11px] font-medium text-foreground tabular-nums leading-none">
                 #{index + 1}
               </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-xs text-foreground" title={route.code}>
                  {route.code.length > 10 ? route.code.slice(0, 10) + '…' : route.code}
                </span>
                <span className="shrink-0 text-xs whitespace-nowrap text-foreground">
                  <span className="tabular-nums font-normal">
                    {route.serviceKm.toLocaleString(NUMBER_LOCALE)}
                  </span>
                  <span className="text-muted-foreground text-xs font-normal"> km</span>
                </span>
              </div>

              <div className="mt-0.5 flex justify-between">
                <span className="text-muted-foreground text-[11px] truncate mr-4" title={route.name}>
                  {route.name.length > 10 ? route.name.slice(0, 10) + '…' : route.name}
                </span>
                <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                  {UI.common.servicesShort(route.services)}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
