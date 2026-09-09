/** Create a lookup item (ERP roadmap Phase 1, `/admin/lists/[kind]/new`). */
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { createLookupItemAction } from '@/app/(app)/admin/actions';
import { LookupForm } from '@/components/admin/lookup-form';
import { PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { LOOKUP_KIND_LABELS, UI } from '@/lib/i18n/messages';
import { isLookupKind } from '@/modules/lookup/lookup-kinds';

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  return { title: isLookupKind(kind) ? UI.admin.lookup.newItem : UI.admin.lookup.sectionTitle };
}

export default async function NewLookupItemPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  await requireAdmin();
  const { kind: rawKind } = await params;
  if (!isLookupKind(rawKind)) notFound();
  const kind = rawKind;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <Link
        href={`/admin/lists/${kind}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {LOOKUP_KIND_LABELS[kind]}
      </Link>

      <PageHeader title={UI.admin.lookup.newItem} section={UI.nav.sectionFinance} />

      <LookupForm
        action={createLookupItemAction.bind(null, kind)}
        submitLabel={UI.common.create}
      />
    </div>
  );
}
