/**
 * A small builder that removes the boilerplate every {@link EntityImporter}
 * shares (ERP roadmap Phase 7).
 *
 * The pattern is always: pull a natural key off the row; map the row's
 * spreadsheet columns to the shape the module's create-schema expects,
 * resolving any name references to ids along the way; run that **same
 * `createXSchema`** the form uses; on success hand the parsed input to the
 * module service. This captures that, so each importer is just its four
 * moving parts.
 */
import type { z } from 'zod';

import type { PrismaClientLike } from '@/lib/db/prisma';
import type { EntityImporter, PrepareResult, RawRow, Resolver, WriteContext } from './importer';
import type { RefIndex, RefKind } from './ref-index';

export interface MappingResult {
  /** The object to feed the module's create-schema. */
  value: Record<string, unknown>;
  /** Reference-resolution problems — a name that pointed at nothing. */
  errors: string[];
}

export interface ImporterSpec<Schema extends z.ZodTypeAny> {
  entity: string;
  sheet: string;
  /** The natural key this entity registers itself under, if any. */
  refKind?: RefKind;
  loadExisting(client: PrismaClientLike): Promise<Set<string>>;
  naturalKey(row: RawRow): string;
  providedKeys?(rows: RawRow[]): { kind: RefKind; key: string }[];
  schema: Schema;
  map(row: RawRow, resolve: Resolver): MappingResult;
  create(input: z.output<Schema>, ctx: WriteContext): Promise<{ id: string }>;
}

/** Reads a required trimmed string cell; throws if absent (caught by the engine). */
export function cell(row: RawRow, key: string): string {
  const value = row[key];
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

/** Reads an optional cell as `undefined` when blank. */
export function optionalCell(row: RawRow, key: string): string | undefined {
  const value = cell(row, key);
  return value === '' ? undefined : value;
}

export function defineImporter<Schema extends z.ZodTypeAny>(
  spec: ImporterSpec<Schema>,
): EntityImporter {
  return {
    entity: spec.entity,
    sheet: spec.sheet,

    loadExisting: spec.loadExisting,

    extract(bundle) {
      const rows = bundle[spec.sheet];
      return Array.isArray(rows) ? (rows as RawRow[]) : [];
    },

    naturalKey: spec.naturalKey,

    providedKeys(bundle) {
      if (!spec.providedKeys) return [];
      const rows = this.extract(bundle);
      return spec.providedKeys(rows);
    },

    prepare(row, resolve): PrepareResult {
      const mapped = spec.map(row, resolve);
      const parsed = spec.schema.safeParse(mapped.value);

      const errors = [...mapped.errors];
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const path = issue.path.join('.') || '(row)';
          errors.push(`${path}: ${issue.message}`);
        }
      }

      if (errors.length > 0) return { ok: false, errors };
      return { ok: true, errors: [], prepared: parsed.data };
    },

    async write(prepared, ctx) {
      const { id } = await spec.create(prepared as z.output<Schema>, ctx);
      return id;
    },

    register(refs: RefIndex, naturalKey, id) {
      if (spec.refKind) refs.set(spec.refKind, naturalKey, id);
    },
  };
}
