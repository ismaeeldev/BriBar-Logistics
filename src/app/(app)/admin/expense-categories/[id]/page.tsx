/**
 * Edit an expense category (ERP roadmap Phase 3, `/admin/expense-categories/[id]`).
 */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  deleteExpenseCategoryAction,
  updateExpenseCategoryAction,
} from '@/app/(app)/admin/actions';
import { DeleteRecord } from '@/components/admin/delete-record';
import { ExpenseCategoryForm } from '@/components/admin/expense-category-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { ErrorCode, isAppError } from '@/lib/errors/app-error';
import { UI } from '@/lib/i18n/messages';
import { expenseCategoryService } from '@/modules/expense-categories/service/expense-category.service';

export const metadata = { title: UI.admin.expenseCategories.editItem };

export default async function EditExpenseCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireAdmin();
  const { id } = await params;

  let category;
  try {
    category = await expenseCategoryService.getById(actor, id);
  } catch (error) {
    if (isAppError(error) && error.code === ErrorCode.NOT_FOUND) notFound();
    throw error;
  }

  const deletability = await expenseCategoryService.getDeletability(actor, id);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/expense-categories"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.expenseCategories.title}
      </Link>

      <PageHeader
        title={UI.admin.expenseCategories.editItem}
        section={UI.nav.sectionSettings}
        description={category.name}
      />

      <ExpenseCategoryForm
        action={updateExpenseCategoryAction.bind(null, id)}
        submitLabel={UI.common.save}
        initial={{
          name: category.name,
          expenseType: category.expenseType,
          defaultVatRate: category.defaultVatRate,
          isActive: category.isActive,
        }}
      />

      <DeleteRecord
        action={deleteExpenseCategoryAction.bind(null, id)}
        name={category.name}
        deletability={deletability}
      />
    </div>
  );
}
