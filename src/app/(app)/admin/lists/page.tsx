/**
 * The simple-lookup-lists landing page (ERP roadmap Phase 1, `/admin/lists`).
 *
 * One card per `LookupKind`, not one sidebar entry per kind — four rows for
 * what is essentially configuration would crowd the sidebar for something an
 * administrator visits rarely. `LOOKUP_KINDS` is the single source of what
 * kinds exist, so a fifth kind adds a card here automatically.
 */
import { ChevronRight, ListTree } from 'lucide-react';
import Link from 'next/link';

import { Card, CardBody, PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { LOOKUP_KIND_LABELS, UI } from '@/lib/i18n/messages';
import { LOOKUP_KINDS } from '@/modules/lookup/lookup-kinds';

export const metadata = { title: UI.admin.lookup.sectionTitle };

export default async function AdminListsPage() {
  await requireAdmin();

  return (
    <div className="space-y-5">
      <PageHeader title={UI.admin.lookup.sectionTitle} section={UI.nav.sectionSettings} />
      <p className="text-muted-foreground -mt-2 text-sm">{UI.admin.lookup.sectionHint}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {LOOKUP_KINDS.map((kind) => (
          <Link key={kind} href={`/admin/lists/${kind}`}>
            <Card className="transition-colors hover:bg-muted/30">
              <CardBody className="flex items-center gap-4 py-5">
                <div className="bg-indigo-600/10 text-indigo-500 flex size-11 shrink-0 items-center justify-center rounded-xl">
                  <ListTree className="size-5" />
                </div>
                <span className="flex-1 text-[15px] font-semibold text-foreground">
                  {LOOKUP_KIND_LABELS[kind]}
                </span>
                <ChevronRight aria-hidden className="text-muted-foreground size-4" />
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
