'use client';

import { Loader2, Trash2 } from 'lucide-react';
import { useActionState, useRef } from 'react';

import type { DeleteState } from '@/app/(app)/admin/actions';
import { Alert } from '@/components/ui/primitives';
import { UI } from '@/lib/i18n/messages';
import type { Deletability, DeletionBlocker } from '@/modules/shared/deletability';

const BLOCKER_LABELS: Record<DeletionBlocker, (count: number) => string> = {
  services: (count) => UI.common.blockerServices(count),
  approvals: (count) => UI.common.blockerApprovals(count),
  statusChanges: (count) => UI.common.blockerStatusChanges(count),
  defaultForUsers: (count) => UI.common.blockerDefaultForUsers(count),
};

/**
 * Delete, for the one case where deleting is the right answer.
 *
 * A master-data record nothing references is clutter — a plate typed wrong, a
 * route that never ran — and deactivating it only moves it to the bottom of
 * the list forever. Anything a service points at is a different matter: that
 * record is part of the history, and the control says so rather than failing
 * on the click.
 *
 * So this component renders one of two things, decided on the server:
 *
 *   deletable      a quiet outline button, and a confirmation naming the
 *                  record before anything happens
 *   not deletable  no button at all, and the reason in plain language
 *
 * A native `<dialog>` handles the confirmation: it takes focus, traps it, and
 * closes on Escape without a line of JavaScript for any of that.
 */
export function DeleteRecord({
  action,
  name,
  deletability,
}: {
  /** The bound delete action for this record. */
  action: (state: DeleteState) => Promise<DeleteState>;
  /** What the confirmation calls the record — a plate, a code, a person. */
  name: string;
  deletability: Deletability;
}) {
  const [state, formAction, isPending] = useActionState<DeleteState>(action, {
    status: 'idle',
  });
  const dialog = useRef<HTMLDialogElement>(null);

  if (!deletability.canDelete) {
    return (
      <section className="space-y-2">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          {UI.common.dangerZone}
        </h2>
        <div className="bg-card text-muted-foreground rounded-xl border px-4 py-3 text-sm">
          <p className="text-foreground font-medium">{UI.common.deleteBlockedTitle}</p>
          {deletability.blockers.length > 0 ? (
            <p className="mt-1">
              {deletability.blockers
                .map(({ kind, count }) => BLOCKER_LABELS[kind](count))
                .join(' · ')}
            </p>
          ) : null}
          <p className="mt-1">{UI.common.deleteBlockedHint}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        {UI.common.dangerZone}
      </h2>

      {state.status === 'error' ? <Alert tone="error" title={state.message} /> : null}

      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="border-destructive/40 text-destructive hover:bg-destructive/10 inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors"
      >
        <Trash2 aria-hidden className="size-4" />
        {UI.common.delete}
      </button>

      <dialog
        ref={dialog}
        className="bg-card text-card-foreground m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border p-5 shadow-lg backdrop:bg-black/40"
      >
        <h3 className="text-base font-semibold">{UI.common.deleteTitle}</h3>
        <p className="text-muted-foreground mt-2 text-sm">{UI.common.deleteConfirm(name)}</p>
        {deletability.cascades.map(({ kind, count }) => (
          <p key={kind} className="text-muted-foreground mt-1 text-sm">
            {UI.common.deleteCascade(count)}
          </p>
        ))}
        <p className="text-muted-foreground mt-1 text-sm">{UI.common.deleteIrreversible}</p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="border-input bg-card hover:bg-muted inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium transition-colors"
          >
            {UI.common.cancel}
          </button>

          {/* A form, so the delete is a POST to the server action — the same
              reason sign-out is a form and not a link. */}
          <form action={formAction}>
            <button
              type="submit"
              disabled={isPending}
              className="bg-destructive inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                  {UI.common.deleting}
                </>
              ) : (
                UI.common.delete
              )}
            </button>
          </form>
        </div>
      </dialog>
    </section>
  );
}
