/**
 * `revalidatePath`, but a cache-invalidation failure can't crash the client.
 *
 * Every server action calls this right after its mutation has already
 * committed and right before `redirect()`. `redirect()` must stay outside
 * `try/catch` (it signals navigation by throwing), which means an exception
 * from `revalidatePath` — a stale cache entry, a transient store issue —
 * would otherwise propagate uncaught to the nearest error boundary and show
 * the user a full-page crash for a write that already succeeded. Losing this
 * revalidation only means the affected list is a beat behind until its next
 * natural refresh, which is a far smaller cost than that.
 */
import { revalidatePath } from 'next/cache';

import { logger } from '@/lib/logger';

export function revalidatePathSafely(path: string): void {
  try {
    revalidatePath(path);
  } catch (error) {
    logger.error(`revalidatePath(${path}) failed after a successful mutation`, error);
  }
}
