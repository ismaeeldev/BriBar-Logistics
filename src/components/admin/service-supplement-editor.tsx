'use client';

import { Loader2, Pencil, Save } from 'lucide-react';
import { useState, useTransition } from 'react';

import { updateServiceSupplementAction } from '@/app/(app)/admin/actions';
import { MoneyInput, Select } from '@/components/ui/field';
import { Alert } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { centsToInputValue, formatEuros } from '@/lib/money/money';
import { FIELD_LABELS, NUMBER_LOCALE, UI } from '@/lib/i18n/messages';

/**
 * The supplement an administrator sees and may change while reviewing a
 * service (ERP roadmap Phase 4) — same view/edit toggle as
 * `ServiceRateEditor`, extended with a type select alongside the amount:
 * unlike the rate, a supplement's *kind* (waiting time, an extra stop,
 * night work…) matters as much as its amount.
 */
export function ServiceSupplementEditor({
  serviceId,
  supplementCents,
  supplementTypeId,
  supplementTypes,
}: {
  serviceId: string;
  supplementCents: number | null;
  supplementTypeId: string | null;
  supplementTypes: { id: string; name: string }[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [amount, setAmount] = useState(
    supplementCents != null ? centsToInputValue(supplementCents) : '',
  );
  const [typeId, setTypeId] = useState(supplementTypeId ?? '');
  const [current, setCurrent] = useState({ amount: supplementCents, typeId: supplementTypeId });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const currentTypeName = supplementTypes.find((type) => type.id === current.typeId)?.name;

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateServiceSupplementAction(serviceId, amount, typeId);
        const trimmed = amount.trim();
        setCurrent({
          amount: trimmed === '' ? null : Math.round(Number(trimmed.replace(',', '.')) * 100),
          typeId: typeId === '' ? null : typeId,
        });
        setIsEditing(false);
        setSaved(true);
      } catch (caught) {
        setError(
          caught instanceof Error && caught.message
            ? caught.message
            : UI.admin.supplementUpdateFailed,
        );
      }
    });
  }

  if (!isEditing) {
    return (
      <div className="space-y-2">
        {saved ? <Alert tone="success" title={UI.admin.supplementUpdated} /> : null}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[14px] text-foreground">
            {current.amount != null ? (
              <>
                {formatEuros(current.amount, NUMBER_LOCALE)}
                {currentTypeName ? (
                  <span className="text-muted-foreground"> · {currentTypeName}</span>
                ) : null}
              </>
            ) : (
              UI.admin.noSupplement
            )}
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
            {UI.admin.editSupplement}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <MoneyInput
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        placeholder="0,00"
        aria-label={UI.admin.supplementSectionTitle}
      />
      <Select
        value={typeId}
        onChange={(event) => setTypeId(event.target.value)}
        aria-label={FIELD_LABELS.supplementType}
      >
        <option value="">{UI.admin.chooseSupplementTypeOptional}</option>
        {supplementTypes.map((type) => (
          <option key={type.id} value={type.id}>
            {type.name}
          </option>
        ))}
      </Select>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          block
          onClick={() => {
            setAmount(current.amount != null ? centsToInputValue(current.amount) : '');
            setTypeId(current.typeId ?? '');
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
              {UI.admin.savingSupplement}
            </>
          ) : (
            <>
              <Save aria-hidden className="size-4" />
              {UI.admin.saveSupplement}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
