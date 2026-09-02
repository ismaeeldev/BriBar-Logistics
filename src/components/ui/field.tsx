'use client';

import { AlertCircle } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { useId } from 'react';

import { UI } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';

/**
 * Form primitives.
 *
 * Everything here is a native control. That is a deliberate choice for a
 * mobile-first driver application, not a shortcut:
 *
 *   * `<select>` opens the OS picker on Android and the iOS wheel — both are
 *     one-handed, familiar, and never clip inside a scroll container the way a
 *     custom dropdown does.
 *   * `<input type="time">` opens the OS time picker, which is exactly what
 *     SRS 9.5 asks for: "Time inputs shall use a mobile-friendly time control
 *     where supported."
 *   * `inputMode="numeric"` brings up the numeric keypad for odometer readings
 *     (SRS 9.5 again).
 *
 * A custom component library would have to reimplement all of that and would
 * still lose to the platform on a phone.
 *
 * `Field` owns the wiring the accessibility requirement in SRS 23.10 depends
 * on: a real `<label for>`, `aria-invalid` on failure, and an error message
 * linked by `aria-describedby` so a screen reader announces it with the field
 * rather than as loose text somewhere on the page.
 */

const controlBase =
  'w-full rounded-lg border bg-card px-3 text-base transition-colors ' +
  'placeholder:text-muted-foreground ' +
  'disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground ' +
  'aria-[invalid=true]:border-destructive';

export interface FieldProps {
  label: string;
  /** Rendered under the control, e.g. a unit or a format hint. */
  hint?: string;
  /** Server- or client-side messages for this field. */
  errors?: string[] | undefined;
  /** Marks the label. Optional fields are labelled instead (SRS 23.3). */
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  }) => ReactNode;
}

export function Field({
  label,
  hint,
  errors,
  required,
  optional,
  className,
  children,
}: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const hasError = Boolean(errors?.length);

  const describedBy =
    [hasError ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {required ? (
          <span aria-hidden className="text-destructive ml-0.5">
            *
          </span>
        ) : null}
        {optional ? (
          <span className="text-muted-foreground ml-1.5 text-xs font-normal">
            {UI.common.optional}
          </span>
        ) : null}
      </label>

      {children({ id, 'aria-invalid': hasError, 'aria-describedby': describedBy })}

      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}

      {hasError ? (
        <p id={errorId} className="text-destructive flex items-start gap-1.5 text-sm">
          <AlertCircle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>{errors?.join(' ')}</span>
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(controlBase, 'h-11', className)} {...props} />;
}

/**
 * An odometer reading.
 *
 * `type="text"` with `inputMode="numeric"`, not `type="number"`. A number input
 * silently discards non-numeric input on some mobile browsers, so a typo
 * becomes an empty field with no message — and its value is `""` for anything
 * unparseable, which the schema would then have to distinguish from a genuinely
 * blank field. Text plus a numeric keypad gives the same keyboard and keeps
 * whatever was typed so validation can explain the problem.
 */
export function KmInput({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={cn(controlBase, 'h-11 font-mono', className)}
      {...props}
    />
  );
}

export function TimeInput({ className, ...props }: ComponentProps<'input'>) {
  return <input type="time" className={cn(controlBase, 'h-11', className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        className={cn(
          controlBase,
          'h-11 appearance-none pr-10',
          // Safari renders a select with no explicit background as transparent
          // in dark mode, which makes the options unreadable.
          'bg-card',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        fill="none"
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
      >
        <path
          d="m6 8 4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea className={cn(controlBase, 'min-h-24 resize-y py-2.5', className)} {...props} />
  );
}

/**
 * A checkbox with its label, sized as one large tap target.
 *
 * Used for the overnight flag, which a driver has to be able to hit reliably
 * while holding a phone in one hand.
 */
export function CheckboxField({
  label,
  hint,
  className,
  ...props
}: ComponentProps<'input'> & { label: string; hint?: string }) {
  const id = useId();

  return (
    <div className={cn('rounded-lg border p-3', className)}>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          className="border-input text-primary accent-primary mt-0.5 size-5 shrink-0 rounded"
          {...props}
        />
        <label htmlFor={id} className="flex-1 cursor-pointer text-sm font-medium select-none">
          {label}
          {hint ? (
            <span className="text-muted-foreground mt-0.5 block text-xs font-normal">
              {hint}
            </span>
          ) : null}
        </label>
      </div>
    </div>
  );
}

/**
 * A read-only value shown in the same visual rhythm as an input.
 *
 * SRS 9.5 requires auto-populated fields to be "visually distinguishable from
 * editable fields": a muted fill and no border, so it reads as information
 * rather than as something broken.
 */
export function ReadOnlyValue({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-muted-foreground block text-sm font-medium">{label}</span>
      <div
        className={cn(
          'bg-muted text-foreground flex h-11 items-center rounded-lg px-3 text-base',
          mono && 'font-mono',
        )}
      >
        {value}
      </div>
    </div>
  );
}
