/**
 * Add Service (SRS 9, 17.2 `/services/new`).
 *
 * The context is fetched on the server and passed down, so the browser never
 * decides which routes or vehicles a driver may choose (SRS 14.3).
 */
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { createServiceAction } from '@/app/(app)/services/actions';
import { ServiceForm } from '@/components/services/service-form';
import { Alert, PageHeader } from '@/components/ui/primitives';
import { requireUser } from '@/lib/auth/session';
import { ErrorCode, isAppError } from '@/lib/errors/app-error';
import { toServiceContextDto } from '@/modules/services/service/service.presenter';
import { serviceService } from '@/modules/services/service/service.service';

export const metadata = { title: 'Añadir servicio' };

export default async function NewServicePage() {
  const actor = await requireUser();

  let context;
  try {
    context = await serviceService.getContext(actor);
  } catch (error) {
    // SRS 24.2: "If a Driver has no usable default/assigned route or no usable
    // vehicle configuration, Add Service shall display an actionable message
    // indicating that Admin configuration is required." Not an error page — a
    // page that explains what has to happen next.
    if (isAppError(error) && error.code === ErrorCode.CONFIGURATION_REQUIRED) {
      return (
        <div className="space-y-6">
          <BackLink />
          <PageHeader title="Añadir servicio" />
          <Alert tone="warning" title="Configuración pendiente">
            {error.message}
          </Alert>
        </div>
      );
    }
    throw error;
  }

  return (
    <div className="space-y-5">
      <BackLink />
      <PageHeader
        title="Añadir servicio"
        description="Registre la hoja de ruta del servicio completado."
      />

      {context.routes.length === 1 ? (
        <Alert tone="info">
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle aria-hidden className="size-3.5" />
            Solo tiene una ruta asignada. Si necesita otra, pídasela a un administrador.
          </span>
        </Alert>
      ) : null}

      <ServiceForm
        context={toServiceContextDto(context)}
        action={createServiceAction}
        submitLabel="Enviar servicio"
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/driver"
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Volver
    </Link>
  );
}
