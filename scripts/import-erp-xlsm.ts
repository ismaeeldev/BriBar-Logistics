/**
 * One-time historical import of the client's Excel ERP (roadmap Phase 7).
 *
 *     pnpm erp:import:xlsm ./ERP_Transporte_ANONIMIZADO.xlsm
 *
 * Reads the `.xlsm` directly (a tiny dependency-free reader below), maps every
 * sheet onto the app's schema, and writes it in one transaction. Idempotent:
 * master data is upserted on its natural key, and a transaction row whose
 * document code (or composite key) already exists is skipped, so a re-run
 * after a fix or an interrupted run does not duplicate anything.
 *
 * Unlike `scripts/import-erp.ts` (the generic JSON-bundle importer), this one
 * writes through Prisma directly rather than the form services — it has to,
 * to preserve the spreadsheet's own `S###`/`R###`/`FR###` codes and historical
 * dates, and to synthesise the odometer readings and clock times that
 * `01Servicios` never recorded but `services_mileage_sequence` /
 * `services_times_consistent` require. See ADR 0018.
 *
 * Refuses to touch a production database unless ERP_IMPORT_ALLOW_PROD=1 — the
 * cutover runbook (docs/erp-cutover-runbook.md) sets it deliberately.
 */
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@prisma/client';

import { applyVat, baseFromGross, type VatRate } from '../src/modules/shared/domain/vat';

// ---------------------------------------------------------------------------
// Minimal .xlsx/.xlsm reader (ZIP + SpreadsheetML), no dependencies.
// ---------------------------------------------------------------------------

