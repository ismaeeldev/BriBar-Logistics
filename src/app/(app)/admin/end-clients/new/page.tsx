/** Create an end client (client change request 2026-09-17, `/admin/end-clients/new`). */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { createEndClientAction } from '@/app/(app)/admin/actions';
import { EndClientForm } from '@/components/admin/end-client-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { UI } from '@/lib/i18n/messages';

export const metadata = { title: UI.admin.newEndClient };

export default async function NewEndClientPage() {
  await requireAdmin();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/end-clients"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.endClientsTitle}
      </Link>

      <PageHeader title={UI.admin.newEndClient} section={UI.nav.sectionMasterData} />

      <EndClientForm action={createEndClientAction} submitLabel={UI.common.create} />
    </div>
  );
}
