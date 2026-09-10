/**
 * The URGENTE/PRÓXIMO/OK bands (ERP roadmap Phase 5).
 */
import { describe, expect, it } from 'vitest';

import { maintenanceUrgency } from '@/modules/maintenance/domain/maintenance-urgency';

const TODAY = new Date('2026-09-09T00:00:00.000Z');

describe('maintenanceUrgency', () => {
  it('is UNKNOWN with no signals at all', () => {
    expect(
      maintenanceUrgency({ nextDueKm: null, currentKm: null, nextDueDate: null, today: TODAY }),
    ).toBe('UNKNOWN');
  });

  it('is UNKNOWN for a km-tracked type with no current odometer reading', () => {
    expect(
      maintenanceUrgency({ nextDueKm: 50_000, currentKm: null, nextDueDate: null, today: TODAY }),
    ).toBe('UNKNOWN');
  });

  describe('km signal', () => {
    it('is OK well before the due reading', () => {
      expect(
        maintenanceUrgency({
          nextDueKm: 50_000,
          currentKm: 40_000,
          nextDueDate: null,
          today: TODAY,
        }),
      ).toBe('OK');
    });

    it('is UPCOMING within the upcoming band', () => {
      expect(
        maintenanceUrgency({
          nextDueKm: 50_000,
          currentKm: 48_500,
          nextDueDate: null,
          today: TODAY,
        }),
      ).toBe('UPCOMING');
    });

    it('is URGENT within the urgent band', () => {
      expect(
        maintenanceUrgency({
          nextDueKm: 50_000,
          currentKm: 49_800,
          nextDueDate: null,
          today: TODAY,
        }),
      ).toBe('URGENT');
    });

    it('is URGENT once overdue', () => {
      expect(
        maintenanceUrgency({
          nextDueKm: 50_000,
          currentKm: 50_500,
          nextDueDate: null,
          today: TODAY,
        }),
      ).toBe('URGENT');
    });
  });

  describe('date signal', () => {
    it('is OK well before the due date', () => {
      expect(
        maintenanceUrgency({
          nextDueKm: null,
          currentKm: null,
          nextDueDate: new Date('2026-12-01T00:00:00.000Z'),
          today: TODAY,
        }),
      ).toBe('OK');
    });

    it('is UPCOMING within the upcoming band', () => {
      expect(
        maintenanceUrgency({
          nextDueKm: null,
          currentKm: null,
          nextDueDate: new Date('2026-09-25T00:00:00.000Z'),
          today: TODAY,
        }),
      ).toBe('UPCOMING');
    });

    it('is URGENT within the urgent band', () => {
      expect(
        maintenanceUrgency({
          nextDueKm: null,
          currentKm: null,
          nextDueDate: new Date('2026-09-15T00:00:00.000Z'),
          today: TODAY,
        }),
      ).toBe('URGENT');
    });

    it('is URGENT once overdue', () => {
      expect(
        maintenanceUrgency({
          nextDueKm: null,
          currentKm: null,
          nextDueDate: new Date('2026-09-01T00:00:00.000Z'),
          today: TODAY,
        }),
      ).toBe('URGENT');
    });
  });

  it('takes the more urgent of the two signals when both are present', () => {
    expect(
      maintenanceUrgency({
        nextDueKm: 50_000,
        currentKm: 40_000, // OK by km
        nextDueDate: new Date('2026-09-10T00:00:00.000Z'), // URGENT by date
        today: TODAY,
      }),
    ).toBe('URGENT');
  });
});
