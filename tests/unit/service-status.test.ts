/**
 * SRS 26.4 (Approval Tests) and Appendix B, at the level the domain can be
 * checked without a database.
 *
 * These are the permission rules themselves. The corresponding HTTP tests -
 * that a driver's PATCH against an approved service really returns 409 - land
 * in Phase 2 once the endpoints exist; what this file guarantees is that both
 * the API and the UI will be asking the same, correct question.
 */
import { describe, expect, it } from 'vitest';

import {
  Role,
  SERVICE_TRANSITIONS,
  ServiceStatus,
  canApprove,
  canEdit,
  canTransition,
  canView,
  isTerminal,
} from '@/modules/services/domain/service-status';

const DRIVER = { userId: 'driver-1', role: Role.DRIVER };
const OTHER_DRIVER = { userId: 'driver-2', role: Role.DRIVER };
const ADMIN = { userId: 'admin-1', role: Role.ADMIN };

const pendingOwnedByDriver1 = {
  driverId: 'driver-1',
  status: ServiceStatus.PENDING_APPROVAL,
};
const approvedOwnedByDriver1 = {
  driverId: 'driver-1',
  status: ServiceStatus.APPROVED,
};

describe('transitions (SRS 34.1)', () => {
  it('allows Pending Approval to move to Approved', () => {
    expect(canTransition(ServiceStatus.PENDING_APPROVAL, ServiceStatus.APPROVED)).toBe(true);
  });

  it('does not allow Approved to move back to Pending Approval (SRS 11.4)', () => {
    expect(canTransition(ServiceStatus.APPROVED, ServiceStatus.PENDING_APPROVAL)).toBe(false);
  });

  it('treats Approved as terminal in V1', () => {
    expect(isTerminal(ServiceStatus.APPROVED)).toBe(true);
    expect(isTerminal(ServiceStatus.PENDING_APPROVAL)).toBe(false);
  });

  it('covers every status in the transition table', () => {
    // Guards the extension point in SRS 21.2: adding a status to the enum
    // without adding its transitions would leave `canTransition` throwing on
    // an undefined lookup, and this test fails first.
    for (const status of Object.values(ServiceStatus)) {
      expect(SERVICE_TRANSITIONS[status]).toBeDefined();
    }
  });
});

describe('canView (SRS 9.7)', () => {
  it('lets a driver see their own service', () => {
    expect(canView(DRIVER, pendingOwnedByDriver1)).toBe(true);
  });

  it('does not let a driver see another driver’s service', () => {
    expect(canView(OTHER_DRIVER, pendingOwnedByDriver1)).toBe(false);
  });

  it('lets an admin see every service', () => {
    expect(canView(ADMIN, pendingOwnedByDriver1)).toBe(true);
    expect(canView(ADMIN, approvedOwnedByDriver1)).toBe(true);
  });
});

describe('canEdit (SRS 11.2, 11.4, 34.2)', () => {
  it('lets a driver edit their own Pending Approval service', () => {
    expect(canEdit(DRIVER, pendingOwnedByDriver1)).toBe(true);
  });

  it('locks a driver out once the service is Approved (SRS 11.4)', () => {
    expect(canEdit(DRIVER, approvedOwnedByDriver1)).toBe(false);
  });

  it('does not let a driver edit another driver’s pending service', () => {
    expect(canEdit(OTHER_DRIVER, pendingOwnedByDriver1)).toBe(false);
  });

  it('lets an admin edit a Pending Approval service', () => {
    expect(canEdit(ADMIN, pendingOwnedByDriver1)).toBe(true);
  });

  it('lets an admin edit an Approved service (SRS 11.4, 21.3)', () => {
    expect(canEdit(ADMIN, approvedOwnedByDriver1)).toBe(true);
  });

  it('does not restore driver access after an admin edits an approved service', () => {
    // The rule depends only on role and status, so there is no per-service
    // flag an admin edit could flip. SRS 21.3 is structural, not a code path.
    expect(canEdit(ADMIN, approvedOwnedByDriver1)).toBe(true);
    expect(canEdit(DRIVER, approvedOwnedByDriver1)).toBe(false);
  });
});

describe('canApprove (SRS 11.3)', () => {
  it('lets an admin approve a Pending Approval service', () => {
    expect(canApprove(ADMIN, pendingOwnedByDriver1)).toBe(true);
  });

  it('does not let an admin approve an already-approved service', () => {
    expect(canApprove(ADMIN, approvedOwnedByDriver1)).toBe(false);
  });

  it('never lets a driver approve, not even their own service', () => {
    expect(canApprove(DRIVER, pendingOwnedByDriver1)).toBe(false);
    expect(canApprove(OTHER_DRIVER, pendingOwnedByDriver1)).toBe(false);
  });
});
