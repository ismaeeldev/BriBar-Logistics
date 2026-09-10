/**
 * The received-invoice module, end to end (ERP roadmap Phase 3).
 *
 * Admin-only throughout, same reasoning as `refuelling.test.ts`.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { expenseCategoryService } from '@/modules/expense-categories/service/expense-category.service';
import { lookupService } from '@/modules/lookup/service/lookup.service';
import { receivedInvoiceService } from '@/modules/received-invoices/service/received-invoice.service';
import { supplierService } from '@/modules/suppliers/service/supplier.service';

import { prisma, seedFixture, type Fixture } from './helpers';

let fixture: Fixture;
let supplierId: string;
let operationCategoryId: string;
let investmentCategoryId: string;

beforeEach(async () => {
  fixture = await seedFixture();

  const supplier = await supplierService.create(fixture.admin, {
    name: 'Taller Ejemplo SL',
    isActive: true,
  });
  supplierId = supplier.id;

  const operationCategory = await expenseCategoryService.create(fixture.admin, {
    name: 'Reparaciones',
    expenseType: 'OPERATION',
    defaultVatRate: 'STANDARD',
    isActive: true,
  });
  operationCategoryId = operationCategory.id;

  const investmentCategory = await expenseCategoryService.create(fixture.admin, {
    name: 'Compra de vehículo',
    expenseType: 'INVESTMENT',
    defaultVatRate: 'STANDARD',
    isActive: true,
  });
  investmentCategoryId = investmentCategory.id;
});

async function expectAppError(promise: Promise<unknown>, code: string): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    return error as AppError;
  }
  throw new Error(`Expected the call to fail with ${code}, but it resolved.`);
}

/** A valid received-invoice payload; tests override the field under examination. */
function invoiceBody(overrides: Record<string, unknown> = {}) {
  return {
    supplierId,
    categoryId: operationCategoryId,
    invoiceDate: '2026-09-02',
    base: 10_000, // €100.00
    vatRate: 'STANDARD' as const,
    ...overrides,
  };
}