function unzip(buf: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  // End-of-central-directory record.
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('not a zip file');
  let ptr = buf.readUInt32LE(eocd + 16);
  const count = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) break;
    const method = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOff = buf.readUInt32LE(ptr + 42);
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);
    // Local header: recompute data start.
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    files.set(name, method === 0 ? Buffer.from(raw) : inflateRawSync(raw));
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function colToNum(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function excelDateToISO(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}

type CellValue = string | number | boolean | null;
type Row = Record<string, CellValue>;

class Workbook {
  private readonly sst: string[] = [];
  private readonly dateStyle = new Set<number>();
  private readonly sheetXml = new Map<string, string>();

  constructor(path: string) {
    const files = unzip(readFileSync(path));
    const get = (p: string) => files.get(p)?.toString('utf8') ?? '';

    for (const m of get('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      const parts = [...(m[1] ?? '').matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1] ?? '');
      this.sst.push(decodeEntities(parts.join('')));
    }

    const styles = get('xl/styles.xml');
    const builtinDate = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57]);
    const customDate = new Set<number>();
    for (const m of styles.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"\/>/g)) {
      const code = m[2] ?? '';
      if (/(dd|mm|yy|yyyy|mmm|d\/|m\/)/i.test(code) && !/[#0]/.test(code.replace(/"[^"]*"/g, ''))) {
        customDate.add(+m[1]!);
      }
    }
    const cellXfs = styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? '';
    let xf = 0;
    for (const m of cellXfs.matchAll(/<xf [^>]*numFmtId="(\d+)"[^>]*?\/?>/g)) {
      const fid = +m[1]!;
      if (builtinDate.has(fid) || customDate.has(fid)) this.dateStyle.add(xf);
      xf++;
    }

    const rels = get('xl/_rels/workbook.xml.rels');
    const relMap = new Map<string, string>();
    for (const m of rels.matchAll(/<Relationship Id="(rId\d+)"[^>]*Target="(worksheets\/sheet\d+\.xml)"/g)) {
      relMap.set(m[1]!, m[2]!);
    }
    for (const m of get('xl/workbook.xml').matchAll(
      /<sheet name="([^"]+)" sheetId="\d+"(?: [^>]*)? r:id="(rId\d+)"\/>/g,
    )) {
      const target = relMap.get(m[2]!);
      if (target) this.sheetXml.set(m[1]!, get(`xl/${target}`));
    }
  }

  private cells(sheet: string): Map<number, Row> {
    const xml = this.sheetXml.get(sheet);
    if (!xml) throw new Error(`sheet not found: ${sheet}`);
    const rows = new Map<number, Row>();
    for (const rm of xml.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: Row = {};
      for (const cm of (rm[2] ?? '').matchAll(
        /<c r="([A-Z]+)\d+"(?: s="(\d+)")?(?: t="([^"]+)")?[^>]*?(?:\/>|>([\s\S]*?)<\/c>)/g,
      )) {
        const col = cm[1]!;
        const s = cm[2];
        const t = cm[3];
        const inner = cm[4] ?? '';
        let val: CellValue = null;
        if (t === 's') {
          const v = inner.match(/<v>(\d+)<\/v>/);
          val = v ? (this.sst[+v[1]!] ?? null) : null;
        } else if (t === 'str' || t === 'inlineStr') {
          const v = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/) ?? inner.match(/<v>([\s\S]*?)<\/v>/);
          val = v ? decodeEntities(v[1]!) : null;
        } else if (t === 'b') {
          val = inner.match(/<v>1<\/v>/) ? true : false;
        } else {
          const v = inner.match(/<v>([^<]*)<\/v>/);
          if (v) {
            const raw = v[1]!;
            const n = Number(raw);
            if (!Number.isNaN(n) && raw.trim() !== '') {
              val = s !== undefined && this.dateStyle.has(+s) ? excelDateToISO(n) : n;
            } else {
              val = decodeEntities(raw);
            }
          }
        }
        if (typeof val === 'string') val = val.trim();
        cells[col] = val;
      }
      rows.set(+(rm[1] ?? '0'), cells);
    }
    return rows;
  }

  /** A sheet as row objects keyed by the header row. */
  table(sheet: string, headerRow = 1): Row[] {
    const rows = this.cells(sheet);
    const header = rows.get(headerRow) ?? {};
    const cols = Object.keys(header).sort((a, b) => colToNum(a) - colToNum(b));
    const names = cols.map((c) => String(header[c] ?? c).trim());
    const maxRow = Math.max(...rows.keys());
    const out: Row[] = [];
    for (let r = headerRow + 1; r <= maxRow; r++) {
      const rc = rows.get(r);
      if (!rc) continue;
      const obj: Row = {};
      let any = false;
      cols.forEach((c, i) => {
        const v = rc[c] ?? null;
        if (v !== null && v !== '') any = true;
        obj[names[i] ?? c] = v;
      });
      if (any) out.push(obj);
    }
    return out;
  }

  /** A sheet as a raw {cellRef: value} grid, for the side-by-side lists. */
  grid(sheet: string): Map<number, Row> {
    return this.cells(sheet);
  }
}

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

type Cell = CellValue | undefined;

const deburr = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const str = (v: Cell): string => (v === null || v === undefined ? '' : String(v).trim());
const num = (v: Cell): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const cents = (v: Cell): number => Math.round((num(v) ?? 0) * 100);
const ml = (v: Cell): number => Math.round((num(v) ?? 0) * 1000);
const dbDate = (iso: Cell): Date => new Date(`${str(iso)}T00:00:00.000Z`);
const isIso = (v: Cell): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

const routeCode = (name: string) =>
  deburr(name).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) ||
  'RUTA';
const plate = (name: string) =>
  deburr(name).toUpperCase().replace(/[^A-Z0-9 -]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 32);
const loginId = (name: string) =>
  deburr(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);

function vatRateOf(v: Cell): VatRate {
  if (typeof v === 'string' && /exento|exent/i.test(v)) return 'EXEMPT';
  const n = num(v);
  if (n === null) return 'STANDARD';
  if (Math.abs(n - 0.21) < 0.005) return 'STANDARD';
  if (Math.abs(n - 0.1) < 0.005) return 'REDUCED';
  if (Math.abs(n - 0.04) < 0.005) return 'SUPER_REDUCED';
  if (n === 0) return 'ZERO';
  return 'STANDARD';
}

/** "Horas" in `00KmDiariosReales` — a plain hour count, sometimes a stray 0. */
function workedMinutes(v: Cell): number | null {
  if (isIso(v)) return null; // "1899-12-30" — a zero/blank time serial
  const n = num(v);
  if (n === null || n <= 0 || n > 24) return null;
  return Math.round(n * 60);
}

