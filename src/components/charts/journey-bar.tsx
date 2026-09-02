import { FIELD_LABELS, UI } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';

/**
 * One service's four odometer readings, drawn as the journey they describe.
 *
 * The readings are not four independent numbers — they are three consecutive
 * legs of a day:
 *
 *     Start Dashboard ──→ Start Base ══→ End Base ──→ End Dashboard
 *          approach          the service         return
 *
 * The middle leg is the contracted work; the outer two are the driving it took
 * to get to it and back. A table of four numbers hides that entirely, and the
 * ratio between them is the operationally interesting fact: a service that
 * covered 60 contracted kilometres inside a 260-kilometre day is a very
 * different record from one inside a 70-kilometre day.
 *
 * ## Why emphasis rather than three colours
 *
 * This is part-to-whole, but the parts are not peers. One segment is the point
 * and two are context, so the service leg takes the brand hue and the dead legs
 * take a single de-emphasis grey. Three categorical colours would give equal
 * visual weight to the two segments nobody is paid for.
 *
 * Derived entirely from values already on the record — nothing new is stored,
 * and this is a reading of the data, not the reporting module SRS 29 excludes.
 */
export function JourneyBar({
  startDashboardKm,
  startBaseKm,
  endBaseKm,
  endDashboardKm,
  className,
}: {
  startDashboardKm: number;
  startBaseKm: number;
  endBaseKm: number;
  endDashboardKm: number;
  className?: string;
}) {
  const approach = Math.max(0, startBaseKm - startDashboardKm);
  const service = Math.max(0, endBaseKm - startBaseKm);
  const returnLeg = Math.max(0, endDashboardKm - endBaseKm);
  const total = Math.max(1, approach + service + returnLeg);

  const share = (km: number) => (km / total) * 100;

  /**
   * A zero-length leg is dropped rather than drawn at a minimum width.
   *
   * Starting the day already parked at the loading base is a real and common
   * case — the mileage rules permit it deliberately — and showing a sliver
   * there would claim distance that was not driven.
   */
  const legs = [
    { key: 'approach', km: approach, label: UI.service.legApproach, emphasis: false },
    { key: 'service', km: service, label: FIELD_LABELS.serviceKm, emphasis: true },
    { key: 'return', km: returnLeg, label: UI.service.legReturn, emphasis: false },
  ].filter((leg) => leg.km > 0);

  const productiveShare = Math.round((service / total) * 100);

  return (
    <div className={cn('space-y-3', className)}>
      {/* The bar. A 2px gap between fills so adjacent segments read as separate
          quantities rather than one shape changing colour. */}
      <div className="flex h-9 gap-0.5 overflow-hidden rounded-lg">
        {legs.map((leg) => (
          <div
            key={leg.key}
            title={`${leg.label}: ${leg.km} km`}
            className={cn(
              'flex items-center justify-center transition-opacity',
              leg.emphasis ? 'bg-chart-5' : 'bg-chart-muted',
            )}
            style={{ width: `${share(leg.km)}%` }}
          >
            {/* Direct-labelled only where the segment is wide enough to hold
                the number without clipping it. */}
            {share(leg.km) > 14 ? (
              <span
                className={cn(
                  'font-mono text-xs font-medium tabular-nums',
                  leg.emphasis ? 'text-primary-foreground' : 'text-muted-foreground',
                )}
              >
                {leg.km}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {/* The four readings, positioned at the boundaries they mark. */}
      <div className="text-muted-foreground flex items-start justify-between gap-2 font-mono text-[0.65rem]">
        <Reading value={startDashboardKm} align="start" />
        <Reading value={endDashboardKm} align="end" />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        <Key colour="bg-chart-5" label={FIELD_LABELS.serviceKm} value={`${service} km`} />
        <Key
          colour="bg-chart-muted"
          label={UI.service.legEmpty}
          value={`${approach + returnLeg} km`}
        />
        <span className="text-muted-foreground ml-auto">
          {UI.service.productiveShare(productiveShare)}
        </span>
      </div>
    </div>
  );
}

function Reading({ value, align }: { value: number; align: 'start' | 'end' }) {
  return (
    <span className={align === 'end' ? 'text-right' : ''}>
      <span className="text-foreground block font-medium">{value}</span>
      <span className="opacity-70">
        {align === 'start' ? UI.service.legStart : UI.service.legEnd}
      </span>
    </span>
  );
}

function Key({ colour, label, value }: { colour: string; label: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={cn('size-2.5 rounded-sm', colour)} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium tabular-nums">{value}</span>
    </span>
  );
}
