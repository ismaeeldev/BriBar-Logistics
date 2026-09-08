'use client';

import { Filter, X, CalendarRange, ChevronDown } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { FIELD_LABELS, SERVICE_STATUS_LABELS, UI } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';

/**
 * The five filters SRS 16.3 requires: date range, driver, vehicle,
 * route/contract and status.
 *
 * State lives in the URL, not in the component. A filtered view is then
 * shareable, survives a back-navigation, and can be bookmarked — and the
 * server page reads the same query string the API route parses, through the
 * same schema.
 */
export interface FilterOption {
  id: string;
  label: string;
}

export function ServiceFilters({
  drivers,
  vehicles,
  routes,
}: {
  drivers: FilterOption[];
  vehicles: FilterOption[];
  routes: FilterOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const current = (key: string) => searchParams?.get(key) ?? '';

  const activeCount = [
    'dateFrom',
    'dateTo',
    'driverId',
    'vehicleId',
    'routeId',
    'status',
  ].filter((key) => searchParams?.get(key)).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // The filter keys this menu owns. Everything else in the query string — the
  // search term, the sort column, the page size — is preserved across an apply
  // or a clear so the two controls do not fight over the URL.
  const FILTER_KEYS = ['dateFrom', 'dateTo', 'driverId', 'vehicleId', 'routeId', 'status'] as const;

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams(searchParams?.toString() ?? '');
    for (const key of FILTER_KEYS) next.delete(key);
    next.delete('page');
    for (const [key, value] of form.entries()) {
      if (typeof value === 'string' && value.trim() !== '') next.set(key, value);
    }
    router.push(next.size > 0 ? `/admin/services?${next}` : '/admin/services');
    setIsOpen(false);
  }

  function clearAll() {
    const next = new URLSearchParams(searchParams?.toString() ?? '');
    for (const key of FILTER_KEYS) next.delete(key);
    next.delete('page');
    router.push(next.size > 0 ? `/admin/services?${next}` : '/admin/services');
    setIsOpen(false);
  }

  return (
    <div className="flex items-center gap-2" ref={menuRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            // Same height/shape as the "add service" button beside it.
            'flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors',
            activeCount > 0
              ? 'bg-primary/10 border-primary/20 text-primary'
              : 'bg-card border-border hover:bg-muted text-foreground',
          )}
        >
          <Filter className="size-4" />
          {UI.admin.filters}
          {activeCount > 0 && (
            <span className="bg-primary text-primary-foreground inline-flex size-5 items-center justify-center rounded-full text-[0.7rem] font-semibold tabular-nums">
              {activeCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute left-0 top-full mt-2 w-80 bg-card border border-border/60 shadow-xl rounded-xl z-50 p-4 animate-rise">
            <form onSubmit={apply} className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{UI.admin.filters}</span>
                {activeCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="size-3" />
                    {UI.admin.clearFilters}
                  </button>
                )}
              </div>

              {/* Date Range */}
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                  <CalendarRange className="size-3" />
                  {UI.admin.from} / {UI.admin.to}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    name="dateFrom"
                    defaultValue={current('dateFrom')}
                    className="w-full bg-muted/50 border border-border/60 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  />
                  <input
                    type="date"
                    name="dateTo"
                    defaultValue={current('dateTo')}
                    className="w-full bg-muted/50 border border-border/60 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                  {UI.common.status}
                </span>
                <div className="flex flex-col gap-1.5">
                  {[
                    { label: UI.common.all, value: '' },
                    { label: SERVICE_STATUS_LABELS.PENDING_APPROVAL, value: 'PENDING_APPROVAL' },
                    { label: SERVICE_STATUS_LABELS.APPROVED, value: 'APPROVED' },
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer group text-sm">
                      <input
                        type="radio"
                        name="status"
                        value={opt.value}
                        defaultChecked={current('status') === opt.value}
                        className="accent-primary"
                      />
                      <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Driver */}
              <SelectFilter
                name="driverId"
                label={FIELD_LABELS.driver}
                current={current('driverId')}
                allLabel={UI.common.all}
                options={drivers}
              />

              {/* Vehicle */}
              <SelectFilter
                name="vehicleId"
                label={FIELD_LABELS.vehicle}
                current={current('vehicleId')}
                allLabel={UI.common.all}
                options={vehicles}
              />

              {/* Route */}
              <SelectFilter
                name="routeId"
                label={FIELD_LABELS.route}
                current={current('routeId')}
                allLabel={UI.common.allFeminine}
                options={routes}
              />

              <button
                type="submit"
                className="w-full bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                {UI.admin.applyFilters}
              </button>
            </form>
          </div>
        )}
      </div>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="flex h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
          {UI.admin.clearFilters}
        </button>
      )}
    </div>
  );
}

function SelectFilter({
  name,
  label,
  current,
  allLabel,
  options,
}: {
  name: string;
  label: string;
  current: string;
  allLabel: string;
  options: FilterOption[];
}) {
  return (
    <div>
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
        {label}
      </span>
      <div className="relative">
        <select
          name={name}
          defaultValue={current}
          className="w-full appearance-none bg-muted/50 border border-border/60 rounded-lg px-2.5 py-1.5 text-sm pr-7 focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
        >
          <option value="">{allLabel}</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
      </div>
    </div>
  );
}
