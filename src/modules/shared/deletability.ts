/**
 * Whether a master-data record can be removed, and what stands in the way.
 *
 * The system's whole purpose is the service record, so a vehicle, route or
 * account that a service points at is never deleted — SRS 21.5 makes
 * deactivation the removal path, and the `onDelete: Restrict` foreign keys
 * enforce it whatever the application layer believes. What is left over is a
 * record created by mistake, or one that never got used: those are noise, and
 * deleting them is the only way to get rid of them.
 *
 * The answer is computed before the screen renders rather than after the
 * button is pressed. An administrator should be told "4 services use this
 * vehicle — deactivate it instead" while deciding, not shown a foreign-key
 * error afterwards.
 */
export interface Deletability {
  canDelete: boolean;
  /** Records that block deletion, by kind. Empty when `canDelete`. */
  blockers: { kind: DeletionBlocker; count: number }[];
  /**
   * Configuration that will be removed along with the record. Not a blocker —
   * it exists so the confirmation can say what else disappears.
   */
  cascades: { kind: DeletionCascade; count: number }[];
}

export type DeletionBlocker = 'services' | 'approvals' | 'statusChanges' | 'defaultForUsers';

export type DeletionCascade = 'routeAssignments';

/** Builds the result, so no caller has to remember to keep the flag in step. */
export function toDeletability(
  blockerCounts: Partial<Record<DeletionBlocker, number>>,
  cascadeCounts: Partial<Record<DeletionCascade, number>> = {},
): Deletability {
  const blockers = Object.entries(blockerCounts)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([kind, count]) => ({ kind: kind as DeletionBlocker, count: count as number }));

  const cascades = Object.entries(cascadeCounts)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([kind, count]) => ({ kind: kind as DeletionCascade, count: count as number }));

  return { canDelete: blockers.length === 0, blockers, cascades };
}
