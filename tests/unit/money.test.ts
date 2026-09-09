/**
 * Money as integer cents (ERP roadmap Phase 0).
 */
import { describe, expect, it } from 'vitest';

import {
  centsToEuros,
  centsToInputValue,
  eurosToCents,
  formatEuros,
  isEurosAmount,
} from '@/lib/money/money';

describe('isEurosAmount', () => {
  it('accepts a whole number', () => {
    expect(isEurosAmount('180')).toBe(true);
  });

  it('accepts a dot decimal', () => {
    expect(isEurosAmount('180.50')).toBe(true);
  });

  it('accepts a comma decimal — the Spanish keyboard', () => {
    expect(isEurosAmount('180,50')).toBe(true);
  });

  it('accepts one decimal place', () => {
    expect(isEurosAmount('180.5')).toBe(true);
  });

  it('tolerates surrounding whitespace', () => {
    expect(isEurosAmount('  180  ')).toBe(true);
  });

  it('rejects more than two decimal places', () => {
    expect(isEurosAmount('180.505')).toBe(false);
  });

  it('rejects a negative amount', () => {
    expect(isEurosAmount('-180')).toBe(false);
  });

  it('rejects a non-numeric string', () => {
    expect(isEurosAmount('abc')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isEurosAmount('')).toBe(false);
  });
});

describe('eurosToCents', () => {
  it('converts a whole number', () => {
    expect(eurosToCents('180')).toBe(18000);
  });

  it('converts a dot decimal', () => {
    expect(eurosToCents('180.50')).toBe(18050);
  });

  it('converts a comma decimal identically to the dot form', () => {
    expect(eurosToCents('180,50')).toBe(18050);
  });

  it('rounds rather than truncates', () => {
    expect(eurosToCents('0.005')).toBe(1);
  });

  it('handles zero', () => {
    expect(eurosToCents('0')).toBe(0);
  });
});

describe('centsToEuros / centsToInputValue', () => {
  it('round-trips through eurosToCents', () => {
    expect(centsToEuros(eurosToCents('180,50'))).toBe(180.5);
  });

  it('renders an editable value with a dot, not a comma', () => {
    expect(centsToInputValue(18050)).toBe('180.5');
  });
});

describe('formatEuros', () => {
  // `Intl.NumberFormat` inserts a locale-specific space (often a non-breaking
  // one) before the symbol; normalising it is what makes this assertion
  // portable across Node/ICU versions rather than pinned to one build's data.
  const normalise = (s: string) => s.replace(/\s/g, ' ');

  it('formats with a comma decimal and a euro sign in Spanish', () => {
    expect(normalise(formatEuros(12345, 'es-ES'))).toBe('123,45 €');
  });

  it('formats with a dot decimal and a euro sign in English', () => {
    expect(normalise(formatEuros(12345, 'en-GB'))).toBe('€123.45');
  });
});
