import { describe, expect, it } from 'vitest';

import { pageWindow } from '@/components/ui/pagination';

/**
 * The page strip is the one piece of pagination with logic in it, and its
 * failure mode is silent: a window that drops the current page, or one that
 * changes width as the reader moves through the list, looks plausible in a
 * screenshot and is wrong.
 */
describe('pageWindow', () => {
  it('shows every page when there are few enough to fit', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('gaps only where pages are actually skipped', () => {
    expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
  });

  it('grows the window inward rather than clipping it at either end', () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, 3, 4, null, 10]);
    expect(pageWindow(10, 10)).toEqual([1, null, 7, 8, 9, 10]);
  });

  it('never omits the current page, the first or the last', () => {
    for (let total = 1; total <= 40; total += 1) {
      for (let page = 1; page <= total; page += 1) {
        const pages = pageWindow(page, total).filter((entry) => entry !== null);
        expect(pages).toContain(page);
        expect(pages).toContain(1);
        expect(pages).toContain(total);
        // Strictly ascending: no repeats, no backtracking.
        expect([...pages].sort((a, b) => a - b)).toEqual(pages);
        expect(new Set(pages).size).toBe(pages.length);
      }
    }
  });

  it('keeps a constant footprint once the list is long enough to need gaps', () => {
    const widths = new Set<number>();
    for (let page = 1; page <= 20; page += 1) {
      widths.add(pageWindow(page, 20).length);
    }
    expect(widths).toEqual(new Set([6, 7]));
  });
});
