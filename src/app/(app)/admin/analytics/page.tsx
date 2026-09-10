/**
 * Analytics (ERP roadmap Phase 6, `00Dashboard` / `00Análisis`, `/admin/analytics`).
 *
 * Read-only and entirely derived — no table, no migration — see
 * `analyticsService`'s doc comment and ADR 0017. This is the financial and
 * operational analysis layer that sits alongside the operational dashboard at
 * `/admin` (which stays as it is: approvals, pending work, the 14-day
 * activity trend).
 */
import { ChartColumn, Gauge, PiggyBank, TrendingUp, Users, Wrench } from 'lucide-react';

import { MarginTrend } from '@/components/charts/margin-trend';
import { ScenarioSimulator } from '@/components/admin/scenario-simulator';
import { Card, CardBody, CardHeader, CardTitle, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Td, Th } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/session';
import { NUMBER_LOCALE, UI } from '@/lib/i18n/messages';
import { centsToEuros, formatEuros } from '@/lib/money/money';
import { formatLiters } from '@/lib/units/fuel';
import { analyticsService } from '@/modules/analytics/service/analytics.service';
import { analyticsFilterSchema } from '@/modules/analytics/schemas/analytics.schema';
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

function centsPerKm(value: number | null): string {
  return value === null ? '—' : formatEuros(value, NUMBER_LOCALE);
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

  const [overview, monthly, perVehicle, perContract, perDriver, recovery, config] =
    await Promise.all([
      analyticsService.overview(actor, filter),
      analyticsService.monthlyMargin(actor),
      analyticsService.perVehicle(actor, filter),
      analyticsService.perContract(actor, filter),
      analyticsService.perDriver(actor, filter),
      analyticsService.investmentRecovery(actor),
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={A.title}
        section={UI.nav.sectionOperations}
        description={`${A.periodLabel}: ${periodText}`}
        filters={
          <form method="get" className="flex items-center gap-2">
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
            <Stat label={A.personnelCost} value={euros(overview.personnelCents)} />
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

          {/* Per vehicle */}
          <Section icon={<Gauge className="size-5 text-sky-600" />} title={A.perVehicleTitle}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <Th>{A.vehicleColumn}</Th>
                  <Th>{A.revenue}</Th>
                  <Th>{A.fuelCost}</Th>
                  <Th>{A.margin}</Th>
                  <Th className="hidden lg:table-cell">{A.actualKmColumn}</Th>
                  <Th className="hidden lg:table-cell">{A.emptyKmColumn}</Th>
                  <Th className="hidden lg:table-cell">{A.fuelPerKmColumn}</Th>
                </tr>
              </thead>
              <tbody>
                {perVehicle.map((row) => (
                  <tr key={row.vehicleId} className="border-b last:border-0">
                    <Td className="py-2.5 font-semibold uppercase">{row.plate}</Td>
                    <Td className="py-2.5">{euros(row.revenueCents)}</Td>
                    <Td className="py-2.5">{euros(row.fuelCents)}</Td>
                    <Td
                      className={cn(
                        'py-2.5 font-bold',
                        row.marginCents >= 0 ? 'text-emerald-600' : 'text-destructive',
                      )}
                    >
                      {euros(row.marginCents)}
                    </Td>
                    <Td className="hidden py-2.5 lg:table-cell">{km(row.actualKm)}</Td>
                    <Td className="hidden py-2.5 lg:table-cell">
                      {km(row.emptyKm)} · {pct(row.emptyKmRatio)}
                    </Td>
                    <Td className="hidden py-2.5 lg:table-cell">
                      {centsPerKm(row.fuelCostPerKmCents)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* Per contract */}
          <Section icon={<ChartColumn className="size-5 text-violet-600" />} title={A.perContractTitle}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <Th>{A.contractColumn}</Th>
                  <Th className="hidden lg:table-cell">{A.clientColumn}</Th>
                  <Th>{A.servicesColumn}</Th>
                  <Th>{A.revenue}</Th>
                  <Th className="hidden lg:table-cell">{A.serviceKmColumn}</Th>
                  <Th>{A.revenuePerKmColumn}</Th>
                  <Th className="hidden lg:table-cell">{A.efficiencyColumn}</Th>
                  <Th>{A.margin}</Th>
                </tr>
              </thead>
              <tbody>
                {perContract.map((row) => (
                  <tr key={row.routeId} className="border-b last:border-0">
                    <Td className="py-2.5">
                      <span className="font-semibold">{row.code}</span>
                      <span className="text-muted-foreground ml-1.5 text-xs">{row.name}</span>
                    </Td>
                    <Td className="text-muted-foreground hidden py-2.5 text-xs lg:table-cell">
                      {row.clientName ?? '—'}
                    </Td>
                    <Td className="py-2.5">{row.serviceCount}</Td>
                    <Td className="py-2.5">{euros(row.revenueCents)}</Td>
                    <Td className="hidden py-2.5 lg:table-cell">{km(row.serviceKm)}</Td>
                    <Td className="py-2.5">{centsPerKm(row.revenuePerServiceKmCents)}</Td>
                    <Td className="hidden py-2.5 lg:table-cell">{pct(row.efficiencyRatio)}</Td>
                    <Td
                      className={cn(
                        'py-2.5 font-bold',
                        row.marginCents >= 0 ? 'text-emerald-600' : 'text-destructive',
                      )}
                    >
                      {euros(row.marginCents)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* Per driver */}
          <Section icon={<Users className="size-5 text-amber-600" />} title={A.perDriverTitle}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <Th>{A.driverColumn}</Th>
                  <Th>{A.servicesColumn}</Th>
                  <Th className="hidden lg:table-cell">{A.daysWorkedColumn}</Th>
                  <Th className="hidden lg:table-cell">{A.actualKmColumn}</Th>
                  <Th>{A.revenue}</Th>
                  <Th>{A.revenuePerKmColumn}</Th>
                  <Th className="hidden lg:table-cell">{A.avgTicketColumn}</Th>
                </tr>
              </thead>
              <tbody>
                {perDriver.map((row) => (
                  <tr key={row.driverId} className="border-b last:border-0">
                    <Td className="py-2.5 font-semibold">{row.name}</Td>
                    <Td className="py-2.5">{row.serviceCount}</Td>
                    <Td className="hidden py-2.5 lg:table-cell">{row.daysWorked}</Td>
                    <Td className="hidden py-2.5 lg:table-cell">{km(row.actualKm)}</Td>
                    <Td className="py-2.5">{euros(row.revenueCents)}</Td>
                    <Td className="py-2.5">{centsPerKm(row.revenuePerActualKmCents)}</Td>
                    <Td className="hidden py-2.5 lg:table-cell">
                      {row.averageTicketCents === null ? '—' : euros(row.averageTicketCents)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* Investment recovery */}
          {recovery.length > 0 ? (
            <Section
              icon={<PiggyBank className="size-5 text-emerald-600" />}
              title={A.recoveryTitle}
              hint={A.recoveryHint}
            >
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <Th>{A.vehicleColumn}</Th>
                    <Th>{A.investmentColumn}</Th>
                    <Th>{A.profitColumn}</Th>
                    <Th>{A.recoveryColumn}</Th>
                    <Th>{A.outstandingColumn}</Th>
                  </tr>
                </thead>
                <tbody>
                  {recovery.map((row) => (
                    <tr key={row.vehicleId} className="border-b last:border-0">
                      <Td className="py-2.5 font-semibold uppercase">{row.plate}</Td>
                      <Td className="py-2.5">{euros(row.investmentCents)}</Td>
                      <Td
                        className={cn(
                          'py-2.5',
                          row.cumulativeProfitCents >= 0 ? '' : 'text-destructive',
                        )}
                      >
                        {euros(row.cumulativeProfitCents)}
                      </Td>
                      <Td className="py-2.5">
                        {row.recovered ? (
                          <span className="text-emerald-600 font-semibold">{A.recovered}</span>
                        ) : (
                          pct(row.recoveryRatio)
                        )}
                      </Td>
                      <Td className="py-2.5">{euros(row.outstandingCents)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
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
              serviceKm: overview.serviceKm,
              consumptionLPer100Km: config.defaultConsumptionMlPer100Km / 1_000,
              fuelPriceEurosPerLiter: config.defaultFuelPriceCentsPerLiter / 100,
              personnelEuros: Math.round(centsToEuros(overview.personnelCents)),
              otherCostsEuros: Math.round(centsToEuros(overview.operatingExpenseCents)),
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}

function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {icon}
          {title}
        </CardTitle>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </CardHeader>
      <CardBody className="overflow-x-auto">{children}</CardBody>
    </Card>
  );
}