// A real Argon2id hash of a random string — imported staff cannot sign in
// until an administrator sets a real password (same choice as ADR 0018).
const UNUSABLE_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$3Y8vQeR2sK9wLmXpZaBcDg$k7Hn2QvJ4pR8sT1uW3xY5zA6bC9dE0fG2hI4jK6lM8o';

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

const SOURCE = 'ERP_Transporte_ANONIMIZADO.xlsm';

async function main() {
  const path = process.argv[2] ?? `./${SOURCE}`;
  const DATABASE_URL = process.env['DATABASE_URL'];
  if (!DATABASE_URL) throw new Error('DATABASE_URL is not set. Load the target environment first.');

  const isProd = process.env['NODE_ENV'] === 'production';
  if (isProd && process.env['ERP_IMPORT_ALLOW_PROD'] !== '1') {
    throw new Error('Refusing to import into production. Set ERP_IMPORT_ALLOW_PROD=1 to proceed.');
  }

  const wb = new Workbook(path);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

  try {
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true },
    });
    if (!admin) throw new Error('No active administrator. Run `pnpm db:seed` first.');
    const actorUserId = admin.id;

    const lists = wb.grid('99_Listas');
    const listCol = (letter: string, from: number, to: number) => {
      const out: string[] = [];
      for (let i = from; i <= to; i++) {
        const v = lists.get(i)?.[letter];
        if (v !== null && v !== undefined && String(v).trim() !== '') out.push(String(v).trim());
      }
      return out;
    };

    const services = wb.table('01Servicios');
    const refuellings = wb.table('02Repostajes');
    const receivedInvoices = wb.table('03Facturas_Recibidas');
    const personnel = wb.table('04_Personal').filter((r) => str(r['Empleado']) !== '');
    const issuedInvoices = wb.table('05Facturas_Emitidas');
    const maintenance = wb.table('08_Mantenimiento');
    const dailyKm = wb.table('00KmDiariosReales', 2).filter(
      (r) => isIso(r['Fecha']) && str(r['Vehículo']) !== '',
    );

    const created: Record<string, number> = {};

    // ---- master data (idempotent upserts, outside a transaction) --------
    const PSEUDO_VEHICLE = new Set(['Todos', 'Empresa', 'Todos ', '']);

    const vehicleByName = new Map<string, string>();
    const vehicleNames = new Set<string>(listCol('C', 2, 20));
    for (const rows of [services, refuellings, receivedInvoices, dailyKm, maintenance]) {
      for (const r of rows) {
        const v = str(r['Vehículo']);
        if (v && !PSEUDO_VEHICLE.has(v)) vehicleNames.add(v);
      }
    }
    for (const name of vehicleNames) {
      if (PSEUDO_VEHICLE.has(name)) continue;
      const v = await prisma.vehicle.upsert({
        where: { registrationPlate: plate(name) },
        create: { registrationPlate: plate(name), referenceName: name },
        update: {},
        select: { id: true },
      });
      vehicleByName.set(name, v.id);
    }

    const userByName = new Map<string, string>();
    userByName.set('Administrador', actorUserId);
    const driverNames = new Set<string>(listCol('D', 2, 20).filter((n) => n !== 'Administrador'));
    for (const rows of [services, refuellings, personnel, dailyKm]) {
      for (const r of rows) {
        const n = str(r['Conductor'] ?? r['Empleado']);
        if (n && n !== 'Administrador') driverNames.add(n);
      }
    }
    for (const name of driverNames) {
      const u = await prisma.user.upsert({
        where: { loginIdentifier: loginId(name) },
        create: { name, loginIdentifier: loginId(name), passwordHash: UNUSABLE_HASH, role: 'DRIVER' },
        update: {},
        select: { id: true },
      });
      userByName.set(name, u.id);
    }

    const clientByName = new Map<string, string>();
    for (const name of new Set([
      ...listCol('E', 2, 10),
      ...services.map((r) => str(r['Cliente'])).filter(Boolean),
      ...issuedInvoices.map((r) => str(r['Cliente'])).filter(Boolean),
    ])) {
      const existing = await prisma.client.findFirst({ where: { name }, select: { id: true } });
      clientByName.set(
        name,
        existing?.id ?? (await prisma.client.create({ data: { name }, select: { id: true } })).id,
      );
    }

    const supplierByName = new Map<string, string>();
    for (const name of new Set([
      ...listCol('J', 2, 40),
      ...receivedInvoices.map((r) => str(r['Proveedor'])).filter(Boolean),
    ])) {
      const existing = await prisma.supplier.findFirst({ where: { name }, select: { id: true } });
      supplierByName.set(
        name,
        existing?.id ?? (await prisma.supplier.create({ data: { name }, select: { id: true } })).id,
      );
    }

    const categoryByName = new Map<string, string>();
    const catTipo = new Map<string, string>();
    for (let i = 2; i <= 40; i++) {
      const name = str(lists.get(i)?.['K'] ?? null);
      if (name) catTipo.set(name, str(lists.get(i)?.['L'] ?? null));
    }
    for (const r of receivedInvoices) {
      const name = str(r['Categoría']);
      if (name && !catTipo.has(name)) catTipo.set(name, str(r['Tipo']));
    }
    const expenseTypeOf = (t: string): 'OPERATION' | 'INVESTMENT' | 'NON_OPERATING' =>
      /invers/i.test(t) ? 'INVESTMENT' : /no\s*oper/i.test(t) ? 'NON_OPERATING' : 'OPERATION';
    for (const [name, tipo] of catTipo) {
      if (!name) continue;
      const existing = await prisma.expenseCategory.findFirst({ where: { name }, select: { id: true } });
      const data = {
        name,
        expenseType: expenseTypeOf(tipo),
        defaultVatRate: /combust/i.test(name) ? ('REDUCED' as const) : ('STANDARD' as const),
      };
      categoryByName.set(
        name,
        existing?.id ?? (await prisma.expenseCategory.create({ data, select: { id: true } })).id,
      );
    }

    const lookup = new Map<string, string>();
    const seedLookup = async (
      kind: Prisma.LookupItemUncheckedCreateInput['kind'],
      names: string[],
    ) => {
      for (const name of new Set(names.map((n) => n.trim()).filter(Boolean))) {
        const existing = await prisma.lookupItem.findFirst({ where: { kind, name }, select: { id: true } });
        lookup.set(
          `${kind}:${name}`,
          existing?.id ?? (await prisma.lookupItem.create({ data: { kind, name }, select: { id: true } })).id,
        );
      }
    };
    await seedLookup('FUEL_TYPE', listCol('H', 2, 12));
    await seedLookup('PAYMENT_METHOD', [...listCol('I', 2, 8), ...listCol('O', 2, 8)]);
    await seedLookup('SUPPLEMENT_TYPE', listCol('T', 2, 12));
    await seedLookup('END_CLIENT', listCol('F', 2, 20));
    await seedLookup('GAS_STATION', listCol('G', 2, 12));
    await seedLookup('MAINTENANCE_TYPE', [
      ...listCol('X', 2, 12),
      ...maintenance.map((r) => str(r['Tipo'])).filter(Boolean),
    ]);
    await seedLookup('INVOICE_STATE', [...listCol('W', 2, 8), 'Pagada', 'Pendiente de pago']);

    const routeByName = new Map<string, string>();
    const tarifa = new Map<string, number>();
    for (let i = 2; i <= 10; i++) {
      const name = str(lists.get(i)?.['U'] ?? null);
      const rate = num(lists.get(i)?.['V'] ?? null);
      if (name && rate !== null) tarifa.set(name, rate);
    }
    const contractOD = new Map<string, { o: string; d: string }>();
    for (const r of services) {
      const c = str(r['Contrato']);
      if (c && !contractOD.has(c)) {
        contractOD.set(c, {
          o: str(r['Origen']) || 'Sin especificar',
          d: str(r['Destino']) || 'Sin especificar',
        });
      }
    }
    for (const name of new Set([
      ...listCol('B', 2, 12),
      ...services.map((r) => str(r['Contrato'])).filter(Boolean),
      ...dailyKm.map((r) => str(r['Contrato'])).filter(Boolean),
    ])) {
      const od = contractOD.get(name) ?? { o: 'Sin especificar', d: 'Sin especificar' };
      let rate = tarifa.get(name) ?? null;
      if (rate === null) {
        for (const [tn, tv] of tarifa) if (name.startsWith(tn) || tn.startsWith(name)) rate = tv;
      }
      const code = routeCode(name);
      const existing = await prisma.route.findFirst({ where: { code }, select: { id: true } });
      const data = {
        code,
        name,
        origin: od.o,
        destination: od.d,
        defaultRateCents: rate === null ? null : Math.round(rate * 100),
        clientId: clientByName.get('Cliente 01') ?? null,
      };
      routeByName.set(
        name,
        existing?.id ?? (await prisma.route.create({ data, select: { id: true } })).id,
      );
    }

    const cfg = wb.grid('99_Config');
    const cfgVal = (label: RegExp): number | null => {
      for (const row of cfg.values()) {
        if (typeof row['A'] === 'string' && label.test(row['A'])) return num(row['B'] ?? null);
      }
      return null;
    };
    await prisma.appConfig.update({
      where: { id: 'default' },
      data: {
        oilChangeIntervalKm: Math.round(cfgVal(/intervalo.*aceite/i) ?? 15000),
        defaultConsumptionMlPer100Km: Math.round((cfgVal(/consumo medio/i) ?? 11) * 1000),
        defaultFuelPriceCentsPerLiter: Math.round((cfgVal(/precio.*combustible/i) ?? 1.52) * 100),
      },
    });

    // ---- issued invoices (3 rows; services link to them) ---------------
    const invoiceByExtId = new Map<string, string>();
    for (const r of issuedInvoices) {
      const extId = str(r['ID Factura']);
      const code = str(r['Nº Factura']) || extId;
      if (!code) continue;
      const existing = await prisma.issuedInvoice.findFirst({
        where: { invoiceCode: code },
        select: { id: true },
      });
      if (existing) {
        invoiceByExtId.set(extId, existing.id);
        continue;
      }
      const baseCents = cents(r['Base imponible (€)']);
      const rate = vatRateOf(r['% IVA']);
      const { vatCents, totalCents } = applyVat(baseCents, rate);
      const stateName = str(r['Estado']);
      const inv = await prisma.issuedInvoice.create({
        data: {
          invoiceCode: code,
          clientId: clientByName.get(str(r['Cliente'])) ?? clientByName.get('Cliente 01')!,
          invoiceDate: dbDate(r['Fecha emisión']),
          baseCents,
          vatRate: rate,
          vatCents,
          totalCents,
          stateId: stateName ? (lookup.get(`INVOICE_STATE:${stateName}`) ?? null) : null,
          notes: str(r['Observaciones']) || null,
        },
        select: { id: true },
      });
      invoiceByExtId.set(extId, inv.id);
      created['issuedInvoices'] = (created['issuedInvoices'] ?? 0) + 1;
    }

    // ---- build the flat transaction rows ------------------------------
    const SERVICE_DEP = new Date('1970-01-01T08:00:00.000Z');
    const SERVICE_ARR = new Date('1970-01-01T16:00:00.000Z');

    const serviceRows: Prisma.ServiceCreateManyInput[] = [];
    for (const r of services) {
      const code = str(r['ID Servicio']);
      const vehicleId = vehicleByName.get(str(r['Vehículo']));
      const routeId = routeByName.get(str(r['Contrato']));
      if (!code || !vehicleId || !routeId) continue;
      const serviceKm = Math.max(1, Math.round(num(r['Km servicio']) ?? 0));
      const baseCents = cents(r['Base imponible (€)']);
      const suppCents = num(r['Imp. suplemento (€)']) === null ? null : cents(r['Imp. suplemento (€)']);
      const extInvId = str(r['ID Factura']);
      const invoiceId = extInvId ? (invoiceByExtId.get(extInvId) ?? null) : null;
      // Invoiced -> must be Approved (services_issued_invoice_requires_billable).
      const approved = invoiceId !== null || /factur|cobr|aprob/i.test(str(r['Estado']));
      serviceRows.push({
        serviceCode: code,
        serviceDate: dbDate(r['Fecha']),
        driverId: userByName.get(str(r['Conductor'])) ?? actorUserId,
        vehicleId,
        routeId,
        originSnapshot: (str(r['Origen']) || 'Sin especificar').slice(0, 160),
        destinationSnapshot: (str(r['Destino']) || 'Sin especificar').slice(0, 160),
        rateCents: baseCents - (suppCents ?? 0),
        supplementCents: suppCents,
        supplementTypeId: str(r['Tipo suplemento'])
          ? (lookup.get(`SUPPLEMENT_TYPE:${str(r['Tipo suplemento'])}`) ?? null)
          : null,
        baseCents,
        issuedInvoiceId: invoiceId,
        startDashboardKm: 0,
        startBaseKm: 0,
        endBaseKm: serviceKm,
        endDashboardKm: serviceKm,
        actualKm: serviceKm,
        serviceKm,
        departureTime: SERVICE_DEP,
        arrivalTime: SERVICE_ARR,
        endsNextDay: false,
        status: approved ? 'APPROVED' : 'PENDING_APPROVAL',
        approvedAt: approved ? dbDate(r['Fecha']) : null,
        approvedByUserId: approved ? actorUserId : null,
        observations: str(r['Observaciones']) || null,
      });
    }

    const lastOdo = new Map<string, number>();
    const refuelRows: Prisma.RefuellingCreateManyInput[] = [];
    for (const r of [...refuellings].sort((a, b) =>
      str(a['ID Repostaje']).localeCompare(str(b['ID Repostaje'])),
    )) {
      const code = str(r['ID Repostaje']);
      const vehName = str(r['Vehículo']);
      const vehicleId = vehicleByName.get(vehName);
      if (!code || !vehicleId) continue;
      let odo = num(r['Km Odómetro']);
      if (odo === null) odo = lastOdo.get(vehName) ?? 0;
      lastOdo.set(vehName, odo);
      const totalCents = cents(r['Importe total (€)']);
      const rate = vatRateOf(r['% IVA']);
      const b = baseFromGross(totalCents, rate);
      refuelRows.push({
        refuelCode: code,
        vehicleId,
        driverId: userByName.get(str(r['Conductor'])) ?? actorUserId,
        refuelDate: dbDate(r['Fecha']),
        odometerKm: Math.max(0, Math.round(odo)),
        litersMl: ml(r['Litros repostados']),
        totalCents,
        vatRate: rate,
        baseCents: b,
        vatCents: totalCents - b,
        fuelTypeId: str(r['Tipo de combustible'])
          ? (lookup.get(`FUEL_TYPE:${str(r['Tipo de combustible'])}`) ?? null)
          : null,
        gasStationId: str(r['Gasolinera'])
          ? (lookup.get(`GAS_STATION:${str(r['Gasolinera'])}`) ?? null)
          : null,
        paymentMethodId: str(r['Método pago'])
          ? (lookup.get(`PAYMENT_METHOD:${str(r['Método pago'])}`) ?? null)
          : null,
        notes: str(r['Observaciones']) || null,
      });
    }

    const receivedRows: Prisma.ReceivedInvoiceCreateManyInput[] = [];
    const skippedCreditNotes: string[] = [];
    for (const r of receivedInvoices) {
      const code = str(r['ID Factura']);
      const supplierId = supplierByName.get(str(r['Proveedor']));
      const categoryId = categoryByName.get(str(r['Categoría']));
      if (!code || !supplierId || !categoryId) continue;
      const baseCents = cents(r['Base imponible (€)']);
      if (baseCents < 0) {
        // "Abono" — a credit note the app doesn't model; importing it as a
        // positive expense would double-count the invoice it reverses.
        skippedCreditNotes.push(`${code} (${str(r['Concepto'])})`);
        continue;
      }
      const rate = vatRateOf(r['% IVA']);
      const { vatCents, totalCents } = applyVat(baseCents, rate);
      const vehName = str(r['Vehículo']);
      const paid = /^s[ií]/i.test(str(r['Pagada']));
      receivedRows.push({
        invoiceCode: code,
        supplierId,
        categoryId,
        vehicleId: PSEUDO_VEHICLE.has(vehName) ? null : (vehicleByName.get(vehName) ?? null),
        invoiceDate: dbDate(r['Fecha factura']),
        baseCents,
        vatRate: rate,
        vatCents,
        totalCents,
        stateId: lookup.get(`INVOICE_STATE:${paid ? 'Pagada' : 'Pendiente de pago'}`) ?? null,
        paymentMethodId: str(r['Forma de pago'])
          ? (lookup.get(`PAYMENT_METHOD:${str(r['Forma de pago'])}`) ?? null)
          : null,
        notes: [str(r['Concepto']), str(r['Observaciones'])].filter(Boolean).join(' — ') || null,
      });
    }

    // personnel — aggregated per (employee, year, month)
    const pByKey = new Map<
      string,
      { userId: string; year: number; month: number; base: number; ot: number; al: number; ot2: number; notes: string[] }
    >();
    for (const r of personnel) {
      const userId = userByName.get(str(r['Empleado']));
      const year = num(r['Año']);
      const month = num(r['Mes']);
      if (!userId || year === null || month === null) continue;
      const k = `${userId}|${year}|${month}`;
      let agg = pByKey.get(k);
      if (!agg) {
        agg = { userId, year, month, base: 0, ot: 0, al: 0, ot2: 0, notes: [] };
        pByKey.set(k, agg);
      }
      agg.base += cents(r['Coste real (€)']);
      agg.ot += cents(r['Horas extra (€)']);
      agg.al += cents(r['Dietas (€)']);
      agg.ot2 += cents(r['Otros (€)']);
      if (str(r['Observaciones'])) agg.notes.push(str(r['Observaciones']));
    }
    const personnelRows: Prisma.PersonnelCostCreateManyInput[] = [...pByKey.values()].map((p) => ({
      userId: p.userId,
      year: p.year,
      month: p.month,
      baseCents: p.base,
      overtimeCents: p.ot || null,
      allowancesCents: p.al || null,
      otherCents: p.ot2 || null,
      totalCents: p.base + p.ot + p.al + p.ot2,
      notes: p.notes.join(' — ') || null,
    }));

    // daily km — aggregated per (vehicle, date)
    const kmByKey = new Map<
      string,
      { vehicleId: string; date: string; km: number; minutes: number; routeId: string | null; driverId: string | null; notes: string[] }
    >();
    for (const r of dailyKm) {
      const vehicleId = vehicleByName.get(str(r['Vehículo']));
      const fecha = r['Fecha'];
      if (!vehicleId || !isIso(fecha)) continue;
      const k = `${vehicleId}|${fecha}`;
      let agg = kmByKey.get(k);
      if (!agg) {
        agg = {
          vehicleId,
          date: fecha,
          km: 0,
          minutes: 0,
          routeId: routeByName.get(str(r['Contrato'])) ?? null,
          driverId: userByName.get(str(r['Conductor'])) ?? null,
          notes: [],
        };
        kmByKey.set(k, agg);
      }
      agg.km += num(r['Km reales']) ?? 0;
      agg.minutes += workedMinutes(r['Horas']) ?? 0;
      if (str(r['Obs.'])) agg.notes.push(str(r['Obs.']));
    }
    const dailyKmRows: Prisma.DailyKmLogCreateManyInput[] = [...kmByKey.values()].map((k) => ({
      vehicleId: k.vehicleId,
      routeId: k.routeId,
      driverId: k.driverId,
      date: dbDate(k.date),
      actualKm: Math.round(k.km),
      workedMinutes: k.minutes || null,
      notes: k.notes.join(' — ') || null,
    }));

    const maintRows: Prisma.MaintenanceRecordCreateManyInput[] = [];
    for (const r of maintenance) {
      const code = str(r['ID Mantenimiento']);
      const perf = r['Fecha realización'];
      const vehicleId = vehicleByName.get(str(r['Vehículo']));
      const maintenanceTypeId = lookup.get(`MAINTENANCE_TYPE:${str(r['Tipo'])}`);
      if (!code || !isIso(perf) || !vehicleId || !maintenanceTypeId) continue;
      maintRows.push({
        maintenanceCode: code,
        vehicleId,
        maintenanceTypeId,
        performedDate: dbDate(perf),
        performedKm: num(r['Km realizacion']),
        nextDueKm: num(r['Próximo km']),
        nextDueDate: isIso(r['Próxima fecha']) ? dbDate(r['Próxima fecha']) : null,
        notes: str(r['Observaciones']) || null,
      });
    }

    // ---- one fast transaction: bulk inserts, skipDuplicates for re-runs
    const [svc, ref, rcv, prs, dkm, mnt] = await prisma.$transaction(
      [
        prisma.service.createMany({ data: serviceRows, skipDuplicates: true }),
        prisma.refuelling.createMany({ data: refuelRows, skipDuplicates: true }),
        prisma.receivedInvoice.createMany({ data: receivedRows, skipDuplicates: true }),
        prisma.personnelCost.createMany({ data: personnelRows, skipDuplicates: true }),
        prisma.dailyKmLog.createMany({ data: dailyKmRows, skipDuplicates: true }),
        prisma.maintenanceRecord.createMany({ data: maintRows, skipDuplicates: true }),
      ],
      { timeout: 60_000 },
    );
    created['services'] = svc.count;
    created['refuellings'] = ref.count;
    created['receivedInvoices'] = rcv.count;
    created['personnelCosts'] = prs.count;
    created['dailyKmLogs'] = dkm.count;
    created['maintenanceRecords'] = mnt.count;

    // ---- continue the document sequences past the spreadsheet's last --
    const seqAfter = async (seq: string, prefix: string, codes: string[]) => {
      const max = Math.max(
        0,
        ...codes.map((c) => Number(c.replace(new RegExp(`^${prefix}`), '')) || 0),
      );
      if (max > 0) await prisma.$executeRawUnsafe(`SELECT setval('${seq}', ${max}, true)`);
    };
    await seqAfter('service_code_seq', 'S', services.map((r) => str(r['ID Servicio'])));
    await seqAfter('refuelling_code_seq', 'R', refuellings.map((r) => str(r['ID Repostaje'])));
    await seqAfter('received_invoice_code_seq', 'FR', receivedInvoices.map((r) => str(r['ID Factura'])));
    await seqAfter('maintenance_code_seq', 'MT', maintenance.map((r) => str(r['ID Mantenimiento'])));

    // ---- audit: one CREATE row per entity type ------------------------
    const NIL = '00000000-0000-0000-0000-000000000000';
    const auditFor: Record<string, Prisma.AuditLogUncheckedCreateInput['entityType']> = {
      services: 'SERVICE',
      refuellings: 'REFUELLING',
      receivedInvoices: 'RECEIVED_INVOICE',
      issuedInvoices: 'ISSUED_INVOICE',
      personnelCosts: 'PERSONNEL_COST',
      dailyKmLogs: 'DAILY_KM_LOG',
      maintenanceRecords: 'MAINTENANCE_RECORD',
    };
    await prisma.auditLog.createMany({
      data: Object.entries(created)
        .filter(([k, n]) => n > 0 && auditFor[k])
        .map(([k, n]) => ({
          actorUserId,
          entityType: auditFor[k]!,
          entityId: NIL,
          action: 'CREATE' as const,
          afterData: { source: SOURCE, imported: n },
        })),
    });

    console.log(`Imported from ${SOURCE}\n`);
    console.log(`  master data: ${vehicleByName.size} vehicles, ${driverNames.size} drivers, ` +
      `${clientByName.size} clients, ${supplierByName.size} suppliers, ${categoryByName.size} categories, ` +
      `${lookup.size} list items, ${routeByName.size} routes`);
    const width = Math.max(...Object.keys(created).map((k) => k.length), 1);
    for (const [k, n] of Object.entries(created)) {
      console.log(`  ${k.padEnd(width)}  +${n}`);
    }
    if (skippedCreditNotes.length > 0) {
      console.log(`\n  skipped ${skippedCreditNotes.length} credit note(s) (negative amount, not modelled):`);
      for (const c of skippedCreditNotes) console.log(`    ${c}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
