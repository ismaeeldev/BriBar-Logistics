/**
 * Master-data importers (ERP roadmap Phase 7).
 *
 * `99_Listas` and the entity sheets it feeds: clients, suppliers, expense
 * categories, the seven simple lookup lists, vehicles, and routes/contracts
 * (with their base rate from `tblTarifasContratos`). None of these carry a
 * server-owned date or a document sequence, so each maps cleanly onto the
 * module's own `createXSchema` and its service — the exact path the admin
 * forms take.
 */
import type { LookupKind } from '@prisma/client';

import { LOOKUP_KINDS } from '@/modules/lookup/lookup-kinds';
import { clientService } from '@/modules/clients/service/client.service';
import { createClientSchema } from '@/modules/clients/schemas/client.schema';
import { expenseCategoryService } from '@/modules/expense-categories/service/expense-category.service';
import { createExpenseCategorySchema } from '@/modules/expense-categories/schemas/expense-category.schema';
import { lookupService } from '@/modules/lookup/service/lookup.service';
import { createLookupItemSchema } from '@/modules/lookup/schemas/lookup.schema';
import { routeService } from '@/modules/routes/service/route.service';
import { createRouteSchema } from '@/modules/routes/schemas/route.schema';
import { supplierService } from '@/modules/suppliers/service/supplier.service';
import { createSupplierSchema } from '@/modules/suppliers/schemas/supplier.schema';
import { vehicleService } from '@/modules/vehicles/service/vehicle.service';
import { createVehicleSchema } from '@/modules/vehicles/schemas/vehicle.schema';
import { prisma } from '@/lib/db/prisma';
import { cell, defineImporter, optionalCell } from '../define-importer';
import type { EntityImporter } from '../importer';

const yesNo = (value: string | undefined): string =>
  value === undefined || /^(s[ií]|y(es)?|true|1|activ)/i.test(value) ? 'true' : 'false';

export const clientImporter: EntityImporter = defineImporter({
  entity: 'client',
  sheet: 'tblClientes',
  refKind: 'client',
  schema: createClientSchema,
  async loadExisting() {
    const rows = await prisma.client.findMany({ select: { name: true } });
    return new Set(rows.map((row) => row.name.trim().toLowerCase()));
  },
  naturalKey: (row) => cell(row, 'name').toLowerCase(),
  providedKeys: (rows) => rows.map((row) => ({ kind: 'client', key: cell(row, 'name') })),
  map: (row) => ({
    value: {
      name: cell(row, 'name'),
      taxId: optionalCell(row, 'taxId'),
      isActive: yesNo(optionalCell(row, 'isActive')),
    },
    errors: [],
  }),
  create: (input, ctx) => clientService.create(ctx.actor, input),
});

export const supplierImporter: EntityImporter = defineImporter({
  entity: 'supplier',
  sheet: 'tblProveedores',
  refKind: 'supplier',
  schema: createSupplierSchema,
  async loadExisting() {
    const rows = await prisma.supplier.findMany({ select: { name: true } });
    return new Set(rows.map((row) => row.name.trim().toLowerCase()));
  },
  naturalKey: (row) => cell(row, 'name').toLowerCase(),
  providedKeys: (rows) => rows.map((row) => ({ kind: 'supplier', key: cell(row, 'name') })),
  map: (row) => ({
    value: {
      name: cell(row, 'name'),
      taxId: optionalCell(row, 'taxId'),
      isActive: yesNo(optionalCell(row, 'isActive')),
    },
    errors: [],
  }),
  create: (input, ctx) => supplierService.create(ctx.actor, input),
});

