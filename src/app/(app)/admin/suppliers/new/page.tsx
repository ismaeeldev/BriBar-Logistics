/** Create a supplier (ERP roadmap Phase 3, `/admin/suppliers/new`). */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { createSupplierAction } from '@/app/(app)/admin/actions';
import { SupplierForm } from '@/components/admin/supplier-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { UI } from '@/lib/i18n/messages';

export const metadata = { title: UI.admin.newSupplier };

export default async function NewSupplierPage() {
  await requireAdmin();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/suppliers"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.suppliersTitle}
      </Link>

      <PageHeader title={UI.admin.newSupplier} section={UI.nav.sectionMasterData} />

      <SupplierForm action={createSupplierAction} submitLabel={UI.common.create} />
    </div>
  );
}
