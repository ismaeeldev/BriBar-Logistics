import { Card, Skeleton } from '@/components/ui/primitives';

/**
 * Streaming placeholder while the driver's history loads (SRS 23.3).
 *
 * Its own shape rather than the shared `ListSkeleton`: this screen has a filter
 * strip above the list, and a skeleton that omits it would let the page jump
 * once the real one appears.
 */
export default function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-9 w-64 rounded-full" />
      <Card className="divide-y overflow-hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2 p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-52" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </Card>
    </div>
  );
}
