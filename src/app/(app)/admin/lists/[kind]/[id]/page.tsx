/**
 * Edit a lookup item (ERP roadmap Phase 1, `/admin/lists/[kind]/[id]`).
 */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { deleteLookupItemAction, updateLookupItemAction } from '@/app/(app)/admin/actions';
import { DeleteRecord } from '@/components/admin/delete-record';
import { LookupForm } from '@/components/admin/lookup-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { ErrorCode, isAppError } from '@/lib/errors/app-error';
import { LOOKUP_KIND_LABELS, UI } from '@/lib/i18n/messages';
import { isLookupKind } from '@/modules/lookup/lookup-kinds';
import { lookupService } from '@/modules/lookup/service/lookup.service';

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  return {
    title: isLookupKind(kind) ? UI.admin.lookup.editItem(LOOKUP_KIND_LABELS[kind]) : UI.admin.lookup.sectionTitle,
  };
}

export default async function EditLookupItemPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const actor = await requireAdmin();
  const { kind: rawKind, id } = await params;
  if (!isLookupKind(rawKind)) notFound();
  const kind = rawKind;

  let item;
  try {
    item = await lookupService.getById(actor, kind, id);
  } catch (error) {
    if (isAppError(error) && error.code === ErrorCode.NOT_FOUND) notFound();
    throw error;
  }

  const deletability = await lookupService.getDeletability(actor, kind, id);
  const kindLabel = LOOKUP_KIND_LABELS[kind];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href={`/admin/lists/${kind}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {kindLabel}
      </Link>

      <PageHeader
        title={UI.admin.lookup.editItem(kindLabel)}
        section={UI.nav.sectionFinance}
        description={item.name}
      />

      <LookupForm
        action={updateLookupItemAction.bind(null, kind, id)}
        submitLabel={UI.common.save}
        initial={{ name: item.name, isActive: item.isActive }}
      />

      <DeleteRecord
        action={deleteLookupItemAction.bind(null, kind, id)}
        name={item.name}
        deletability={deletability}
      />
    </div>
  );
}
