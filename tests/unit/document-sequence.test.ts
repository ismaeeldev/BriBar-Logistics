/**
 * Document code formatting (ERP roadmap Phase 1).
 */
import { describe, expect, it } from 'vitest';

import { formatDocumentCode } from '@/modules/shared/domain/document-sequence';

describe('formatDocumentCode', () => {
  it('formats a refuelling code (R000046)', () => {
    expect(formatDocumentCode('R', 6, 46)).toBe('R000046');
  });

  it('formats a received-invoice code (FR000090)', () => {
    expect(formatDocumentCode('FR', 6, 90)).toBe('FR000090');
  });

  it('formats an issued-invoice code (FE000003)', () => {
    expect(formatDocumentCode('FE', 6, 3)).toBe('FE000003');
  });

  it('formats a tax-period code (T-00003)', () => {
    expect(formatDocumentCode('T-', 5, 3)).toBe('T-00003');
  });

  it('does not truncate a value wider than the padding', () => {
    expect(formatDocumentCode('R', 6, 1_234_567)).toBe('R1234567');
  });

  it('accepts a bigint, as nextval() returns', () => {
    expect(formatDocumentCode('R', 6, 46n)).toBe('R000046');
  });
});
