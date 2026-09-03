'use client';

import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Card, CardBody } from '@/components/ui/primitives';
import { FIELD_LABELS, SERVICE_STATUS_LABELS, UI } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';

/**
 * The five filters SRS 16.3 requires: date range, driver, vehicle,
 * route/contract and status.
 *
 * State lives in the URL, not in the component. A filtered view is then
 * shareable, survives a back-navigation, and can be bookmarked — and the
 * server page reads the same query string the API route parses, through the
 * same schema. Holding it in React state instead would make the filtered list
 * unreachable by any means except re-clicking.
 *
 * Submitting resets to page 1: staying on page 4 of a narrower result set
 * usually lands on an empty page.
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
  const params = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();

  const current = (key: string) => params.get(key) ?? '';

  const activeCount = [
    'dateFrom',
    'dateTo',
    'driverId',
    'vehicleId',
    'routeId',
    'status',
  ].filter((key) => params.get(key)).length;

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();

    for (const [key, value] of form.entries()) {
      if (typeof value === 'string' && value.trim() !== '') next.set(key, value);
    }

    router.push(next.size > 0 ? `/admin/services?${next}` : '/admin/services');
  }

  return (
    <div className="space-y-3">
      {/*
        A control, not a container. The disclosure used to be a full-width card
        with one word in it, which read as a section of the page rather than as
        something to press — and it occupied a band of the screen whether or
        not anyone wanted to filter. It is now a button the size of its label,
        with the panel appearing under it.
      */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-controls={panelId}
        >
          <SlidersHorizontal aria-hidden />
          {UI.admin.filters}
          {activeCount > 0 ? (
            <span className="bg-primary text-primary-foreground -mr-1 inline-flex size-5 items-center justify-center rounded-full text-[0.7rem] font-semibold tabular-nums">
              {activeCount}
            </span>
          ) : null}
          <ChevronDown
            aria-hidden
            className={cn('transition-transform duration-200', isOpen && 'rotate-180')}
          />
        </Button>

        {activeCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/services')}
          >
            <X aria-hidden />
            {UI.admin.clearFilters}
          </Button>
        ) : null}
      </div>

      {/*
        Rendered but hidden rather than unmounted, so the browser keeps the
        inputs' values and an accidental collapse does not discard a
        half-completed filter.
      */}
      <Card id={panelId} hidden={!isOpen}>
        <CardBody>
          <form onSubmit={apply} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={UI.admin.from}>
              {(props) => (
                <Input
                  {...props}
                  type="date"
                  name="dateFrom"
                  defaultValue={current('dateFrom')}
                />
              )}
            </Field>

            <Field label={UI.admin.to}>
              {(props) => (
                <Input {...props} type="date" name="dateTo" defaultValue={current('dateTo')} />
              )}
            </Field>

            <Field label={UI.common.status}>
              {(props) => (
                <Select {...props} name="status" defaultValue={current('status')}>
                  <option value="">{UI.common.all}</option>
                  <option value="PENDING_APPROVAL">
                    {SERVICE_STATUS_LABELS.PENDING_APPROVAL}
                  </option>
                  <option value="APPROVED">{SERVICE_STATUS_LABELS.APPROVED}</option>
                </Select>
              )}
            </Field>

            <Field label={FIELD_LABELS.driver}>
              {(props) => (
                <Select {...props} name="driverId" defaultValue={current('driverId')}>
                  <option value="">{UI.common.all}</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label={FIELD_LABELS.vehicle}>
              {(props) => (
                <Select {...props} name="vehicleId" defaultValue={current('vehicleId')}>
                  <option value="">{UI.common.all}</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label={FIELD_LABELS.route}>
              {(props) => (
                <Select {...props} name="routeId" defaultValue={current('routeId')}>
                  <option value="">{UI.common.allFeminine}</option>
                  {routes.map((route) => (
                    <option key={route.id} value={route.id}>
                      {route.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <div className="sm:col-span-2 lg:col-span-3">
              <Button type="submit" size="sm" block className="sm:w-auto">
                {UI.admin.applyFilters}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
