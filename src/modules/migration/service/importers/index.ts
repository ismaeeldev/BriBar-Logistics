/**
 * Every importer, in dependency order (ERP roadmap Phase 7).
 *
 * Master data first — clients and suppliers before the invoices that name
 * them, lookup lists before anything that categorises against them, vehicles
 * and routes before the logs that reference them — then the transaction
 * sheets. `runImport` executes them in exactly this order.
 */
import type { EntityImporter } from '../importer';
import {
  clientImporter,
  expenseCategoryImporter,
  lookupImporters,
  routeImporter,
  supplierImporter,
  vehicleImporter,
} from './master-data';
import { dailyKmImporter, maintenanceImporter, personnelCostImporter } from './transactions';

/**
 * `receivedInvoice` (and `refuelling`, `issuedInvoice`, historical
 * `service`) are not here yet — their form services allocate the document
 * code (`FR000090`) or set the date server-side, so a faithful historical
 * import needs a repository-level path that preserves both, and the exact
 * column mapping needs the real `.xlsm`. See ADR 0018.
 */
export const ALL_IMPORTERS: EntityImporter[] = [
  ...lookupImporters,
  clientImporter,
  supplierImporter,
  expenseCategoryImporter,
  vehicleImporter,
  routeImporter,
  personnelCostImporter,
  dailyKmImporter,
  maintenanceImporter,
];
