/**
 * Operational defaults (ERP roadmap Phase 1, `99_Config`, `/admin/config`).
 *
 * A single settings screen, not a list — `AppConfig` has exactly one row
 * (see the model's doc comment in `schema.prisma`), so there is no "new" or
 * "delete" here, only edit.
 */
import { updateConfigAction } from '@/app/(app)/admin/actions';
import { ConfigForm } from '@/components/admin/config-form';
import { Alert, PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { UI } from '@/lib/i18n/messages';
import { centsToInputValue } from '@/lib/money/money';
import { millilitersToInputValue } from '@/lib/units/fuel';
import { configService } from '@/modules/config/service/config.service';

export const metadata = { title: UI.admin.config.title };

export default async function AdminConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ updated?: string }>;
}) {
  await requireAdmin();
  const flags = await searchParams;
  const config = await configService.get();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <PageHeader title={UI.admin.config.title} section={UI.nav.sectionFinance} />
      <p className="text-muted-foreground -mt-3 text-sm">{UI.admin.config.hint}</p>

      {flags.updated ? <Alert tone="success" title={UI.admin.config.saved} /> : null}

      <ConfigForm
        action={updateConfigAction}
        initial={{
          oilChangeIntervalKm: String(config.oilChangeIntervalKm),
          defaultConsumption: millilitersToInputValue(config.defaultConsumptionMlPer100Km),
          defaultFuelPrice: centsToInputValue(config.defaultFuelPriceCentsPerLiter),
        }}
      />
    </div>
  );
}
