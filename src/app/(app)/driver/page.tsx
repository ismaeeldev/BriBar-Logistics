/**
 * Driver dashboard (SRS 15).
 *
 * SRS 15.1: "minimize navigation and make the Add Service workflow immediately
 * accessible." So the page is ordered by what a driver came here to do — the
 * Add Service action is the first thing on screen and the largest thing on it,
 * with the two lists below rather than competing for the top.
 */
import { ClipboardList, Plus } from 'lucide-react';
import Link from 'next/link';

import { ServiceCard } from '@/components/services/service-card';
import {
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
} from '@/components/ui/primitives';
import { requireDriver } from '@/lib/auth/session';
import { SERVICE_STATUS_LABELS } from '@/lib/i18n/messages';
import { ServiceStatus } from '@/modules/services/domain/service-status';
import { serviceRepository } from '@/modules/services/repository/service.repository';
import { toServiceListItem } from '@/modules/services/service/service.presenter';

export const metadata = { title: 'Mis servicios' };

export default async function DriverDashboard() {
  const actor = await requireDriver();

  const [pending, recent] = await Promise.all([
    serviceRepository.listRecent(actor, [ServiceStatus.PENDING_APPROVAL], 20),
    serviceRepository.listRecent(actor, [ServiceStatus.APPROVED], 5),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hola, ${actor.name.split(' ')[0]}`}
        description="Panel del conductor"
      />

      {/*
        SRS 15.1 and 9.1: the primary action, "visually prominent and
        touch-friendly on mobile". Full width and 52px tall on a phone, so it
        is unmissable and hard to mis-tap.
      */}
      <Link
        href="/services/new"
        className="bg-primary text-primary-foreground hover:bg-primary-hover flex h-14 w-full items-center justify-center gap-2.5 rounded-xl text-base font-semibold shadow-xs transition-colors sm:h-13 sm:w-auto sm:px-8"
      >
        <Plus aria-hidden className="size-5" />
        Añadir servicio
      </Link>

      {/* SRS 15.2: Pending Approval list. */}
      <Card className="overflow-hidden">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>{SERVICE_STATUS_LABELS.PENDING_APPROVAL}</CardTitle>
          {pending.length > 0 ? (
            <span className="bg-pending-surface text-pending border-pending-border rounded-full border px-2 py-0.5 text-xs font-medium">
              {pending.length}
            </span>
          ) : null}
        </CardHeader>

        {pending.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No hay servicios pendientes"
            description="Los servicios que envíe aparecerán aquí hasta que un administrador los apruebe."
          />
        ) : (
          <div>
            {pending.map((service) => (
              <ServiceCard key={service.id} service={toServiceListItem(service)} />
            ))}
          </div>
        )}
      </Card>

      {/* SRS 15.2: recent/Approved list, plus the link to the full history. */}
      <Card className="overflow-hidden">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Aprobados recientemente</CardTitle>
          <Link href="/services" className="text-primary text-xs font-medium hover:underline">
            Ver historial
          </Link>
        </CardHeader>

        {recent.length === 0 ? (
          <EmptyState
            title="Todavía no hay servicios aprobados"
            description="Aquí verá sus últimos servicios aprobados."
          />
        ) : (
          <div>
            {recent.map((service) => (
              <ServiceCard key={service.id} service={toServiceListItem(service)} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
