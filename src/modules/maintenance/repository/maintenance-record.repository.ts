/**
 * Database access for maintenance records (ERP roadmap Phase 5).
 */
import type { Prisma } from '@prisma/client';

import type { PrismaClientLike } from '@/lib/db/prisma';
import { prisma } from '@/lib/db/prisma';
import type { Pagination } from '@/modules/shared/schemas/common';
import { toPrismaPagination } from '@/modules/shared/schemas/common';

const MAINTENANCE_RECORD_INCLUDE = {
  vehicle: { select: { id: true, registrationPlate: true, referenceName: true } },
  maintenanceType: { select: { id: true, name: true } },
} satisfies Prisma.MaintenanceRecordInclude;

export type MaintenanceRecordWithRelations = Prisma.MaintenanceRecordGetPayload<{
  include: typeof MAINTENANCE_RECORD_INCLUDE;
}>;

const MAINTENANCE_CODE_SEQUENCE = 'maintenance_code_seq';

export const maintenanceRecordRepository = {
  async findById(
    id: string,
    client: PrismaClientLike = prisma,
  ): Promise<MaintenanceRecordWithRelations | null> {
    return client.maintenanceRecord.findUnique({
      where: { id },
      include: MAINTENANCE_RECORD_INCLUDE,
    });
  },

  async listPage(
    filters: { vehicleId?: string; maintenanceTypeId?: string },
    pagination: Pagination,
    client: PrismaClientLike = prisma,
  ): Promise<{ items: MaintenanceRecordWithRelations[]; total: number }> {
    const where: Prisma.MaintenanceRecordWhereInput = {
      ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
      ...(filters.maintenanceTypeId ? { maintenanceTypeId: filters.maintenanceTypeId } : {}),
    };

    const [items, total] = await Promise.all([
      client.maintenanceRecord.findMany({
        where,
        include: MAINTENANCE_RECORD_INCLUDE,
        orderBy: [{ performedDate: 'desc' }, { createdAt: 'desc' }],
        ...toPrismaPagination(pagination),
      }),
      client.maintenanceRecord.count({ where }),
    ]);

    return { items, total };
  },

  /**
   * Every open record — one with a `nextDueKm` or `nextDueDate` still set —
   * for the fleet-wide "due soon" alert view (roadmap §4's URGENTE/PRÓXIMO/OK
   * bands). Records with neither signal are excluded at the query level
   * rather than fetched and filtered in application code: they can never
   * contribute anything but `UNKNOWN`, per `maintenanceUrgency`.
   */
  async withOpenSchedule(
    client: PrismaClientLike = prisma,
  ): Promise<MaintenanceRecordWithRelations[]> {
    return client.maintenanceRecord.findMany({
      where: { OR: [{ nextDueKm: { not: null } }, { nextDueDate: { not: null } }] },
      include: MAINTENANCE_RECORD_INCLUDE,
      orderBy: [{ vehicleId: 'asc' }, { performedDate: 'desc' }],
    });
  },

  /**
   * The most recent record for a vehicle/type pair, so a new entry's urgency
   * banding is computed against what preceded it rather than only ever the
   * newest overall row.
   */
  async mostRecentForVehicleAndType(
    vehicleId: string,
    maintenanceTypeId: string,
    excludeId?: string,
    client: PrismaClientLike = prisma,
  ): Promise<MaintenanceRecordWithRelations | null> {
    return client.maintenanceRecord.findFirst({
      where: {
        vehicleId,
        maintenanceTypeId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      include: MAINTENANCE_RECORD_INCLUDE,
      orderBy: { performedDate: 'desc' },
    });
  },

  /**
   * Allocates the next maintenance code (ADR 0003's pattern, generalised by
   * `formatDocumentCode`). Same atomicity guarantee as every other document
   * sequence: `nextval()` is never rolled back, so two concurrent submissions
   * can never collide.
   */
  async nextMaintenanceSequence(client: PrismaClientLike = prisma): Promise<bigint> {
    const rows = await client.$queryRawUnsafe<{ value: bigint }[]>(
      `SELECT nextval('${MAINTENANCE_CODE_SEQUENCE}') AS value`,
    );

    const value = rows[0]?.value;
    if (value === undefined) {
      throw new Error(`Sequence "${MAINTENANCE_CODE_SEQUENCE}" returned no value.`);
    }
    return value;
  },

  async create(
    data: Prisma.MaintenanceRecordUncheckedCreateInput,
    client: PrismaClientLike = prisma,
  ): Promise<MaintenanceRecordWithRelations> {
    return client.maintenanceRecord.create({ data, include: MAINTENANCE_RECORD_INCLUDE });
  },

  async update(
    id: string,
    data: Prisma.MaintenanceRecordUncheckedUpdateInput,
    client: PrismaClientLike = prisma,
  ): Promise<MaintenanceRecordWithRelations> {
    return client.maintenanceRecord.update({
      where: { id },
      data,
      include: MAINTENANCE_RECORD_INCLUDE,
    });
  },

  async delete(id: string, client: PrismaClientLike = prisma): Promise<void> {
    await client.maintenanceRecord.delete({ where: { id } });
  },
} as const;

export type MaintenanceRecordRepository = typeof maintenanceRecordRepository;
export { MAINTENANCE_CODE_SEQUENCE };
