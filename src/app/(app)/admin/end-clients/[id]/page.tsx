/**
 * Edit an end client (client change request 2026-09-17, `/admin/end-clients/[id]`).
 *
 * Deactivation, not deletion, is the removal path once a route references
 * an end client — the same SRS 21.5 convention every other master-data
 * entity follows.
 */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { deleteEndClientAction, updateEndClientAction } from '@/app/(app)/admin/actions';
import { DeleteRecord } from '@/components/admin/delete-record';
import { EndClientForm } from '@/components/admin/end-client-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { ErrorCode, isAppError } from '@/lib/errors/app-error';
import { UI } from '@/lib/i18n/messages';
import { endClientService } from '@/modules/end-clients/service/end-client.service';

export const metadata = { title: UI.admin.editEndClient };

export default async function EditEndClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireAdmin();
  const { id } = await params;

  let endClient;
  try {
    endClient = await endClientService.getById(actor, id);
  } catch (error) {
    if (isAppError(error) && error.code === ErrorCode.NOT_FOUND) notFound();
    throw error;
  }

  const deletability = await endClientService.getDeletability(actor, id);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/end-clients"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.endClientsTitle}
      </Link>

      <PageHeader
        title={UI.admin.editEndClient}
        section={UI.nav.sectionMasterData}
        description={endClient.name}
      />

      <EndClientForm
        action={updateEndClientAction.bind(null, id)}
        submitLabel={UI.common.save}
        initial={{ name: endClient.name, taxId: endClient.taxId, isActive: endClient.isActive }}
      />

      <DeleteRecord
        action={deleteEndClientAction.bind(null, id)}
        name={endClient.name}
        deletability={deletability}
      />
    </div>
  );
}
