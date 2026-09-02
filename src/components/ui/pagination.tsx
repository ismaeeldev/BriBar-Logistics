import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { UI } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';

/**
 * Page navigation for every list in the application.
 *
 * The state lives in the query string rather than in component state, so a
 * page is a real URL: shareable, bookmarkable, and correct after a browser
 * back-navigation. Every filter already in the query is carried across, and
 * only `page` is rewritten — a paged view of a filtered list must not quietly
 * drop the filter.
 *
 * Numbered links, not just previous/next. A queue of 200 services is 8 pages,
 * and an administrator who wants the oldest of them should not tap "next"
 * seven times. The number strip collapses with an ellipsis past seven pages so
 * the control keeps a fixed footprint, and it is hidden below `sm` where
 * previous/next and the position readout are all that fit.
 */
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  /** The route this list lives on, e.g. `/admin/services`. */
  basePath: string;
  /** The current query, so filters survive a page change. */
  params: Record<string, string | string[] | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key !== 'page' && typeof value === 'string' && value) query.set(key, value);
    }
    if (target > 1) query.set('page', String(target));
    const search = query.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  return (
    <nav
      aria-label={UI.common.pagination}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-muted-foreground text-sm tabular-nums">
        {UI.common.showing(from, to, total)}
      </p>

      <div className="flex items-center gap-1">
        <Step href={href(page - 1)} disabled={page <= 1} label={UI.common.previous}>
          <ChevronLeft aria-hidden className="size-4" />
          <span className="hidden sm:inline">{UI.common.previous}</span>
        </Step>

        <div className="hidden items-center gap-1 sm:flex">
          {pageWindow(page, totalPages).map((entry, index) =>
            entry === null ? (
              // A gap, not a control: it is announced to no one and does nothing.
              <span
                key={`gap-${index}`}
                aria-hidden
                className="text-muted-foreground px-1 text-sm"
              >
                &hellip;
              </span>
            ) : (
              <Link
                key={entry}
                href={href(entry)}
                aria-label={UI.common.goToPage(entry)}
                aria-current={entry === page ? 'page' : undefined}
                className={cn(
                  'inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium tabular-nums transition-colors',
                  entry === page
                    ? 'bg-primary text-primary-foreground'
                    : 'border-input bg-card hover:bg-muted border',
                )}
              >
                {entry}
              </Link>
            ),
          )}
        </div>

        {/* The strip is gone on a phone, so the position has to be said. */}
        <span className="text-muted-foreground px-2 text-sm tabular-nums sm:hidden">
          {UI.common.pageOf(page, totalPages)}
        </span>

        <Step href={href(page + 1)} disabled={page >= totalPages} label={UI.common.next}>
          <span className="hidden sm:inline">{UI.common.next}</span>
          <ChevronRight aria-hidden className="size-4" />
        </Step>
      </div>
    </nav>
  );
}

/**
 * A disabled step is a `<span>`, never a link.
 *
 * A greyed-out anchor still takes focus and still navigates, so the keyboard
 * and the pointer would disagree about whether page 0 exists.
 */
function Step({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className =
    'border-input bg-card inline-flex h-9 items-center gap-1 rounded-lg border px-2.5 text-sm font-medium transition-colors sm:px-3';

  if (disabled) {
    return (
      <span aria-disabled className={cn(className, 'text-muted-foreground opacity-50')}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} aria-label={label} className={cn(className, 'hover:bg-muted')}>
      {children}
    </Link>
  );
}

/**
 * The page numbers to show: first, last, the current page and its neighbours,
 * with `null` standing in for a gap.
 *
 * Up to seven pages every number fits, so show them all — an ellipsis that
 * hides a single page is worse than the page.
 */
export function pageWindow(page: number, totalPages: number): (number | null)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const window = new Set([1, totalPages, page, page - 1, page + 1]);

  // Keep the control a constant width: near an end, the window there would be
  // clipped by the boundary, so it grows into the middle instead.
  if (page <= 3) [2, 3, 4].forEach((n) => window.add(n));
  if (page >= totalPages - 2)
    [totalPages - 3, totalPages - 2, totalPages - 1].forEach((n) => window.add(n));

  const pages = [...window].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);

  const result: (number | null)[] = [];
  let previous = 0;
  for (const current of pages) {
    if (current - previous > 1) result.push(null);
    result.push(current);
    previous = current;
  }
  return result;
}
