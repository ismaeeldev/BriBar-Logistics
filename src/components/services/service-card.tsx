import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { StatusDot } from '@/components/ui/primitives';
import { CardField } from '@/components/ui/responsive-list';
import { FIELD_LABELS } from '@/lib/i18n/messages';
import { formatBusinessDate } from '@/lib/time/business-date';
import type { ServiceListItem } from '@/modules/services/service/service.presenter';

/**
 * One service in a list (SRS 15.3).
 *
 * The SRS lists what must be identifiable at a glance: Service ID, date,
 * Route/Contract, vehicle, Actual Km, Service Km and status. All seven are
 * here.
 *
 * A card rather than a table row. A seven-column table on a 375px screen either
 * scrolls horizontally, which SRS 23.1 forbids for core actions, or truncates
 * the route name to nothing.
 *
 * The layout is stacked rather than two-column for the same reason. Putting the
 * status in a right-hand column looks fine on a desktop and costs about 180px
 * on a phone — enough to truncate "MAD-BCN-01 — Madrid - Barcelona" to
 * "MAD-BCN-01 …" and push the mileage onto three lines. It sits on the header
 * row instead, so every line below it gets the full width.
 *
 * And it is a dot rather than a word, which is the same trade taken further:
 * `StatusDot` carries the status as screen-reader text and as a `title`, and
 * the list it appears in states the mapping in words. See `StatusDot`.
 */
export function ServiceCard({ service }: { service: ServiceListItem }) {
  return (
    <Link
      href={`/services/${service.id}`}
      className="group bg-card hover:bg-muted/60 block border-b px-4 py-3.5 transition-colors last:border-b-0"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="text-sm font-semibold">
            {formatBusinessDate(service.serviceDate)}
          </span>
          <span className="text-muted-foreground font-mono text-xs">
            #{service.serviceCode}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <StatusDot status={service.status} />
          <ChevronRight
            aria-hidden
            className="text-muted-foreground group-hover:text-foreground size-4 transition-colors"
          />
        </div>
      </div>

      <p className="mt-1.5 truncate text-sm">
        <span className="font-medium">{service.route.code}</span>
        <span className="text-muted-foreground"> · {service.route.name}</span>
      </p>

      {/* Labelled fields rather than a run-on meta line: the labels come from
          the dictionary, so the card reads the same in either locale, and the
          two mileage figures line up between cards instead of shifting with
          the length of the plate beside them. */}
      <dl className="mt-2 grid grid-cols-3 gap-3">
        <CardField label={FIELD_LABELS.vehicle} mono>
          {service.vehicle.registrationPlate}
        </CardField>
        <CardField label={FIELD_LABELS.actualKm} mono>
          {service.actualKm}
        </CardField>
        <CardField label={FIELD_LABELS.serviceKm} mono>
          {service.serviceKm}
        </CardField>
      </dl>
    </Link>
  );
}
