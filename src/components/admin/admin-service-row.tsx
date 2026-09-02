import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { ServiceStatusBadge } from '@/components/ui/primitives';
import { Td, Tr } from '@/components/ui/table';
import { UI } from '@/lib/i18n/messages';
import { formatBusinessDate } from '@/lib/time/business-date';
import type { ServiceListItem } from '@/modules/services/service/service.presenter';

/**
 * One service row in an admin table (SRS 16.3).
 *
 * Every cell an administrator filters or scans by: date, Service ID, driver,
 * route, vehicle and both calculated totals. The status badge shares the last
 * cell with the chevron so the row does not gain a column that is empty on the
 * approval queue, where every row is pending anyway.
 */
export function AdminServiceRow({
  service,
  showStatus = true,
}: {
  service: ServiceListItem;
  showStatus?: boolean;
}) {
  return (
    <Tr>
      <Td className="whitespace-nowrap">{formatBusinessDate(service.serviceDate)}</Td>
      <Td className="text-muted-foreground font-mono">#{service.serviceCode}</Td>
      <Td className="whitespace-nowrap">{service.driver.name}</Td>
      <Td className="max-w-48 truncate">
        <span className="font-medium">{service.route.code}</span>
        <span className="text-muted-foreground"> · {service.route.name}</span>
      </Td>
      <Td className="font-mono whitespace-nowrap">{service.vehicle.registrationPlate}</Td>
      <Td className="text-right font-mono">{service.actualKm}</Td>
      <Td className="text-right font-mono">{service.serviceKm}</Td>
      <Td className="text-right">
        <div className="flex items-center justify-end gap-2">
          {showStatus ? <ServiceStatusBadge status={service.status} /> : null}
          <Link
            href={`/admin/services/${service.id}`}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap transition-colors"
          >
            {UI.admin.review}
            <ChevronRight aria-hidden className="size-3.5" />
          </Link>
        </div>
      </Td>
    </Tr>
  );
}
