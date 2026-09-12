/**
 * Analytics (ERP roadmap Phase 6, `00Dashboard` / `00Análisis`, `/admin/analytics`).
 *
 * Read-only and entirely derived — no table, no migration — see
 * `analyticsService`'s doc comment and ADR 0017. This is the financial and
 * operational analysis layer that sits alongside the operational dashboard at
 * `/admin` (which stays as it is: approvals, pending work, the 14-day
 * activity trend).
 *
 * Client decision 2026-09-13 dropped the per-vehicle/per-contract/per-driver
 * breakdown tables (they were not calculating correctly against the client's
 * spreadsheet and are deferred) in favour of a single "Todos" or one-vehicle
 * filter on the headline KPIs, and moved "Recuperación de la inversión" to
 * `/admin/investments`, next to the investment totals it is computed from.
 */
import { ChartColumn, TrendingUp, Wrench } from 'lucide-react';

import { MarginTrend } from '@/components/charts/margin-trend';
import { ScenarioSimulator } from '@/components/admin/scenario-simulator';
import { Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader } from '@/components/ui/primitives';
import { requireAdmin } from '@/lib/auth/session';
import { NUMBER_LOCALE, UI } from '@/lib/i18n/messages';
import { centsToEuros, formatEuros } from '@/lib/money/money';
import { formatLiters } from '@/lib/units/fuel';
import { analyticsService } from '@/modules/analytics/service/analytics.service';
import { analyticsFilterSchema } from '@/modules/analytics/schemas/analytics.schema';
import { analyticsRepository } from '@/modules/analytics/repository/analytics.repository';
import { configRepository } from '@/modules/config/repository/config.repository';
import { cn } from '@/lib/utils/cn';

export const metadata = { title: UI.admin.analytics.title };

const A = UI.admin.analytics;

function pct(ratio: number | null): string {
  return ratio === null ? '—' : `${(ratio * 100).toFixed(1)}%`;
}

function km(value: number): string {
  return `${value.toLocaleString(NUMBER_LOCALE)} km`;
}

function euros(cents: number): string {
  return formatEuros(cents, NUMBER_LOCALE);
}

/** One headline figure. */
function Stat({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
  sub?: string | undefined;
}) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-bold tabular-nums',
          tone === 'negative'
            ? 'text-destructive'
            : tone === 'positive'
              ? 'text-emerald-600'
              : 'text-foreground',
        )}
      >
        {value}
      </p>
      {sub ? <p className="text-muted-foreground mt-0.5 text-[11px]">{sub}</p> : null}
    </div>
  );
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdmin();
  const params = await searchParams;
  const filter = analyticsFilterSchema.parse(params);

  const [overview, monthly, vehicles, config] = await Promise.all([
    analyticsService.overview(actor, filter),
    analyticsService.monthlyMargin(actor),
    analyticsRepository.vehicles(),
    configRepository.get(),
  ]);

  const years = [...new Set(monthly.map((row) => row.year))].sort((a, b) => b - a);
  const hasData =
    overview.revenueCents > 0 ||
    overview.fuelCents > 0 ||
    overview.personnelCents > 0 ||
    overview.serviceCount > 0;

  const periodText =
    filter.year === undefined
      ? A.allTime
      : filter.month === undefined
        ? String(filter.year)
        : `${String(filter.month).padStart(2, '0')}/${filter.year}`;

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === filter.vehicleId);

  return (
    <div className="space-y-6">
      <PageHeader
        title={A.title}
        section={UI.nav.sectionOperations}
        description={`${A.periodLabel}: ${periodText}${selectedVehicle ? ` · ${selectedVehicle.registrationPlate}` : ''}`}
        filters={
          <form method="get" className="flex flex-wrap items-center gap-2">
            <select
              name="year"
              defaultValue={filter.year ?? ''}
              className="border-input bg-card h-9 rounded-lg border px-2 text-sm"
            >
              <option value="">{A.allYears}</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <select
              name="month"
              defaultValue={filter.month ?? ''}
              className="border-input bg-card h-9 rounded-lg border px-2 text-sm"
            >
              <option value="">{A.allMonths}</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {String(month).padStart(2, '0')}
                </option>
              ))}
            </select>
            {/* "Todos" (client decision 2026-09-13): an empty value scopes the
                KPIs back to the whole fleet. */}
            <select
              name="vehicleId"
              defaultValue={filter.vehicleId ?? ''}
              className="border-input bg-card h-9 rounded-lg border px-2 text-sm"
            >
              <option value="">{A.allVehicles}</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.registrationPlate}
                  {vehicle.referenceName ? ` — ${vehicle.referenceName}` : ''}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-primary text-primary-foreground h-9 rounded-lg px-3 text-sm font-medium"
            >
              {A.apply}
            </button>
          </form>
        }
      />

      {!hasData ? (
        <EmptyState icon={ChartColumn} title={A.noData} description={A.noDataHint} />
      ) : (
        <>
          {/* Headline KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={A.revenue} value={euros(overview.revenueCents)} />
            <Stat label={A.fuelCost} value={euros(overview.fuelCents)} />
            {/* Personnel cost cannot be attributed to one vehicle - hidden
                rather than shown as a misleading fleet-wide figure. */}
            {overview.filter.vehicleId === null ? (
              <Stat label={A.personnelCost} value={euros(overview.personnelCents)} />
            ) : null}
            <Stat label={A.operatingExpense} value={euros(overview.operatingExpenseCents)} />
            <Stat
              label={A.margin}
              value={euros(overview.marginCents)}
              tone={overview.marginCents >= 0 ? 'positive' : 'negative'}
            />
            <Stat
              label={A.marginRatio}
              value={pct(overview.marginRatio)}
              tone={
                overview.marginRatio !== null && overview.marginRatio < 0 ? 'negative' : 'positive'
              }
            />
            <Stat
              label={A.emptyKm}
              value={km(overview.emptyKm)}
              sub={`${A.actualKmColumn}: ${km(overview.actualKm)}`}
            />
            <Stat
              label={A.avgConsumption}
              value={
                overview.avgConsumptionMlPer100Km === null
                  ? '—'
                  : `${formatLiters(overview.avgConsumptionMlPer100Km, NUMBER_LOCALE)}/100km`
              }
              sub={
                overview.avgFuelPriceCentsPerLiter === null
                  ? undefined
                  : `${A.avgFuelPrice}: ${euros(overview.avgFuelPriceCentsPerLiter)}/L`
              }
            />
          </div>

          {/* Margin trend */}
          {monthly.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  <TrendingUp className="size-5 text-emerald-600" />
                  {A.marginTrendTitle}
                </CardTitle>
                <p className="text-muted-foreground text-xs">{A.marginTrendHint}</p>
              </CardHeader>
              <CardBody>
                <MarginTrend points={monthly} />
              </CardBody>
            </Card>
          ) : null}
        </>
      )}

      {/* Scenario simulator — always shown, seeded with the current period. */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Wrench className="size-5 text-muted-foreground" />
            {A.simulatorTitle}
          </CardTitle>
          <p className="text-muted-foreground text-xs">{A.simulatorHint}</p>
        </CardHeader>
        <CardBody>
          <ScenarioSimulator
            defaults={{
              revenueEuros: Math.round(centsToEuros(overview.revenueCents)),
              emptyKm: overview.emptyKm,
              serviceKm: overview.serviceKm,
              consumptionLPer100Km: config.defaultConsumptionMlPer100Km / 1_000,
              fuelPriceEurosPerLiter: config.defaultFuelPriceCentsPerLiter / 100,
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
