'use client';

import { RotateCcw } from 'lucide-react';
import { useState } from 'react';

import { Field, Input } from '@/components/ui/field';
import { Card, CardBody } from '@/components/ui/primitives';
import { NUMBER_LOCALE, UI } from '@/lib/i18n/messages';
import { formatEuros } from '@/lib/money/money';
import { estimatedFuelCents, marginCents, safeRatio } from '@/modules/analytics/domain/analytics-math';
import { cn } from '@/lib/utils/cn';

/**
 * The "scenario simulator" the roadmap asks Phase 6 for (§4) — a what-if
 * calculator over the same `domain/analytics-math` formulas the real figures
 * use, so a projection and a report never disagree about how margin is
 * defined. Purely client-side: it changes nothing and saves nothing.
 *
 * Defaults are seeded from the current period's actuals (passed in) so the
 * first thing shown is "today", and every field is then editable.
 */
export interface ScenarioDefaults {
  revenueEuros: number;
  serviceKm: number;
  /** Litres per 100 km — `AppConfig.defaultConsumptionMlPer100Km / 1000`. */
  consumptionLPer100Km: number;
  /** Euros per litre — `AppConfig.defaultFuelPriceCentsPerLiter / 100`. */
  fuelPriceEurosPerLiter: number;
  personnelEuros: number;
  otherCostsEuros: number;
}

function toNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function ScenarioSimulator({ defaults }: { defaults: ScenarioDefaults }) {
  const [form, setForm] = useState({
    revenue: String(defaults.revenueEuros),
    serviceKm: String(defaults.serviceKm),
    consumption: String(defaults.consumptionLPer100Km),
    fuelPrice: String(defaults.fuelPriceEurosPerLiter),
    personnel: String(defaults.personnelEuros),
    other: String(defaults.otherCostsEuros),
  });

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const reset = () =>
    setForm({
      revenue: String(defaults.revenueEuros),
      serviceKm: String(defaults.serviceKm),
      consumption: String(defaults.consumptionLPer100Km),
      fuelPrice: String(defaults.fuelPriceEurosPerLiter),
      personnel: String(defaults.personnelEuros),
      other: String(defaults.otherCostsEuros),
    });

  const revenueCents = Math.round(toNumber(form.revenue) * 100);
  const personnelCents = Math.round(toNumber(form.personnel) * 100);
  const otherCents = Math.round(toNumber(form.other) * 100);
  const fuelCents = estimatedFuelCents(
    toNumber(form.serviceKm),
    Math.round(toNumber(form.consumption) * 1_000),
    Math.round(toNumber(form.fuelPrice) * 100),
  );
  const margin = marginCents(revenueCents, [fuelCents, personnelCents, otherCents]);
  const ratio = safeRatio(margin, revenueCents);

  return (
    <Card>
      <CardBody className="space-y-4 pt-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={UI.admin.analytics.simRevenue}>
            {(props) => (
              <Input {...props} type="text" inputMode="decimal" value={form.revenue} onChange={set('revenue')} />
            )}
          </Field>
          <Field label={UI.admin.analytics.simServiceKm}>
            {(props) => (
              <Input {...props} type="text" inputMode="decimal" value={form.serviceKm} onChange={set('serviceKm')} />
            )}
          </Field>
          <Field label={UI.admin.analytics.simPersonnel}>
            {(props) => (
              <Input {...props} type="text" inputMode="decimal" value={form.personnel} onChange={set('personnel')} />
            )}
          </Field>
          <Field label={UI.admin.analytics.simConsumption}>
            {(props) => (
              <Input {...props} type="text" inputMode="decimal" value={form.consumption} onChange={set('consumption')} />
            )}
          </Field>
          <Field label={UI.admin.analytics.simFuelPrice}>
            {(props) => (
              <Input {...props} type="text" inputMode="decimal" value={form.fuelPrice} onChange={set('fuelPrice')} />
            )}
          </Field>
          <Field label={UI.admin.analytics.simOtherCosts}>
            {(props) => (
              <Input {...props} type="text" inputMode="decimal" value={form.other} onChange={set('other')} />
            )}
          </Field>
        </div>

        <div className="grid gap-3 border-t border-border/40 pt-4 sm:grid-cols-3">
          <Output label={UI.admin.analytics.simFuelCost} value={formatEuros(fuelCents, NUMBER_LOCALE)} />
          <Output
            label={UI.admin.analytics.simMargin}
            value={formatEuros(margin, NUMBER_LOCALE)}
            tone={margin >= 0 ? 'positive' : 'negative'}
            strong
          />
          <Output
            label={UI.admin.analytics.simMarginRatio}
            value={ratio === null ? '—' : `${(ratio * 100).toFixed(1)}%`}
            tone={ratio !== null && ratio < 0 ? 'negative' : 'positive'}
          />
        </div>

        <button
          type="button"
          onClick={reset}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs transition-colors"
        >
          <RotateCcw aria-hidden className="size-3.5" />
          {UI.admin.analytics.simReset}
        </button>
      </CardBody>
    </Card>
  );
}

function Output({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
  strong?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          'mt-0.5 tabular-nums',
          strong ? 'text-lg font-bold' : 'text-sm font-semibold',
          tone === 'negative' ? 'text-destructive' : tone === 'positive' ? 'text-emerald-600' : 'text-foreground',
        )}
      >
        {value}
      </p>
    </div>
  );
}
