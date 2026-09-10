/** Create an expense category (ERP roadmap Phase 3, `/admin/expense-categories/new`). */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { createExpenseCategoryAction } from '@/app/(app)/admin/actions';
import { ExpenseCategoryForm } from '@/components/admin/expense-category-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { UI } from '@/lib/i18n/messages';

export const metadata = { title: UI.admin.expenseCategories.newItem };

export default async function NewExpenseCategoryPage() {
  await requireAdmin();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/expense-categories"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.expenseCategories.title}
      </Link>

      <PageHeader title={UI.admin.expenseCategories.newItem} section={UI.nav.sectionSettings} />

      <ExpenseCategoryForm action={createExpenseCategoryAction} submitLabel={UI.common.create} />
    </div>
  );
}
