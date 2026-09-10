/**
 * Transaction-log importers (ERP roadmap Phase 7).
 *
 * The sheets that record events over time, reference master data by name, and
 * carry their own date as a real input field (`year`/`month`, `date`,
 * `performedDate`) rather than a server-set one — so the historical date
 * survives the import through the module's own `createXSchema`, and the
 * natural key is a composite of columns that ARE stored (no allocated
 * document code to reconcile against).
 *
 * `tblRepostajes` (refuelling), `tblFacturasRecibidas` / `tblFacturasEmitidas`
 * (invoices) and historical `tblServicios` rows are deliberately **not** here:
 * their form services allocate the document code or set the date server-side,
 * so a faithful import needs a repository-level path — see ADR 0018.
 */
import { prisma } from '@/lib/db/prisma';
import { dailyKmLogService } from '@/modules/daily-km/service/daily-km-log.service';
import { createDailyKmLogSchema } from '@/modules/daily-km/schemas/daily-km-log.schema';
import { maintenanceRecordService } from '@/modules/maintenance/service/maintenance-record.service';
import { createMaintenanceRecordSchema } from '@/modules/maintenance/schemas/maintenance-record.schema';
import { personnelCostService } from '@/modules/personnel/service/personnel-cost.service';
import { createPersonnelCostSchema } from '@/modules/personnel/schemas/personnel-cost.schema';
import { cell, defineImporter, optionalCell } from '../define-importer';
import type { EntityImporter, Resolver } from '../importer';

function resolveRequired(
  resolve: Resolver,
  kind: Parameters<Resolver['resolve']>[0],
  name: string | undefined,
  label: string,
  errors: string[],
): string {
  if (name === undefined) {
    errors.push(`${label} is required`);
    return '';
  }
  const id = resolve.resolve(kind, name);
  if (id === null) {
    errors.push(`${label} "${name}" is not in its master-data sheet`);
    return '';
  }
  return id;
}

function resolveOptional(
  resolve: Resolver,
  kind: Parameters<Resolver['resolve']>[0],
  name: string | undefined,
  label: string,
  errors: string[],
): string | undefined {
  if (name === undefined) return undefined;
  const id = resolve.resolve(kind, name);
  if (id === null) {
    errors.push(`${label} "${name}" is not in its master-data sheet`);
    return undefined;
  }
  return id;
}

export const personnelCostImporter: EntityImporter = defineImporter({
  entity: 'personnelCost',
  sheet: 'tblPersonal',
  schema: createPersonnelCostSchema,
  async loadExisting() {
    const rows = await prisma.personnelCost.findMany({
      select: { user: { select: { name: true } }, year: true, month: true },
    });
    return new Set(
      rows.map((row) => `${row.user.name.trim().toLowerCase()}|${row.year}|${row.month}`),
    );
  },
  naturalKey: (row) =>
    `${cell(row, 'employee').toLowerCase()}|${cell(row, 'year')}|${cell(row, 'month')}`,
  map: (row, resolve) => {
    const errors: string[] = [];
    return {
      value: {
        userId: resolveRequired(resolve, 'user', optionalCell(row, 'employee'), 'employee', errors),
        year: cell(row, 'year'),
        month: cell(row, 'month'),
        base: cell(row, 'base'),
        overtime: optionalCell(row, 'overtime') ?? '',
        allowances: optionalCell(row, 'allowances') ?? '',
        other: optionalCell(row, 'other') ?? '',
        notes: optionalCell(row, 'notes'),
      },
      errors,
    };
  },
  create: (input, ctx) => personnelCostService.create(ctx.actor, input),
});

export const dailyKmImporter: EntityImporter = defineImporter({
  entity: 'dailyKmLog',
  sheet: 'tblKmReales',
  schema: createDailyKmLogSchema,
  async loadExisting() {
    const rows = await prisma.dailyKmLog.findMany({
      select: { vehicle: { select: { registrationPlate: true } }, date: true },
    });
    return new Set(
      rows.map(
        (row) =>
          `${row.vehicle.registrationPlate.trim().toLowerCase()}|${row.date.toISOString().slice(0, 10)}`,
      ),
    );
  },
  naturalKey: (row) =>
    `${cell(row, 'vehicle').toLowerCase().replace(/\s+/g, ' ')}|${cell(row, 'date')}`,
  map: (row, resolve) => {
    const errors: string[] = [];
    return {
      value: {
        vehicleId: resolveRequired(resolve, 'vehicle', optionalCell(row, 'vehicle'), 'vehicle', errors),
        routeId: resolveOptional(resolve, 'route', optionalCell(row, 'contract'), 'contract', errors) ?? '',
        driverId: resolveOptional(resolve, 'user', optionalCell(row, 'driver'), 'driver', errors) ?? '',
        date: cell(row, 'date'),
        actualKm: cell(row, 'actualKm'),
        workedHours: optionalCell(row, 'workedHours'),
        notes: optionalCell(row, 'notes'),
      },
      errors,
    };
  },
  create: (input, ctx) => dailyKmLogService.create(ctx.actor, input),
});

export const maintenanceImporter: EntityImporter = defineImporter({
  entity: 'maintenanceRecord',
  sheet: 'tblMantenimientos',
  schema: createMaintenanceRecordSchema,
  async loadExisting() {
    // The sheet's own `MT…` codes are continued by `db:set-sequence`; a
    // re-run is guarded on (vehicle, type, performed date) instead, which is
    // what actually identifies "the same maintenance event".
    const rows = await prisma.maintenanceRecord.findMany({
      select: {
        vehicle: { select: { registrationPlate: true } },
        maintenanceType: { select: { name: true } },
        performedDate: true,
      },
    });
    return new Set(
      rows.map(
        (row) =>
          `${row.vehicle.registrationPlate.trim().toLowerCase()}|${row.maintenanceType.name.trim().toLowerCase()}|${row.performedDate.toISOString().slice(0, 10)}`,
      ),
    );
  },
  naturalKey: (row) =>
    `${cell(row, 'vehicle').toLowerCase().replace(/\s+/g, ' ')}|${cell(row, 'type').toLowerCase()}|${cell(row, 'performedDate')}`,
  map: (row, resolve) => {
    const errors: string[] = [];
    return {
      value: {
        vehicleId: resolveRequired(resolve, 'vehicle', optionalCell(row, 'vehicle'), 'vehicle', errors),
        maintenanceTypeId: resolveRequired(
          resolve,
          'lookup:MAINTENANCE_TYPE',
          optionalCell(row, 'type'),
          'maintenance type',
          errors,
        ),
        performedDate: cell(row, 'performedDate'),
        performedKm: optionalCell(row, 'performedKm') ?? '',
        nextDueKm: optionalCell(row, 'nextDueKm') ?? '',
        nextDueDate: optionalCell(row, 'nextDueDate') ?? '',
        notes: optionalCell(row, 'notes'),
      },
      errors,
    };
  },
  create: (input, ctx) => maintenanceRecordService.create(ctx.actor, input),
});
