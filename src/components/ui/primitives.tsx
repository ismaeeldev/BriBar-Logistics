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
  return (
    <div
      className={cn('bg-card animate-rise rounded-xl border shadow-xs', className)}
      {...props}
    />
  );
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

/**
 * Two weights, for two jobs.
 *
 * `solid` is a filled pill: right when one badge carries the state of the
 * whole screen, as on a service detail page. Repeat that pill down forty rows
 * of a table and the fills are all the eye sees — the colour stops marking the
 * exception and becomes the background.
 *
 * `subtle` keeps the dot and the colour and drops the fill, which is what a
 * list wants: scanning for the amber dots still works, and the row's actual
 * content is legible again. The dot stays either way, so colour is never the
 * only signal (SRS 23.10).
 *
 * `subtle` is declared after `tone` deliberately: `cn` runs `twMerge` over the
 * result, and the later utility of a conflicting family wins.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        pending: 'bg-pending-surface border-pending-border text-pending',
        approved: 'bg-approved-surface border-approved-border text-approved',
        neutral: 'bg-muted border-border text-muted-foreground',
        // Identity, not state. Reusing `pending` here would put a warning
        // colour on the word "Administrator".
        brand: 'bg-primary-subtle border-primary-subtle text-primary-subtle-foreground',
        destructive: 'bg-destructive-surface border-destructive-border text-destructive',
      },
      subtle: {
        true: 'border-transparent bg-transparent px-0 py-0',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Badge({
  className,
  tone,
  subtle,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone, subtle }), className)} {...props} />;
}

/**
 * The service status, as a badge (SRS 15.2 "clear status labels").
 *
 * Carries a coloured dot as well as the colour itself, so the two states stay
 * distinguishable for a red/green-deficient viewer and in a photocopy — colour
 * is never the only signal (SRS 23.10).
 */
export function ServiceStatusBadge({
  status,
  subtle,
}: {
  status: ServiceStatus;
  /** Set on rows in a list; leave unset where the badge stands alone. */
  subtle?: boolean;
}) {
  const isPending = status === 'PENDING_APPROVAL';

  return (
    <Badge tone={isPending ? 'pending' : 'approved'} {...(subtle ? { subtle: true } : {})}>
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

const alertVariants = cva(
  'flex items-start gap-2.5 rounded-lg border p-3 text-sm animate-rise',
  {
    variants: {
      tone: {
        info: 'bg-muted border-border text-foreground',
        warning: 'bg-pending-surface border-pending-border text-pending',
        success: 'bg-approved-surface border-approved-border text-approved',
        error: 'bg-destructive-surface border-destructive-border text-destructive',
      },
    },
    defaultVariants: { tone: 'info' },
  },
);

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
        <div className="bg-muted text-muted-foreground animate-pop flex size-11 items-center justify-center rounded-full">
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
  return <div className={cn('bg-muted shimmer rounded-md', className)} {...props} />;
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

/**
 * The band a dashboard opens with.
 *
 * Both dashboards previously began with a heading in body ink on the page
 * ground — accurate, and completely forgettable. This gives each one a first
 * screen: the brand gradient, the greeting or panel name at display size, and
 * the primary action sitting in it rather than beneath it.
 *
 * It is reserved for the two dashboards. Every other screen keeps `PageHeader`,
 * because a band on all fifteen of them would stop meaning "you have arrived
 * somewhere" and start being wallpaper.
 *
 * The decorative highlights are `pointer-events: none` (see `.glow`), so a
 * button inside the band is never blocked by them.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'glow bg-brand-gradient animate-rise relative overflow-hidden rounded-2xl px-5 py-6 text-white shadow-sm sm:px-7 sm:py-8',
        className,
      )}
    >
      <div className="relative z-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 space-y-1.5">
          {eyebrow ? (
            <p className="text-xs font-medium tracking-wider text-white/70 uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-prose text-sm text-white/80">{description}</p>
          ) : null}
        </div>
        {action ? <div className="w-full shrink-0 sm:w-auto">{action}</div> : null}
      </div>
    </section>
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
