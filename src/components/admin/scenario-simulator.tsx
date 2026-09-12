'use client';

import { RotateCcw } from 'lucide-react';
import { useState } from 'react';

import { Field, Input } from '@/components/ui/field';
import { Card, CardBody } from '@/components/ui/primitives';
import { NUMBER_LOCALE, UI } from '@/lib/i18n/messages';
import { formatEuros } from '@/lib/money/money';
import { estimatedFuelCents } from '@/modules/analytics/domain/analytics-math';

/**
 * "SIMULADOR ESCENARIOS" (`00Análisis`, ERP roadmap Phase 6 §4) — matched
 * field-for-field to the client's own spreadsheet (client decision
 * 2026-09-13) rather than the broader full-margin tool this used to be:
 * three inputs (Facturación, Km vacío, Km servicio) and one computed output
 * (Coste combustible vacío), the same shape as the Excel's `W1:Z3` table.
 *
 * `Facturación` and `Km servicio` are collected because the spreadsheet
 * collects them, but — matching the spreadsheet's own formula, which never
 * references them — neither feeds the one calculation here. Only `Km vacío`
 * does, via the same `estimatedFuelCents` formula every other fuel-cost
 * estimate in this app uses, seeded from `AppConfig`'s consumption/price
 * defaults exactly as the spreadsheet reads them from `99_Config` rather
 * than exposing them as editable fields.
 *
 * Purely client-side: it changes nothing and saves nothing.
 */
export interface ScenarioDefaults {
  revenueEuros: number;
  emptyKm: number;
  serviceKm: number;
  /** Litres per 100 km — `AppConfig.defaultConsumptionMlPer100Km / 1000`. */
  consumptionLPer100Km: number;
  /** Euros per litre — `AppConfig.defaultFuelPriceCentsPerLiter / 100`. */
  fuelPriceEurosPerLiter: number;
}

function toNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function ScenarioSimulator({ defaults }: { defaults: ScenarioDefaults }) {
  const [form, setForm] = useState({
    revenue: String(defaults.revenueEuros),
    emptyKm: String(defaults.emptyKm),
    serviceKm: String(defaults.serviceKm),
  });

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const reset = () =>
    setForm({
      revenue: String(defaults.revenueEuros),
      emptyKm: String(defaults.emptyKm),
      serviceKm: String(defaults.serviceKm),
    });

  const emptyKmFuelCents = estimatedFuelCents(
    toNumber(form.emptyKm),
    Math.round(defaults.consumptionLPer100Km * 1_000),
    Math.round(defaults.fuelPriceEurosPerLiter * 100),
  );

  return (
    <Card>
      <CardBody className="space-y-4 pt-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={UI.admin.analytics.simRevenue}>
            {(props) => (
              <Input
                {...props}
                type="text"
                inputMode="decimal"
                value={form.revenue}
                onChange={set('revenue')}
              />
            )}
          </Field>
          <Field label={UI.admin.analytics.simEmptyKm}>
            {(props) => (
              <Input
                {...props}
                type="text"
                inputMode="decimal"
                value={form.emptyKm}
                onChange={set('emptyKm')}
              />
            )}
          </Field>
          <Field label={UI.admin.analytics.simServiceKm}>
            {(props) => (
              <Input
                {...props}
                type="text"
                inputMode="decimal"
                value={form.serviceKm}
                onChange={set('serviceKm')}
              />
            )}
          </Field>
        </div>

        <div className="border-t border-border/40 pt-4">
          <div className="rounded-lg border bg-muted/30 px-3 py-2">
            <p className="text-muted-foreground text-xs">{UI.admin.analytics.simEmptyKmFuelCost}</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
              {formatEuros(emptyKmFuelCents, NUMBER_LOCALE)}
            </p>
          </div>
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