describe('creating a received invoice (ERP roadmap Phase 3)', () => {
  it('records it, allocating a sequential invoice code', async () => {
    const first = await receivedInvoiceService.create(fixture.admin, invoiceBody());
    const second = await receivedInvoiceService.create(fixture.admin, invoiceBody());

    expect(first.invoiceCode).toBe('FR000001');
    expect(second.invoiceCode).toBe('FR000002');
  });

  it('derives VAT and total forwards from the base amount', async () => {
    // €100.00 base at 21% -> €21.00 VAT -> €121.00 total.
    const created = await receivedInvoiceService.create(
      fixture.admin,
      invoiceBody({ base: 10_000, vatRate: 'STANDARD' }),
    );

    expect(created.baseCents).toBe(10_000);
    expect(created.vatCents).toBe(2_100);
    expect(created.totalCents).toBe(12_100);
  });

  it('keeps base + vat == total at every rate', async () => {
    for (const vatRate of ['STANDARD', 'REDUCED', 'SUPER_REDUCED', 'ZERO', 'EXEMPT'] as const) {
      const created = await receivedInvoiceService.create(
        fixture.admin,
        invoiceBody({ base: 12_345, vatRate }),
      );
      expect(created.baseCents + created.vatCents).toBe(created.totalCents);
    }
  });

  it('stores the invoice date exactly as given, not shifted to today', async () => {
    const created = await receivedInvoiceService.create(
      fixture.admin,
      invoiceBody({ invoiceDate: '2026-01-15' }),
    );

    expect(created.invoiceDate.toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });

  it('allows an invoice with no vehicle', async () => {
    const created = await receivedInvoiceService.create(fixture.admin, invoiceBody());
    expect(created.vehicleId).toBeNull();
  });

  it('accepts an invoice tied to a vehicle', async () => {
    const created = await receivedInvoiceService.create(
      fixture.admin,
      invoiceBody({ vehicleId: fixture.vehicleId }),
    );
    expect(created.vehicleId).toBe(fixture.vehicleId);
  });

  it('rejects a deactivated supplier', async () => {
    await supplierService.update(fixture.admin, supplierId, { isActive: false });

    await expectAppError(
      receivedInvoiceService.create(fixture.admin, invoiceBody()),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('rejects a deactivated category', async () => {
    await expenseCategoryService.update(fixture.admin, operationCategoryId, { isActive: false });

    await expectAppError(
      receivedInvoiceService.create(fixture.admin, invoiceBody()),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('rejects a deactivated vehicle', async () => {
    await expectAppError(
      receivedInvoiceService.create(
        fixture.admin,
        invoiceBody({ vehicleId: fixture.inactiveVehicleId }),
      ),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('rejects a lookup id from the wrong kind', async () => {
    const fuelType = await lookupService.create(fixture.admin, 'FUEL_TYPE', {
      name: 'Diésel',
      isActive: true,
    });

    await expectAppError(
      receivedInvoiceService.create(fixture.admin, invoiceBody({ stateId: fuelType.id })),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('records the creation in the audit log', async () => {
    const created = await receivedInvoiceService.create(fixture.admin, invoiceBody());

    const entry = await prisma.auditLog.findFirstOrThrow({ where: { entityId: created.id } });

    expect(entry.action).toBe('CREATE');
    expect(entry.actorUserId).toBe(fixture.admin.userId);
  });

  it('does not let a driver record one', async () => {
    await expectAppError(
      receivedInvoiceService.create(fixture.driver, invoiceBody()),
      'FORBIDDEN',
    );
  });
});

describe('editing a received invoice (ERP roadmap Phase 3)', () => {
  it('recalculates VAT/total only when the base or the rate changes', async () => {
    const created = await receivedInvoiceService.create(
      fixture.admin,
      invoiceBody({ base: 10_000, vatRate: 'STANDARD' }),
    );

    const untouched = await receivedInvoiceService.update(fixture.admin, created.id, {
      notes: 'Corregido',
    });
    expect(untouched.vatCents).toBe(created.vatCents);
    expect(untouched.totalCents).toBe(created.totalCents);

    const recalculated = await receivedInvoiceService.update(fixture.admin, created.id, {
      base: 20_000,
    });
    expect(recalculated.vatCents).toBe(4_200);
    expect(recalculated.totalCents).toBe(24_200);
  });

  it('does not let a driver edit one', async () => {
    const created = await receivedInvoiceService.create(fixture.admin, invoiceBody());

    await expectAppError(
      receivedInvoiceService.update(fixture.driver, created.id, { base: 20_000 }),
      'FORBIDDEN',
    );
  });
});

describe('deleting a received invoice (ERP roadmap Phase 3)', () => {
  it('lets an administrator delete it', async () => {
    const created = await receivedInvoiceService.create(fixture.admin, invoiceBody());

    await receivedInvoiceService.remove(fixture.admin, created.id);

    await expectAppError(receivedInvoiceService.getById(fixture.admin, created.id), 'NOT_FOUND');
  });

  it('does not let a driver delete one', async () => {
    const created = await receivedInvoiceService.create(fixture.admin, invoiceBody());

    await expectAppError(
      receivedInvoiceService.remove(fixture.driver, created.id),
      'FORBIDDEN',
    );
  });
});

describe('investment summary (ERP roadmap Phase 3, 07_Inversiones)', () => {
  it('is empty when no investment-category invoices exist', async () => {
    await receivedInvoiceService.create(
      fixture.admin,
      invoiceBody({ categoryId: operationCategoryId, vehicleId: fixture.vehicleId }),
    );

    const summary = await receivedInvoiceService.investmentSummary(fixture.admin);
    expect(summary).toHaveLength(0);
  });

  it('totals investment-category invoices per vehicle', async () => {
    await receivedInvoiceService.create(
      fixture.admin,
      invoiceBody({ categoryId: investmentCategoryId, vehicleId: fixture.vehicleId, base: 100_000 }),
    );
    await receivedInvoiceService.create(
      fixture.admin,
      invoiceBody({ categoryId: investmentCategoryId, vehicleId: fixture.vehicleId, base: 50_000 }),
    );

    const summary = await receivedInvoiceService.investmentSummary(fixture.admin);

    expect(summary).toHaveLength(1);
    expect(summary[0]?.vehicle.id).toBe(fixture.vehicleId);
    expect(summary[0]?.invoiceCount).toBe(2);
    // (100,000 + 21,000) + (50,000 + 10,500) = 181,500 cents at 21% VAT.
    expect(summary[0]?.totalCents).toBe(181_500);
  });

  it('ignores investment invoices with no vehicle', async () => {
    await receivedInvoiceService.create(
      fixture.admin,
      invoiceBody({ categoryId: investmentCategoryId }),
    );

    const summary = await receivedInvoiceService.investmentSummary(fixture.admin);
    expect(summary).toHaveLength(0);
  });

  it('keeps two vehicles separate', async () => {
    await receivedInvoiceService.create(
      fixture.admin,
      invoiceBody({
        categoryId: investmentCategoryId,
        vehicleId: fixture.vehicleId,
        base: 100_000,
      }),
    );
    await receivedInvoiceService.create(
      fixture.admin,
      invoiceBody({
        categoryId: investmentCategoryId,
        vehicleId: fixture.spareVehicleId,
        base: 20_000,
      }),
    );

    const summary = await receivedInvoiceService.investmentSummary(fixture.admin);

    expect(summary).toHaveLength(2);
    const byVehicle = new Map(summary.map((row) => [row.vehicle.id, row]));
    expect(byVehicle.get(fixture.vehicleId)?.invoiceCount).toBe(1);
    expect(byVehicle.get(fixture.spareVehicleId)?.invoiceCount).toBe(1);
  });

  it('does not let a driver read it', async () => {
    await expectAppError(
      receivedInvoiceService.investmentSummary(fixture.driver),
      'FORBIDDEN',
    );
  });
});
