/**
 * Edit a supplier (ERP roadmap Phase 3, `/admin/suppliers/[id]`).
 */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { deleteSupplierAction, updateSupplierAction } from '@/app/(app)/admin/actions';
import { DeleteRecord } from '@/components/admin/delete-record';
import { SupplierForm } from '@/components/admin/supplier-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { ErrorCode, isAppError } from '@/lib/errors/app-error';
import { UI } from '@/lib/i18n/messages';
import { supplierService } from '@/modules/suppliers/service/supplier.service';

export const metadata = { title: UI.admin.editSupplier };

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin();
  const { id } = await params;

  let supplier;
  try {
    supplier = await supplierService.getById(actor, id);
  } catch (error) {
    if (isAppError(error) && error.code === ErrorCode.NOT_FOUND) notFound();
    throw error;
  }

  const deletability = await supplierService.getDeletability(actor, id);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/suppliers"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.suppliersTitle}
      </Link>

      <PageHeader
        title={UI.admin.editSupplier}
        section={UI.nav.sectionMasterData}
        description={supplier.name}
      />

      <SupplierForm
        action={updateSupplierAction.bind(null, id)}
        submitLabel={UI.common.save}
        initial={{ name: supplier.name, taxId: supplier.taxId, isActive: supplier.isActive }}
      />

      <DeleteRecord
        action={deleteSupplierAction.bind(null, id)}
        name={supplier.name}
        deletability={deletability}
      />
    </div>
  );
}
