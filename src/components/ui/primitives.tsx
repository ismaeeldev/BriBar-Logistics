import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';
import { SERVICE_STATUS_LABELS } from '@/lib/i18n/messages';
import type { ServiceStatus } from '@/modules/services/domain/service-status';

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* -------------------------------------------------------------------------- */

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('bg-card rounded-xl border shadow-xs', className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('space-y-1 border-b px-4 py-3.5', className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('text-sm font-semibold tracking-tight', className)} {...props} />;
}

export function CardBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-4', className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        pending: 'bg-pending-surface border-pending-border text-pending',
        approved: 'bg-approved-surface border-approved-border text-approved',
        neutral: 'bg-muted border-border text-muted-foreground',
        destructive: 'bg-destructive-surface border-destructive-border text-destructive',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/**
 * The service status, as a badge (SRS 15.2 "clear status labels").
 *
 * Carries a coloured dot as well as the colour itself, so the two states stay
 * distinguishable for a red/green-deficient viewer and in a photocopy — colour
 * is never the only signal (SRS 23.10).
 */
export function ServiceStatusBadge({ status }: { status: ServiceStatus }) {
  const isPending = status === 'PENDING_APPROVAL';

  return (
    <Badge tone={isPending ? 'pending' : 'approved'}>
      <span
        aria-hidden
        className={cn('size-1.5 rounded-full', isPending ? 'bg-pending' : 'bg-approved')}
      />
      {SERVICE_STATUS_LABELS[status]}
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                   */
/* -------------------------------------------------------------------------- */

const alertVariants = cva('flex items-start gap-2.5 rounded-lg border p-3 text-sm', {
  variants: {
    tone: {
      info: 'bg-muted border-border text-foreground',
      warning: 'bg-pending-surface border-pending-border text-pending',
      success: 'bg-approved-surface border-approved-border text-approved',
      error: 'bg-destructive-surface border-destructive-border text-destructive',
    },
  },
  defaultVariants: { tone: 'info' },
});

const ALERT_ICONS = {
  info: Info,
  warning: AlertCircle,
  success: CheckCircle2,
  error: AlertCircle,
} as const;

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: VariantProps<typeof alertVariants> & {
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const Icon = ALERT_ICONS[tone ?? 'info'];

  return (
    // `role="alert"` so an error is announced rather than silently appearing
    // above a form the user has already scrolled past (SRS 23.10, 24.1).
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(alertVariants({ tone }), className)}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 space-y-0.5">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="text-[0.8125rem] leading-relaxed">{children}</div> : null}
      </div>
    </div>
  );
}

/**
 * Shown when a list has nothing in it (SRS 23.3 — an empty list should explain
 * itself rather than look broken).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {Icon ? (
        <div className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-full">
          <Icon className="size-5" />
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="text-muted-foreground mx-auto max-w-xs text-sm">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('bg-muted animate-pulse rounded-md', className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** A label/value row, used throughout the service detail view (SRS 16.4). */
export function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground shrink-0 text-sm">{label}</dt>
      <dd className={cn('min-w-0 text-right text-sm font-medium', mono && 'font-mono')}>
        {value}
      </dd>
    </div>
  );
}
