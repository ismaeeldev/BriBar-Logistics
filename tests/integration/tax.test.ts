/**
 * The quarterly tax summary, end to end (ERP roadmap Phase 4, `06_Impuestos`).
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { clientService } from '@/modules/clients/service/client.service';
import { expenseCategoryService } from '@/modules/expense-categories/service/expense-category.service';
import { receivedInvoiceService } from '@/modules/received-invoices/service/received-invoice.service';
import { routeService } from '@/modules/routes/service/route.service';
import { serviceService } from '@/modules/services/service/service.service';
import { supplierService } from '@/modules/suppliers/service/supplier.service';
import { taxService } from '@/modules/taxes/service/tax.service';

import { seedFixture, serviceBody, type Fixture } from './helpers';

let fixture: Fixture;

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

beforeEach(async () => {
  fixture = await seedFixture();
});

describe('quarterly tax summary (ERP roadmap Phase 4)', () => {
  it('is empty with no invoices', async () => {
    const summary = await taxService.quarterlySummary(fixture.admin);
    expect(summary).toHaveLength(0);
  });

  it('reports VAT input from a received invoice, in its own quarter', async () => {
    const supplier = await supplierService.create(fixture.admin, {
      name: 'Proveedor',
      isActive: true,
    });
    const category = await expenseCategoryService.create(fixture.admin, {
      name: 'Reparaciones',
      expenseType: 'OPERATION',
      defaultVatRate: 'STANDARD',
      isActive: true,
    });

    // September -> Q3.
    await receivedInvoiceService.create(fixture.admin, {
      supplierId: supplier.id,
      categoryId: category.id,
      concept: 'Factura de prueba',
      invoiceDate: '2026-09-02',
      base: 10_000,
      vatRate: 'STANDARD',
    });

    const summary = await taxService.quarterlySummary(fixture.admin);

    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({ year: 2026, quarter: 3, vatInputCents: 2_100, vatOutputCents: 0 });
  });

  it('reports VAT output from an issued invoice', async () => {
    const client = await clientService.create(fixture.admin, {
      name: 'Cliente',
      isActive: true,
    });
    await routeService.update(fixture.admin, fixture.routeId, { clientId: client.id });

    const service = await serviceService.create(fixture.driver, serviceBody(fixture));
    await serviceService.updateRate(fixture.admin, service.id, 20_000);
    await serviceService.approve(fixture.admin, service.id);

    // The invoice doesn't exist anymore, we just approve the service.
    // The date of VAT output is the service date. By default `serviceBody(fixture)` creates a service with date 2026-09-02.

    const summary = await taxService.quarterlySummary(fixture.admin);

    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({ year: 2026, quarter: 3, vatOutputCents: 4_200, vatInputCents: 0 });
  });

  it('computes a positive balance (due) when output exceeds input', async () => {
    const client = await clientService.create(fixture.admin, { name: 'Cliente', isActive: true });
    await routeService.update(fixture.admin, fixture.routeId, { clientId: client.id });
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));
    await serviceService.updateRate(fixture.admin, service.id, 20_000);
    await serviceService.approve(fixture.admin, service.id);
    // No issued invoice.

    const summary = await taxService.quarterlySummary(fixture.admin);

    expect(summary[0]?.balanceCents).toBe(4_200);
  });

  it('groups invoices from different quarters into separate rows', async () => {
    const supplier = await supplierService.create(fixture.admin, { name: 'Proveedor', isActive: true });
    const category = await expenseCategoryService.create(fixture.admin, {
      name: 'Reparaciones',
      expenseType: 'OPERATION',
      defaultVatRate: 'STANDARD',
      isActive: true,
    });

    // Q3 and Q1 of the same year.
    await receivedInvoiceService.create(fixture.admin, {
      supplierId: supplier.id,
      categoryId: category.id,
      concept: 'Factura de prueba',
      invoiceDate: '2026-09-02',
      base: 10_000,
      vatRate: 'STANDARD',
    });
    await receivedInvoiceService.create(fixture.admin, {
      supplierId: supplier.id,
      categoryId: category.id,
      concept: 'Factura de prueba',
      invoiceDate: '2026-02-10',
      base: 5_000,
      vatRate: 'STANDARD',
    });

    const summary = await taxService.quarterlySummary(fixture.admin);

    expect(summary).toHaveLength(2);
    // Newest quarter first.
    expect(summary[0]).toMatchObject({ year: 2026, quarter: 3 });
    expect(summary[1]).toMatchObject({ year: 2026, quarter: 1 });
  });

  it('does not let a driver read it', async () => {
    await expectAppError(taxService.quarterlySummary(fixture.driver), 'FORBIDDEN');
  });
});
