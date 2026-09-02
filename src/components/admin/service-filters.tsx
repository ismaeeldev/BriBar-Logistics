'use client';

import { X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Card, CardBody } from '@/components/ui/primitives';
import { FIELD_LABELS, SERVICE_STATUS_LABELS } from '@/lib/i18n/messages';

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
    <Card>
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          className="flex items-center gap-2 text-sm font-medium"
        >
          Filtros
          {activeCount > 0 ? (
            <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-xs">
              {activeCount}
            </span>
          ) : null}
        </button>

        {activeCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/services')}
          >
            <X aria-hidden />
            Limpiar
          </Button>
        ) : null}
      </div>

      {/*
        Rendered but hidden rather than unmounted, so the browser keeps the
        inputs' values and an accidental collapse does not discard a
        half-completed filter.
      */}
      <CardBody hidden={!isOpen} className="border-t">
        <form onSubmit={apply} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Desde">
            {(props) => (
              <Input
                {...props}
                type="date"
                name="dateFrom"
                defaultValue={current('dateFrom')}
              />
            )}
          </Field>

          <Field label="Hasta">
            {(props) => (
              <Input {...props} type="date" name="dateTo" defaultValue={current('dateTo')} />
            )}
          </Field>

          <Field label="Estado">
            {(props) => (
              <Select {...props} name="status" defaultValue={current('status')}>
                <option value="">Todos</option>
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
                <option value="">Todos</option>
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
                <option value="">Todos</option>
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
                <option value="">Todas</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" block className="sm:w-auto">
              Aplicar filtros
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
