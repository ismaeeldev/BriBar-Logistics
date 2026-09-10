'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

import { Field, Select } from '@/components/ui/field';
import { FIELD_LABELS, UI } from '@/lib/i18n/messages';

/**
 * The client an administrator is issuing an invoice for (ERP roadmap
 * Phase 4) — same "round-trip through the URL" shape as
 * `ServiceDriverPicker`, and for the same reason: the page below this is a
 * server component that loads the chosen client's billable services, so the
 * selection has to be in the URL for that load to know what to fetch.
 */
export function IssuedInvoiceClientPicker({
  clients,
  selectedClientId,
}: {
  clients: { id: string; name: string }[];
  selectedClientId?: string | undefined;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function select(clientId: string) {
    const params = new URLSearchParams(searchParams);
    if (clientId) params.set('clientId', clientId);
    else params.delete('clientId');

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <Field
      label={FIELD_LABELS.client}
      required
      hint={UI.admin.issuedInvoices.clientHint}
    >
      {(props) => (
        <Select
          {...props}
          name="clientPicker"
          value={selectedClientId ?? ''}
          disabled={isPending}
          onChange={(event) => select(event.target.value)}
        >
          <option value="" disabled>
            {UI.admin.issuedInvoices.chooseClient}
          </option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}
