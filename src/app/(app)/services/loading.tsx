import { Card, Skeleton } from '@/components/ui/primitives';

/**
 * Streaming placeholder while a service list loads (SRS 23.3 - loading states).
 *
 * Mirrors the real layout rather than showing a spinner, so the page does not
 * reflow when the data arrives.
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
