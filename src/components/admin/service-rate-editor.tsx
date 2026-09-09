'use client';

import { Loader2, Pencil, Save } from 'lucide-react';
import { useState, useTransition } from 'react';

import { updateServiceRateAction } from '@/app/(app)/admin/actions';
import { MoneyInput } from '@/components/ui/field';
import { Alert } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { centsToInputValue, formatEuros } from '@/lib/money/money';
import { NUMBER_LOCALE, UI } from '@/lib/i18n/messages';

/**
 * The rate an administrator sees and may change while reviewing a service
 * (client change request 2026-09-09, ERP roadmap Phase 0).
 *
 * Its own small editor rather than a field in the general edit form: rate is
 * admin-only information, changing it is a distinct action from editing
 * mileage/times, and — per the request — the point is specifically to see and
 * adjust it *before approving*, which this card sits next to rather than
 * behind a second page.
 */
export function ServiceRateEditor({
  serviceId,
  rateCents,
}: {
  serviceId: string;
  rateCents: number | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(rateCents != null ? centsToInputValue(rateCents) : '');
  const [current, setCurrent] = useState(rateCents);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateServiceRateAction(serviceId, value);
        // The server is the source of truth for the stored cents; re-deriving
        // it from what was typed keeps this in step with `moneySchema`'s own
        // rounding rather than assuming the input parses identically.
        const trimmed = value.trim();
        setCurrent(trimmed === '' ? null : Math.round(Number(trimmed.replace(',', '.')) * 100));
        setIsEditing(false);
        setSaved(true);
      } catch (caught) {
        setError(
          caught instanceof Error && caught.message ? caught.message : UI.admin.rateUpdateFailed,
        );
      }
    });
  }

  if (!isEditing) {
    return (
      <div className="space-y-2">
        {saved ? <Alert tone="success" title={UI.admin.rateUpdated} /> : null}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[14px] text-foreground">
            {current != null ? formatEuros(current, NUMBER_LOCALE) : UI.admin.noRate}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSaved(false);
              setIsEditing(true);
            }}
          >
            <Pencil aria-hidden className="size-3.5" />
            {UI.admin.editRate}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <MoneyInput
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="0,00"
        aria-label={UI.admin.rateSectionTitle}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          block
          onClick={() => {
            setValue(current != null ? centsToInputValue(current) : '');
            setError(null);
            setIsEditing(false);
          }}
        >
          {UI.common.cancel}
        </Button>
        <Button type="button" size="sm" block onClick={save} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin" />
              {UI.admin.savingRate}
            </>
          ) : (
            <>
              <Save aria-hidden className="size-4" />
              {UI.admin.saveRate}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
