/**
 * Edit a client (ERP roadmap Phase 1, `/admin/clients/[id]`).
 *
 * Deactivation, not deletion, is the removal path once something references
 * a client — the same SRS 21.5 convention every other master-data entity
 * follows. `getDeletability` currently always allows delete, because nothing
 * references a client yet (see `client.repository.ts`).
 */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { deleteClientAction, updateClientAction } from '@/app/(app)/admin/actions';
import { ClientForm } from '@/components/admin/client-form';
import { DeleteRecord } from '@/components/admin/delete-record';
import { PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { ErrorCode, isAppError } from '@/lib/errors/app-error';
import { UI } from '@/lib/i18n/messages';
import { clientService } from '@/modules/clients/service/client.service';

export const metadata = { title: UI.admin.editClient };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin();
  const { id } = await params;

  let client;
  try {
    client = await clientService.getById(actor, id);
  } catch (error) {
    if (isAppError(error) && error.code === ErrorCode.NOT_FOUND) notFound();
    throw error;
  }

  const deletability = await clientService.getDeletability(actor, id);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/clients"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.clientsTitle}
      </Link>

      <PageHeader title={UI.admin.editClient} section={UI.nav.sectionMasterData} description={client.name} />

      <ClientForm
        action={updateClientAction.bind(null, id)}
        submitLabel={UI.common.save}
        initial={{ name: client.name, taxId: client.taxId, isActive: client.isActive }}
      />

      <DeleteRecord
        action={deleteClientAction.bind(null, id)}
        name={client.name}
        deletability={deletability}
      />
    </div>
  );
}
