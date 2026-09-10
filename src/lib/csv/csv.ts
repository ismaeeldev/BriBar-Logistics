/**
 * A minimal CSV serialiser — dependency-free (`docs/architecture.md`: the
 * dependency list stays deliberate).
 *
 * Used only by the Phase 7 snapshot export (`scripts/export-snapshot.ts`),
 * which produces one Excel-openable file per table as an audit safety net
 * during the first months after cutover (roadmap §3.6). RFC-4180 quoting:
 * a field is wrapped in double quotes when it contains a comma, a quote or a
 * newline, and embedded quotes are doubled.
 */

function quoteField(value: unknown): string {
  const text =
    value === null || value === undefined
      ? ''
      : value instanceof Date
        ? value.toISOString()
        : String(value);

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Serialises rows to CSV. Columns come from `headers` when given, else from
 * the union of keys across every row (stable in first-seen order).
 */
export function toCsv(rows: Record<string, unknown>[], headers?: string[]): string {
  const columns =
    headers ??
    [...rows.reduce((set, row) => {
      for (const key of Object.keys(row)) set.add(key);
      return set;
    }, new Set<string>())];

  const lines = [columns.map(quoteField).join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => quoteField(row[column])).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
