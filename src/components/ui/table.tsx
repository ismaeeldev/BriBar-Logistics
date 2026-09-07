'use client';

import type { ComponentProps } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronsUpDown, ChevronDown, ChevronUp } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

/**
 * Table primitives for the admin screens (SRS 16.3, 23.2).
 *
 * "Admin tables, filters, and forms shall use available desktop space
 * effectively while remaining usable on smaller screens."
 *
 * A real `<table>`, wrapped in a horizontal scroller. Nothing here decides
 * *when* a table is the right shape - `ResponsiveList` does that, and composes
 * these pieces for the `md`-and-up half of every admin list. They stay separate
 * because the styling of a cell is a different concern from the choice between
 * a table and a stack of cards.
 *
 * Semantic markup matters here beyond tidiness: a screen reader announces
 * column headers with each cell only if the table is a real one (SRS 23.10).
 */
export function TableWrap({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'bg-card animate-rise overflow-x-auto rounded-2xl border border-border/50 shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

export function Table({ className, ...props }: ComponentProps<'table'>) {
  return <table className={cn('w-full text-sm', className)} {...props} />;
}

export function Thead({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cn('bg-muted/70 border-b border-border/70', className)} {...props} />;
}

export function Th({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      className={cn(
        'text-muted-foreground px-3 py-2.5 text-left text-xs font-medium whitespace-nowrap',
        className,
      )}
      {...props}
    />
  );
}

export function SortableTh({
  sortKey,
  children,
  className,
}: {
  sortKey: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSort = searchParams?.get('sort');
  const currentDir = searchParams?.get('dir');

  const isActive = currentSort === sortKey;

  const toggleSort = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('sort', sortKey);

    if (isActive && currentDir === 'asc') {
      params.set('dir', 'desc');
    } else if (isActive && currentDir === 'desc') {
      params.delete('sort');
      params.delete('dir');
    } else {
      params.set('dir', 'asc');
    }

    // Reset to page 1 when sorting changes
    params.delete('page');

    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Th className={className}>
      <button
        type="button"
        onClick={toggleSort}
        className="flex items-center gap-1.5 hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm -ml-1.5 px-1.5 py-0.5"
      >
        {children}
        {isActive && currentDir === 'asc' ? (
          <ChevronUp className="size-3 text-foreground" />
        ) : isActive && currentDir === 'desc' ? (
          <ChevronDown className="size-3 text-foreground" />
        ) : (
          <ChevronsUpDown className="size-3 opacity-30 group-hover:opacity-100" />
        )}
      </button>
    </Th>
  );
}

export function Tbody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody className={cn('divide-y', className)} {...props} />;
}

export function Tr({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        // The inset shadow reads as a rail along the row's left edge without
        // shifting any cell — a hover cue with no layout cost.
        'hover:bg-muted/50 hover:shadow-[inset_3px_0_0_0_var(--primary)] transition-[background-color,box-shadow] duration-150',
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('px-3 py-3 align-middle', className)} {...props} />;
}