export const expenseCategoryImporter: EntityImporter = defineImporter({
  entity: 'expenseCategory',
  sheet: 'tblCategoriasGasto',
  refKind: 'expenseCategory',
  schema: createExpenseCategorySchema,
  async loadExisting() {
    const rows = await prisma.expenseCategory.findMany({ select: { name: true } });
    return new Set(rows.map((row) => row.name.trim().toLowerCase()));
  },
  naturalKey: (row) => cell(row, 'name').toLowerCase(),
  providedKeys: (rows) => rows.map((row) => ({ kind: 'expenseCategory', key: cell(row, 'name') })),
  map: (row) => ({
    value: {
      name: cell(row, 'name'),
      expenseType: cell(row, 'expenseType').toUpperCase(),
      defaultVatRate: (optionalCell(row, 'defaultVatRate') ?? 'STANDARD').toUpperCase(),
      isActive: yesNo(optionalCell(row, 'isActive')),
    },
    errors: [],
  }),
  create: (input, ctx) => expenseCategoryService.create(ctx.actor, input),
});

/**
 * One importer per lookup kind. The sheet name is the kind, so `99_Listas`'s
 * "Tipos de combustible" tab is exported as `lookup:FUEL_TYPE`.
 */
export const lookupImporters: EntityImporter[] = LOOKUP_KINDS.map((kind: LookupKind) =>
  defineImporter({
    entity: `lookup:${kind}`,
    sheet: `lookup:${kind}`,
    refKind: `lookup:${kind}`,
    schema: createLookupItemSchema,
    async loadExisting() {
      const rows = await prisma.lookupItem.findMany({ where: { kind }, select: { name: true } });
      return new Set(rows.map((row) => row.name.trim().toLowerCase()));
    },
    naturalKey: (row) => cell(row, 'name').toLowerCase(),
    providedKeys: (rows) =>
      rows.map((row) => ({ kind: `lookup:${kind}` as const, key: cell(row, 'name') })),
    map: (row) => ({
      value: { name: cell(row, 'name'), isActive: yesNo(optionalCell(row, 'isActive')) },
      errors: [],
    }),
    create: (input, ctx) => lookupService.create(ctx.actor, kind, input),
  }),
);

export const vehicleImporter: EntityImporter = defineImporter({
  entity: 'vehicle',
  sheet: 'tblVehiculos',
  refKind: 'vehicle',
  schema: createVehicleSchema,
  async loadExisting() {
    const rows = await prisma.vehicle.findMany({ select: { registrationPlate: true } });
    return new Set(rows.map((row) => row.registrationPlate.trim().toLowerCase()));
  },
  naturalKey: (row) => cell(row, 'registrationPlate').toLowerCase().replace(/\s+/g, ' '),
  providedKeys: (rows) =>
    rows.map((row) => ({ kind: 'vehicle', key: cell(row, 'registrationPlate') })),
  map: (row) => ({
    value: {
      registrationPlate: cell(row, 'registrationPlate'),
      referenceName: optionalCell(row, 'referenceName'),
      isActive: yesNo(optionalCell(row, 'isActive')),
    },
    errors: [],
  }),
  create: (input, ctx) => vehicleService.create(ctx.actor, input),
});

export const routeImporter: EntityImporter = defineImporter({
  entity: 'route',
  sheet: 'tblContratos',
  refKind: 'route',
  schema: createRouteSchema,
  async loadExisting() {
    const rows = await prisma.route.findMany({ select: { code: true } });
    return new Set(rows.map((row) => row.code.trim().toLowerCase()));
  },
  naturalKey: (row) => cell(row, 'code').toLowerCase(),
  providedKeys: (rows) => rows.map((row) => ({ kind: 'route', key: cell(row, 'code') })),
  map: (row, resolve) => {
    const errors: string[] = [];
    const clientName = optionalCell(row, 'client');
    let clientId: string | undefined;
    if (clientName !== undefined) {
      const resolved = resolve.resolve('client', clientName);
      if (resolved === null) errors.push(`client "${clientName}" is not in tblClientes`);
      else clientId = resolved;
    }
    return {
      value: {
        code: cell(row, 'code'),
        name: cell(row, 'name'),
        origin: cell(row, 'origin'),
        destination: cell(row, 'destination'),
        defaultRate: optionalCell(row, 'defaultRate') ?? '',
        clientId: clientId ?? '',
        isActive: yesNo(optionalCell(row, 'isActive')),
      },
      errors,
    };
  },
  create: (input, ctx) => routeService.create(ctx.actor, input),
});
