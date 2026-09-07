import { FIELD_LABELS, UI } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';
import { MapPin, ArrowDown, Flag, CheckCircle2, ChevronDown } from 'lucide-react';

/**
 * A vertical timeline that clearly explains the sequence of odometer readings
 * and the distance traveled between each point.
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

  const productiveShare = Math.round((service / total) * 100);

  return (
    <div className={cn('relative mt-2 pl-4', className)}>
      <div className="absolute left-[27px] top-[1.5rem] bottom-[2rem] w-0.5 bg-border rounded-full" />
      
      {/* 1. Start Dashboard */}
      <div className="relative z-10 flex gap-4 pb-6 group">
        <div className="flex flex-col items-center gap-2 pt-0.5">
          <div className="flex size-7 items-center justify-center rounded-full bg-muted border border-border/50 text-muted-foreground ring-4 ring-card">
            <MapPin className="size-3.5" />
          </div>
        </div>
        <div className="flex-1 space-y-1 pt-1">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">{FIELD_LABELS.startDashboardKm}</span>
            <span className="text-[15px] font-bold tracking-tight">{startDashboardKm}</span>
          </div>
          {approach > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
              <ChevronDown className="size-3.5" />
              <span>{approach} km {UI.service.legApproach}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Start Base */}
      <div className="relative z-10 flex gap-4 pb-6 group">
        <div className="flex flex-col items-center gap-2 pt-0.5">
          <div className="flex size-7 items-center justify-center rounded-full bg-blue-50 border border-blue-200 text-blue-600 ring-4 ring-card">
            <CheckCircle2 className="size-3.5" />
          </div>
        </div>
        <div className="flex-1 space-y-1 pt-1">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-blue-900 dark:text-blue-400">{FIELD_LABELS.startBaseKm}</span>
            <span className="text-[15px] font-bold tracking-tight text-blue-900 dark:text-blue-400">{startBaseKm}</span>
          </div>
          {service > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 py-1">
              <ArrowDown className="size-3.5" />
              <span>{service} km {FIELD_LABELS.serviceKm} ({productiveShare}%)</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. End Base */}
      <div className="relative z-10 flex gap-4 pb-6 group">
        <div className="flex flex-col items-center gap-2 pt-0.5">
          <div className="flex size-7 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 ring-4 ring-card">
            <CheckCircle2 className="size-3.5" />
          </div>
        </div>
        <div className="flex-1 space-y-1 pt-1">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-emerald-900 dark:text-emerald-400">{FIELD_LABELS.endBaseKm}</span>
            <span className="text-[15px] font-bold tracking-tight text-emerald-900 dark:text-emerald-400">{endBaseKm}</span>
          </div>
          {returnLeg > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
              <ChevronDown className="size-3.5" />
              <span>{returnLeg} km {UI.service.legReturn}</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. End Dashboard */}
      <div className="relative z-10 flex gap-4 group">
        <div className="flex flex-col items-center gap-2 pt-0.5">
          <div className="flex size-7 items-center justify-center rounded-full bg-muted border border-border/50 text-muted-foreground ring-4 ring-card">
            <Flag className="size-3.5" />
          </div>
        </div>
        <div className="flex-1 pt-1">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">{FIELD_LABELS.endDashboardKm}</span>
            <span className="text-[15px] font-bold tracking-tight">{endDashboardKm}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
