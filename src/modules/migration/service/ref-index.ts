/**
 * Natural-key → id resolution for the importer (ERP roadmap Phase 7).
 *
 * The client's sheets reference each other by name, not id — a refuel names a
 * vehicle by its plate, an invoice names a supplier by its name. Every
 * importer resolves those the same way: against this index, which is
 * pre-loaded from whatever is *already* in the database (so a re-run, or an
 * import into a deployment that was partly set up by hand, resolves against
 * real records) and then extended by each importer as it creates rows, so a
 * later sheet can reference something an earlier sheet in the same run just
 * created.
 *
 * Lookups are case- and whitespace-insensitive on the key, because a hand-kept
 * spreadsheet is not: "Diésel" and "diésel " are the same fuel type.
 */
import type { LookupKind } from '@prisma/client';

import type { PrismaClientLike } from '@/lib/db/prisma';
import { prisma } from '@/lib/db/prisma';

export type RefKind =
  | 'vehicle'
  | 'route'
  | 'client'
  | 'supplier'
  | 'expenseCategory'
  | 'user'
  | 'service'
  | `lookup:${LookupKind}`;

function normalise(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, ' ');
}

export class RefIndex {
  private readonly maps = new Map<RefKind, Map<string, string>>();

  private mapFor(kind: RefKind): Map<string, string> {
    let map = this.maps.get(kind);
    if (!map) {
      map = new Map();
      this.maps.set(kind, map);
    }
    return map;
  }

  set(kind: RefKind, key: string, id: string): void {
    this.mapFor(kind).set(normalise(key), id);
  }

  get(kind: RefKind, key: string): string | undefined {
    return this.mapFor(kind).get(normalise(key));
  }

  has(kind: RefKind, key: string): boolean {
    return this.mapFor(kind).has(normalise(key));
  }

  /** Pre-populate from everything already in the database. */
  async load(client: PrismaClientLike = prisma): Promise<void> {
    const [vehicles, routes, clients, suppliers, categories, users, services, lookups] =
      await Promise.all([
        client.vehicle.findMany({ select: { id: true, registrationPlate: true } }),
        client.route.findMany({ select: { id: true, code: true } }),
        client.client.findMany({ select: { id: true, name: true } }),
        client.supplier.findMany({ select: { id: true, name: true } }),
        client.expenseCategory.findMany({ select: { id: true, name: true } }),
        client.user.findMany({ select: { id: true, name: true } }),
        client.service.findMany({ select: { id: true, serviceCode: true } }),
        client.lookupItem.findMany({ select: { id: true, kind: true, name: true } }),
      ]);

    for (const v of vehicles) this.set('vehicle', v.registrationPlate, v.id);
    for (const r of routes) this.set('route', r.code, r.id);
    for (const c of clients) this.set('client', c.name, c.id);
    for (const s of suppliers) this.set('supplier', s.name, s.id);
    for (const c of categories) this.set('expenseCategory', c.name, c.id);
    for (const u of users) this.set('user', u.name, u.id);
    for (const s of services) this.set('service', s.serviceCode, s.id);
    for (const l of lookups) this.set(`lookup:${l.kind}`, l.name, l.id);
  }
}
