import type { CSSProperties, ReactNode } from 'react';

import { Table, TableWrap, Tbody, Thead, Tr } from '@/components/ui/table';
import { cn } from '@/lib/utils/cn';

/**
 * A record list that changes form with the screen, rather than shrinking.
 *
 * SRS 23.1 forbids horizontal scrolling for core actions and SRS 23.2 asks
 * admin screens to use desktop space well. Those pull in opposite directions,
 * and one layout cannot satisfy both: a seven-column table on a 375px phone
 * either scrolls sideways or truncates every cell to nothing.
 *
 * So the same rows render twice, and CSS picks:
 *
 *   below `md`   a stack of cards — each record is a block with its own
 *                heading, and the fields that matter wrap underneath
 *   `md` and up  a real `<table>`, with aligned columns and semantic headers
 *                a screen reader announces with each cell
 *
 * Rendering both is a deliberate trade. The rows are already in memory, the
 * duplicate markup is display:none rather than a second fetch, and the
 * alternative — picking a layout from a JavaScript media query — flashes the
 * wrong one on every load and breaks without JavaScript.
 *
 * Rows arrive in sequence rather than all at once, which reads as the list
 * being dealt out and gives the eye an order to follow. `.stagger` caps the
 * delay at ten steps, so a full page of twenty-five is no slower to finish
 * than a short one.
 */
export function ResponsiveList<T>({
  items,
  getKey,
  head,
  row,
  card,
  empty,
  className,
}: {
  items: T[];
  getKey: (item: T) => string;
  /** The `<tr>` of `<Th>` cells for the desktop table. */
  head: ReactNode;
  /** The `<Td>` cells for one desktop row. */
  row: (item: T) => ReactNode;
  /** The whole card body for one mobile record. */
  card: (item: T) => ReactNode;
  empty?: ReactNode;
  className?: string;
}) {
  if (items.length === 0 && empty) {
    return <div className={cn('bg-card rounded-xl border shadow-xs', className)}>{empty}</div>;
  }

  return (
    <>
      {/* Mobile: cards. */}
      <ul
        className={cn(
          'bg-card divide-y overflow-hidden rounded-xl border shadow-xs md:hidden',
          className,
        )}
      >
        {items.map((item, index) => (
          <li
            key={getKey(item)}
            style={{ '--i': index } as CSSProperties}
            className="animate-rise stagger"
          >
            {card(item)}
          </li>
        ))}
      </ul>

      {/* Desktop: a real table, built from the same primitives as before. */}
      <TableWrap className={cn('hidden md:block', className)}>
        <Table>
          <Thead>{head}</Thead>
          <Tbody>
            {items.map((item, index) => (
              <Tr
                key={getKey(item)}
                style={{ '--i': index } as CSSProperties}
                className="animate-rise stagger"
              >
                {row(item)}
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableWrap>
    </>
  );
}

/**
 * One field inside a mobile record card.
 *
 * A card cannot rely on a column header to say what a value is, so each value
 * carries its own label — the same information the `<th>` provides on the
 * desktop table, moved next to the data.
 */
export function CardField({
  label,
  children,
  mono,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-[0.7rem]">{label}</dt>
      <dd className={cn('truncate text-sm', mono && 'font-mono')}>{children}</dd>
    </div>
  );
}
