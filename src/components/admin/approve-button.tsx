'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';

import { approveServiceAction } from '@/app/(app)/admin/actions';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/primitives';
import { UI } from '@/lib/i18n/messages';

/**
 * Approve (SRS 11.3).
 *
 * Approval is irreversible - SRS 11.4 forbids returning a service to pending,
 * and SRS 29 excludes a rejection workflow - so it asks for confirmation
 * first. A misplaced tap on a phone should not lock a record permanently.
 *
 * The failure path matters as much as the success one: two administrators
 * reviewing the same queue can both press this, and the second gets a 409 from
 * the status-guarded update. That is shown as an explanation rather than a
 * generic error, because nothing actually went wrong.
 */
export function ApproveButton({ serviceId }: { serviceId: string }) {
  const [isPending, startTransition] = useTransition();
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function approve() {
    setError(null);
    startTransition(async () => {
      try {
        await approveServiceAction(serviceId);
        setIsConfirming(false);
      } catch (caught) {
        setError(
          caught instanceof Error && caught.message ? caught.message : UI.admin.approveFailed,
        );
      }
    });
  }

  if (!isConfirming) {
    return (
      <div className="space-y-3">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button type="button" size="lg" block onClick={() => setIsConfirming(true)}>
          <CheckCircle2 aria-hidden className="size-5" />
          {UI.admin.approve}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Alert tone="warning" title={UI.admin.confirmApprove}>
        {UI.admin.confirmApproveHint}
      </Alert>

      <div className="flex gap-2">
        <Button type="button" variant="secondary" block onClick={() => setIsConfirming(false)}>
          {UI.common.cancel}
        </Button>
        <Button type="button" block onClick={approve} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin" />
              {UI.admin.approving}
            </>
          ) : (
            UI.admin.confirmApproveAction
          )}
        </Button>
      </div>
    </div>
  );
}
