'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

import { Field, Select } from '@/components/ui/field';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';

/**
 * The driver an administrator is filing a service for (client decision #7).
 *
 * Kept in the query string rather than component state: the page is a server
 * component that loads the chosen driver's routes and vehicles
 * (`serviceService.getContext`), so the selection has to round-trip through the
 * URL for the form below it to reflect the right driver. That also makes a
 * half-filled Add Service link shareable and survivable across a back
 * navigation, the same principle the admin list filters use.
 *
 * The driver is never trusted from here: the server re-checks the id against
 * `canCreateFor` and the driver's own assignments on every read and write.
 */
export function ServiceDriverPicker({
  drivers,
  selectedDriverId,
}: {
  drivers: { id: string; name: string }[];
  selectedDriverId?: string | undefined;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function select(driverId: string) {
    const params = new URLSearchParams(searchParams);
    if (driverId) params.set('driverId', driverId);
    else params.delete('driverId');

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <Field label={FIELD_LABELS.driver} required hint={UI.admin.selectDriverToStart}>
      {(props) => (
        <Select
          {...props}
          name="driverPicker"
          value={selectedDriverId ?? ''}
          disabled={isPending}
          onChange={(event) => select(event.target.value)}
        >
          <option value="" disabled>
            {UI.admin.chooseDriver}
          </option>
          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}
