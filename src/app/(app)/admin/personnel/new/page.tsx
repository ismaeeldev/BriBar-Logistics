/** Record a personnel cost (ERP roadmap Phase 5, `/admin/personnel/new`). */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { createPersonnelCostAction } from '@/app/(app)/admin/actions';
import { PersonnelCostForm } from '@/components/admin/personnel-cost-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { UI } from '@/lib/i18n/messages';
import { userRepository } from '@/modules/users/repository/user.repository';

export const metadata = { title: UI.admin.personnel.newCost };

export default async function NewPersonnelCostPage() {
  await requireAdmin();

  const users = await userRepository.list({ isActive: true });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/admin/personnel"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {UI.admin.personnel.title}
      </Link>

      <PageHeader title={UI.admin.personnel.newCost} section={UI.nav.sectionFleet} />

      <PersonnelCostForm
        action={createPersonnelCostAction}
        submitLabel={UI.common.create}
        context={{ users }}
      />
    </div>
  );
}
