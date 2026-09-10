/** Create a route/contract, origin and destination included (SRS 17.3). */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { createRouteAction } from '@/app/(app)/admin/actions';
import { RouteForm } from '@/components/admin/route-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { UI } from '@/lib/i18n/messages';
import { clientService } from '@/modules/clients/service/client.service';

export const metadata = { title: UI.admin.newRoute };

export default async function NewRoutePage() {
  const actor = await requireAdmin();
  const clients = await clientService.list(actor, { isActive: true });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/routes"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.routesTitle}
      </Link>

      <PageHeader title={UI.admin.newRoute} section={UI.nav.sectionMasterData} />

      <RouteForm
        action={createRouteAction}
        submitLabel={UI.admin.createRoute}
        clients={clients}
      />
    </div>
  );
}
