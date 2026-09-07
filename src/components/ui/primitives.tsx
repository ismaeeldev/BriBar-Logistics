import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle2, ChevronRight, Home, Info } from 'lucide-react';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';
import { SERVICE_STATUS_LABELS, UI } from '@/lib/i18n/messages';
import type { ServiceStatus } from '@/modules/services/domain/service-status';

/* -------------------------------------------------------------------------- */
/* Surfaces                                                                   */
/* -------------------------------------------------------------------------- */

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'bg-card animate-rise rounded-2xl border border-border/50 shadow-sm transition-shadow duration-300 overflow-hidden',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('px-6 py-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('text-lg font-bold tracking-tight flex items-center gap-2', className)} {...props} />;
}

export function CardBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('px-6 pb-5', className)} {...props} />;
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
        brand: 'bg-primary-subtle border-primary-subtle text-primary-subtle-foreground',
        destructive: 'bg-destructive-surface border-destructive-border text-destructive',
        admin: 'bg-purple-100 border-purple-200 text-purple-700',
        driver: 'bg-blue-100 border-blue-200 text-blue-700',
        active: 'bg-emerald-100 border-emerald-200 text-emerald-700',
        inactive: 'bg-rose-100 border-rose-200 text-rose-700',
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

/**
 * The service status, as a restrained pill.
 *
 * An earlier version of this was a bare coloured dot, on the reasoning that
 * the word "Pending Approval" was the widest thing in the table and repeated
 * on nearly every row. That was true, and it was still the wrong trade: a dot
 * asks the reader to remember what amber means, every time, and a status
 * nobody can read at a glance is not a status.
 *
 * So the word is back, but sized for a table rather than for a headline —
 * small caps, a tinted ground, a dot to carry the colour, and a border only
 * strong enough to define the shape. Both signals are present, which is what
 * SRS 23.10 asks for and what a dot alone could not give.
 *
 * `ServiceStatusBadge` remains the larger form for a detail page, where the
 * status is the headline rather than one cell of forty.
 */
export function StatusPill({
  status,
  className,
}: {
  status: ServiceStatus;
  className?: string;
}) {
  const isPending = status === 'PENDING_APPROVAL';

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[0.7rem] font-medium whitespace-nowrap',
        isPending
          ? 'bg-pending-surface border-pending-border text-pending'
          : 'bg-approved-surface border-approved-border text-approved',
        className,
      )}
    >
      {/* A pending status gets a soft live-pulse behind its dot — work still
          outstanding reads as active rather than static. Approved is done, so
          it stays still. */}
      <span aria-hidden className="relative inline-flex size-1.5">
        {isPending ? (
          <span className="bg-pending animate-ping-soft absolute inline-flex size-full rounded-full opacity-70" />
        ) : null}
        <span
          className={cn(
            'relative inline-flex size-1.5 rounded-full',
            isPending ? 'bg-pending' : 'bg-approved',
          )}
        />
      </span>
      {SERVICE_STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Pill for boolean active/inactive states on Master Data lists.
 */
export function StatePill({
  isActive,
  label,
  className,
}: {
  isActive: boolean;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[0.7rem] font-medium whitespace-nowrap',
        isActive
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-rose-50 border-rose-200 text-rose-700',
        className,
      )}
    >
      <span aria-hidden className="relative inline-flex size-1.5">
        <span
          className={cn(
            'relative inline-flex size-1.5 rounded-full',
            isActive ? 'bg-emerald-500' : 'bg-rose-500',
          )}
        />
      </span>
      {label}
    </span>
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

/**
 * The breadcrumb every non-dashboard screen opens with: home, the sidebar
 * section the page lives under, and the current page.
 *
 * `section` is optional because a few screens (the driver's own pages) have
 * no grouping to show — those fall back to just the current page.
 */
function PageBreadcrumb({ title, section, home = '/admin' }: { title: string; section?: string | undefined; home?: string | undefined }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 text-sm">
      <Link
        href={home}
        aria-label={UI.common.appName}
        className="bg-primary-subtle text-primary-subtle-foreground hover:opacity-80 flex size-7 shrink-0 items-center justify-center rounded-lg transition-opacity"
      >
        <Home aria-hidden className="size-3.5" />
      </Link>
      {section ? (
        <>
          <span className="text-muted-foreground truncate">{section}</span>
          <ChevronRight aria-hidden className="text-muted-foreground/50 size-3.5 shrink-0" />
        </>
      ) : null}
      {/* The current page, as a real (if visually small) heading — a
          breadcrumb should not be the only thing on the page not to have
          one. */}
      <h1 className="text-foreground m-0 truncate text-sm font-semibold" aria-current="page">
        {title}
      </h1>
    </nav>
  );
}

/**
 * The header every non-dashboard screen opens with.
 *
 * A breadcrumb for orientation, then — on a list screen, which has more to
 * carry — one plain row holding the title, record count and status, the
 * search box, and the primary actions. A form screen (create/edit) has none
 * of `search`, `filters` or `action` to put in that row, so it gets the
 * breadcrumb and a plain title instead of an otherwise-empty row.
 */
export function PageHeader({
  title,
  section,
  description,
  statusPill,
  search,
  filters,
  action,
}: {
  title: string;
  /** The nav section this page belongs to, shown as the crumb before `title`. */
  section?: string;
  description?: string;
  statusPill?: ReactNode;
  /** The list's search box, rendered inline in the header row. */
  search?: ReactNode;
  /** The list's filter control(s), rendered beside `action`. */
  filters?: ReactNode;
  action?: ReactNode;
}) {
  const hasRow = Boolean(search || filters || action);

  if (!hasRow) {
    return (
      <div className="mb-5">
        <PageBreadcrumb title={title} section={section} />
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
    );
  }

  return (
    <div className="mb-5">
      <PageBreadcrumb title={title} section={section} />

      <div className="border-border flex flex-wrap items-center gap-4 border-b pb-5">
        {description || statusPill ? (
          <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 text-sm">
            {description ? <span className="text-muted-foreground">{description}</span> : null}
            {statusPill}
          </div>
        ) : null}

        {search ? <div className="order-last min-w-56 flex-1 basis-64 sm:order-none">{search}</div> : null}

        {filters || action ? (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {filters}
            {action}
          </div>
        ) : null}
      </div>
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
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 py-2.5">
      <dt className="text-muted-foreground shrink-0 text-[14px] sm:w-[160px]">{label}</dt>
      <dd className={cn('min-w-0 flex-1 text-[14px] text-foreground', mono && 'font-mono tracking-tight')}>
        {value}
      </dd>
    </div>
  );
}
