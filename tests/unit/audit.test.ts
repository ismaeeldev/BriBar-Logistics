/**
 * Audit payload handling (SRS 19.9, 22.7).
 *
 * "Sensitive data such as password hashes must never be copied into audit
 * JSON." The audit table is append-only and is exactly what someone will later
 * be given read access to, so a leak here is permanent. These tests pin the
 * redaction rather than trusting every call site to remember.
 */
import { describe, expect, it } from 'vitest';

import { diffForAudit, redactAuditPayload } from '@/lib/audit/audit-service';

describe('redactAuditPayload', () => {
  it('removes a password hash', () => {
    expect(redactAuditPayload({ name: 'Ana', passwordHash: '$argon2id$v=19$...' })).toEqual({
      name: 'Ana',
      passwordHash: '[redacted]',
    });
  });

  it('matches the key however it is spelled', () => {
    const result = redactAuditPayload({
      password: 'a',
      password_hash: 'b',
      PasswordHash: 'c',
      newPassword: 'd',
      apiKey: 'e',
      sessionToken: 'f',
    }) as Record<string, unknown>;

    for (const value of Object.values(result)) {
      expect(value).toBe('[redacted]');
    }
  });

  it('leaves ordinary fields alone', () => {
    expect(redactAuditPayload({ actualKm: 100, status: 'APPROVED' })).toEqual({
      actualKm: 100,
      status: 'APPROVED',
    });
  });

  it('redacts inside nested objects and arrays', () => {
    const result = redactAuditPayload({
      user: { name: 'Ana', passwordHash: 'secret' },
      history: [{ token: 'abc' }],
    });

    expect(result).toEqual({
      user: { name: 'Ana', passwordHash: '[redacted]' },
      history: [{ token: '[redacted]' }],
    });
  });

  it('converts values JSONB cannot hold', () => {
    // `JSON.stringify` throws on a bigint and renders a Date inconsistently
    // depending on how it is reached, so both are normalised on the way in.
    const result = redactAuditPayload({
      when: new Date('2026-09-02T10:00:00.000Z'),
      sequence: 1247n,
    });

    expect(result).toEqual({ when: '2026-09-02T10:00:00.000Z', sequence: '1247' });
  });

  it('does not recurse without bound', () => {
    const cyclic: Record<string, unknown> = { name: 'root' };
    cyclic['self'] = cyclic;

    // A cycle would otherwise hang the request that triggered the audit write.
    expect(() => redactAuditPayload(cyclic)).not.toThrow();
  });
});

describe('diffForAudit', () => {
  it('returns only the fields that changed', () => {
    const result = diffForAudit(
      { actualKm: 100, serviceKm: 60, sites: null },
      { actualKm: 200, serviceKm: 60 },
    );

    // Storing whole rows would make every field look changed; narrowing is
    // what makes SRS 21.3's audited admin edits readable.
    expect(result).toEqual({ before: { actualKm: 100 }, after: { actualKm: 200 } });
  });

  it('returns null when nothing changed, so a no-op writes no audit row', () => {
    expect(diffForAudit({ actualKm: 100 }, { actualKm: 100 })).toBeNull();
  });

  it('compares dates by value rather than identity', () => {
    const before = new Date('2026-09-02T10:00:00.000Z');
    const after = new Date('2026-09-02T10:00:00.000Z');

    expect(diffForAudit({ when: before }, { when: after })).toBeNull();
  });

  it('detects a genuine date change', () => {
    expect(
      diffForAudit(
        { when: new Date('2026-09-02T10:00:00.000Z') },
        { when: new Date('2026-09-03T10:00:00.000Z') },
      ),
    ).not.toBeNull();
  });

  it('ignores fields absent from the update', () => {
    // A PATCH carries only what it changes; unmentioned fields are not
    // "changed to undefined".
    expect(diffForAudit({ a: 1, b: 2 }, { a: 1 })).toBeNull();
  });
});
