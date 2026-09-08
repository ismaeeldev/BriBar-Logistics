/**
 * Add Service on a driver's behalf (SRS 17.2, client decision #7).
 *
 * `open-questions.md` #7: "Administrators may create services for drivers." The
 * service layer has always supported it (`adminCreateServiceSchema`,
 * `getContext(actor, forDriverId)`, `create` with `driverId`); this is the
 * administrator-facing screen for it, separate from the driver's `/services/new`
 * because the two shells and the two navigations are different.
 *
 * The owning driver is chosen first, in the query string, so the server can load
 * *that* driver's routes and vehicles — the browser never decides what may be
 * picked (SRS 14.3). The driver id is re-checked against `canCreateFor` and the
 * driver's assignments on submit regardless of what this page offered.
 */
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { createServiceAction } from '@/app/(app)/services/actions';
import { ServiceDriverPicker } from '@/components/admin/service-driver-picker';
import { ServiceForm } from '@/components/services/service-form';
import { Alert, Card, CardBody, PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { ErrorCode, isAppError } from '@/lib/errors/app-error';
import { UI } from '@/lib/i18n/messages';
import { Role } from '@/modules/services/domain/service-status';
import { toServiceContextDto } from '@/modules/services/service/service.presenter';
import { serviceService } from '@/modules/services/service/service.service';
import { userRepository } from '@/modules/users/repository/user.repository';

export const metadata = { title: UI.service.addTitle };

export default async function AdminNewServicePage({
  searchParams,
}: {
  searchParams: Promise<{ driverId?: string }>;
}) {
  const actor = await requireAdmin();
  const { driverId } = await searchParams;

  const drivers = await userRepository.list({ role: Role.DRIVER, isActive: true });
  const driverOptions = drivers.map((driver) => ({ id: driver.id, name: driver.name }));
  const selectedDriverId = driverOptions.some((driver) => driver.id === driverId)
    ? driverId
    : undefined;

  let context;
  let contextError: string | undefined;
  if (selectedDriverId) {
    try {
      context = await serviceService.getContext(actor, selectedDriverId);
    } catch (error) {
      // SRS 24.2: an actionable message, not an error page — the driver has no
      // usable route or vehicle, or has been deactivated since the list loaded.
      if (
        isAppError(error) &&
        (error.code === ErrorCode.CONFIGURATION_REQUIRED ||
          error.code === ErrorCode.BUSINESS_RULE_VIOLATION ||
          error.code === ErrorCode.NOT_FOUND)
      ) {
        contextError = error.message;
      } else {
        throw error;
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/services"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.servicesTitle}
      </Link>

      <PageHeader
        title={UI.service.addTitle}
        section={UI.nav.sectionOperations}
        description={UI.service.addSubtitle}
      />

      <Card>
        <CardBody className="pt-5">
          <ServiceDriverPicker drivers={driverOptions} selectedDriverId={selectedDriverId} />
        </CardBody>
      </Card>

      {!selectedDriverId ? (
        <Alert tone="info">{UI.admin.selectDriverToStart}</Alert>
      ) : contextError ? (
        <Alert tone="warning" title={UI.service.configurationRequired}>
          {contextError}
        </Alert>
      ) : context ? (
        <>
          {context.routes.length === 1 ? (
            <Alert tone="info">
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle aria-hidden className="size-3.5" />
                {UI.service.onlyOneRoute}
              </span>
            </Alert>
          ) : null}

          <ServiceForm
            context={toServiceContextDto(context)}
            action={createServiceAction.bind(null, 'admin')}
            submitLabel={UI.service.submit}
            driverId={selectedDriverId}
          />
        </>
      ) : null}
    </div>
  );
}
