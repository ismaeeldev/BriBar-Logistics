/** Create a client (ERP roadmap Phase 1, `/admin/clients/new`). */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { createClientAction } from '@/app/(app)/admin/actions';
import { ClientForm } from '@/components/admin/client-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { UI } from '@/lib/i18n/messages';

export const metadata = { title: UI.admin.newClient };

export default async function NewClientPage() {
  await requireAdmin();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/clients"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.clientsTitle}
      </Link>

      <PageHeader title={UI.admin.newClient} section={UI.nav.sectionMasterData} />

      <ClientForm action={createClientAction} submitLabel={UI.common.create} />
    </div>
  );
}
