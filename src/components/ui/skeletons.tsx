import { Card, Skeleton } from '@/components/ui/primitives';

/**
 * Placeholders that stand in for a screen while its data is on the way.
 *
 * They mirror the real layout rather than showing a spinner, so nothing on the
 * page moves when the content arrives — a spinner tells the reader to wait, a
 * skeleton tells them what they are waiting for and holds its place.
 *
 * Both shapes below are shared by several routes, which is the reason they live
 * here rather than being copied into each `loading.tsx`: a skeleton that has
 * drifted from the layout it stands in for is worse than none, because the page
 * jumps at exactly the moment the reader starts reading.
 */

/** A list screen: a heading, and rows. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-24" />
      </div>

      <Card className="divide-y overflow-hidden">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-4 w-24 shrink-0" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-20 shrink-0 sm:block" />
            <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
          </div>
        ))}
      </Card>
    </div>
  );
}

/** A dashboard: the hero band, a row of tiles, then the queue. */
export function DashboardSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 rounded-2xl sm:h-36" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: tiles }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>

      <ListSkeleton rows={4} />
    </div>
  );
}

/** A form screen: a heading, and input fields. */
export function FormSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>

      <Card className="max-w-2xl space-y-4">
        <div className="p-6 space-y-5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
          <div className="flex items-center gap-3 pt-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </Card>
    </div>
  );
}
