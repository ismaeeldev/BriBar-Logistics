/**
 * The issued-invoice module, end to end (ERP roadmap Phase 4).
 *
 * Admin-only throughout, same reasoning as `refuelling.test.ts` and
 * `received-invoice.test.ts`.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { AppError } from '@/lib/errors/app-error';
import { clientService } from '@/modules/clients/service/client.service';
import { issuedInvoiceService } from '@/modules/issued-invoices/service/issued-invoice.service';
import { routeService } from '@/modules/routes/service/route.service';
import { serviceService } from '@/modules/services/service/service.service';

import { prisma, seedFixture, serviceBody, type Fixture } from './helpers';

let fixture: Fixture;
let clientId: string;

async function billableService(rateCents = 18_000) {
  const service = await serviceService.create(fixture.driver, serviceBody(fixture));
  await serviceService.updateRate(fixture.admin, service.id, rateCents);
  return serviceService.approve(fixture.admin, service.id);
}

beforeEach(async () => {
  fixture = await seedFixture();

  const client = await clientService.create(fixture.admin, {
    name: 'Cliente Ejemplo SL',
    isActive: true,
  });
  clientId = client.id;

  // Both of the driver's own routes belong to this client, so every
  // approved, priced service `billableService()` creates is billable to it.
  await routeService.update(fixture.admin, fixture.routeId, { clientId });
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

describe('billable services for a client (ERP roadmap Phase 4)', () => {
  it('lists an approved, priced, unbilled service on the client route', async () => {
    const service = await billableService();

    const billable = await issuedInvoiceService.billableServicesForClient(fixture.admin, clientId);

    expect(billable.map((s) => s.id)).toContain(service.id);
  });

  it('excludes a pending service', async () => {
    await serviceService.create(fixture.driver, serviceBody(fixture));

    const billable = await issuedInvoiceService.billableServicesForClient(fixture.admin, clientId);
    expect(billable).toHaveLength(0);
  });

  it('excludes an approved service with no rate', async () => {
    const service = await serviceService.create(fixture.driver, serviceBody(fixture));
    await serviceService.approve(fixture.admin, service.id);

    const billable = await issuedInvoiceService.billableServicesForClient(fixture.admin, clientId);
    expect(billable).toHaveLength(0);
  });

  it('excludes a service already billed on another invoice', async () => {
    const service = await billableService();
    await issuedInvoiceService.create(fixture.admin, {
      clientId,
      invoiceDate: '2026-09-02',
      vatRate: 'STANDARD',
      serviceIds: [service.id],
    });

    const billable = await issuedInvoiceService.billableServicesForClient(fixture.admin, clientId);
    expect(billable).toHaveLength(0);
  });

  it('excludes a service on a route belonging to a different client', async () => {
    await billableService();
    const otherClient = await clientService.create(fixture.admin, {
      name: 'Otro cliente',
      isActive: true,
    });

    const billable = await issuedInvoiceService.billableServicesForClient(
      fixture.admin,
      otherClient.id,
    );
    expect(billable).toHaveLength(0);
  });
});

describe('creating an issued invoice (ERP roadmap Phase 4)', () => {
  it('sums the selected services base into the invoice base', async () => {
    const first = await billableService(18_000);
    const second = await billableService(12_000);

    const invoice = await issuedInvoiceService.create(fixture.admin, {
      clientId,
      invoiceDate: '2026-09-02',
      vatRate: 'STANDARD',
      serviceIds: [first.id, second.id],
    });

    expect(invoice.baseCents).toBe(30_000);
    expect(invoice.vatCents).toBe(6_300);
    expect(invoice.totalCents).toBe(36_300);
  });

  it('allocates a sequential invoice code', async () => {
    const service = await billableService();

    const invoice = await issuedInvoiceService.create(fixture.admin, {
      clientId,
      invoiceDate: '2026-09-02',
      vatRate: 'STANDARD',
      serviceIds: [service.id],
    });

    expect(invoice.invoiceCode).toBe('FE000001');
  });

  it('links every selected service to the invoice', async () => {
    const service = await billableService();

    const invoice = await issuedInvoiceService.create(fixture.admin, {
      clientId,
      invoiceDate: '2026-09-02',
      vatRate: 'STANDARD',
      serviceIds: [service.id],
    });

    const reloaded = await serviceService.getById(fixture.admin, service.id);
    expect(reloaded.issuedInvoiceId).toBe(invoice.id);
  });

  it('removes an invoiced service from the billable list', async () => {
    const service = await billableService();
    await issuedInvoiceService.create(fixture.admin, {
      clientId,
      invoiceDate: '2026-09-02',
      vatRate: 'STANDARD',
      serviceIds: [service.id],
    });

    const billable = await issuedInvoiceService.billableServicesForClient(fixture.admin, clientId);
    expect(billable).toHaveLength(0);
  });

  it('rejects a service id that does not belong to this client', async () => {
    const service = await billableService();
    const otherClient = await clientService.create(fixture.admin, {
      name: 'Otro cliente',
      isActive: true,
    });

    await expectAppError(
      issuedInvoiceService.create(fixture.admin, {
        clientId: otherClient.id,
        invoiceDate: '2026-09-02',
        vatRate: 'STANDARD',
        serviceIds: [service.id],
      }),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('rejects a service already billed on another invoice', async () => {
    const service = await billableService();
    await issuedInvoiceService.create(fixture.admin, {
      clientId,
      invoiceDate: '2026-09-02',
      vatRate: 'STANDARD',
      serviceIds: [service.id],
    });

    await expectAppError(
      issuedInvoiceService.create(fixture.admin, {
        clientId,
        invoiceDate: '2026-09-02',
        vatRate: 'STANDARD',
        serviceIds: [service.id],
      }),
      'BUSINESS_RULE_VIOLATION',
    );
  });

  it('records the creation in the audit log', async () => {
    const service = await billableService();

    const invoice = await issuedInvoiceService.create(fixture.admin, {
      clientId,
      invoiceDate: '2026-09-02',
      vatRate: 'STANDARD',
      serviceIds: [service.id],
    });

    const entry = await prisma.auditLog.findFirstOrThrow({ where: { entityId: invoice.id } });
    expect(entry.action).toBe('CREATE');
    expect(entry.actorUserId).toBe(fixture.admin.userId);
  });

  it('does not let a driver issue one', async () => {
    const service = await billableService();

    await expectAppError(
      issuedInvoiceService.create(fixture.driver, {
        clientId,
        invoiceDate: '2026-09-02',
        vatRate: 'STANDARD',
        serviceIds: [service.id],
      }),
      'FORBIDDEN',
    );
  });
});

describe('editing and deleting an issued invoice (ERP roadmap Phase 4)', () => {
  it('updates only the state and notes', async () => {
    const service = await billableService();
    const invoice = await issuedInvoiceService.create(fixture.admin, {
      clientId,
      invoiceDate: '2026-09-02',
      vatRate: 'STANDARD',
      serviceIds: [service.id],
    });

    const updated = await issuedInvoiceService.update(fixture.admin, invoice.id, {
      notes: 'Enviada por correo',
    });

    expect(updated.notes).toBe('Enviada por correo');
    expect(updated.baseCents).toBe(invoice.baseCents);
  });

  it('frees its services back to billable when deleted', async () => {
    const service = await billableService();
    const invoice = await issuedInvoiceService.create(fixture.admin, {
      clientId,
      invoiceDate: '2026-09-02',
      vatRate: 'STANDARD',
      serviceIds: [service.id],
    });

    await issuedInvoiceService.remove(fixture.admin, invoice.id);

    const billable = await issuedInvoiceService.billableServicesForClient(fixture.admin, clientId);
    expect(billable.map((s) => s.id)).toContain(service.id);
  });

  it('does not let a driver delete one', async () => {
    const service = await billableService();
    const invoice = await issuedInvoiceService.create(fixture.admin, {
      clientId,
      invoiceDate: '2026-09-02',
      vatRate: 'STANDARD',
      serviceIds: [service.id],
    });

    await expectAppError(
      issuedInvoiceService.remove(fixture.driver, invoice.id),
      'FORBIDDEN',
    );
  });
});
