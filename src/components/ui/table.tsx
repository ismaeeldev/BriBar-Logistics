import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';

/**
 * Table primitives for the admin screens (SRS 16.3, 23.2).
 *
 * "Admin tables, filters, and forms shall use available desktop space
 * effectively while remaining usable on smaller screens."
 *
 * A real `<table>`, wrapped in a horizontal scroller. SRS 23.1 forbids
 * horizontal scrolling for the *driver's* core actions, which is why the
 * driver screens use cards; an administrator comparing eight vehicles by plate
 * is better served by aligned columns, and scrolling a short row sideways on a
 * phone is a reasonable trade for that.
 *
 * Semantic markup matters here beyond tidiness: a screen reader announces
 * column headers with each cell only if the table is a real one (SRS 23.10).
 */
export function TableWrap({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('bg-card overflow-x-auto rounded-xl border shadow-xs', className)}
      {...props}
    />
  );
}

export function Table({ className, ...props }: ComponentProps<'table'>) {
  return <table className={cn('w-full text-sm', className)} {...props} />;
}

export function Thead({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cn('bg-muted/60 border-b', className)} {...props} />;
}

export function Th({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      className={cn(
        'text-muted-foreground px-4 py-2.5 text-left text-xs font-medium whitespace-nowrap',
        className,
      )}
      {...props}
    />
  );
}

export function Tbody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody className={cn('divide-y', className)} {...props} />;
}

export function Tr({ className, ...props }: ComponentProps<'tr'>) {
  return <tr className={cn('hover:bg-muted/40 transition-colors', className)} {...props} />;
}

export function Td({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('px-4 py-3 align-middle', className)} {...props} />;
}
