/**
 * Fuel volume as integer millilitres (ERP roadmap Phase 1).
 */
import { describe, expect, it } from 'vitest';

import {
  isLitersAmount,
  litersToMilliliters,
  millilitersToInputValue,
  millilitersToLiters,
} from '@/lib/units/fuel';

describe('isLitersAmount', () => {
  it('accepts a whole number', () => {
    expect(isLitersAmount('11')).toBe(true);
  });

  it('accepts one decimal place, either separator', () => {
    expect(isLitersAmount('11.5')).toBe(true);
    expect(isLitersAmount('11,5')).toBe(true);
  });

  it('rejects more than one decimal place', () => {
    expect(isLitersAmount('11.55')).toBe(false);
  });

  it('rejects a negative amount', () => {
    expect(isLitersAmount('-11')).toBe(false);
  });

  it('rejects a non-numeric string', () => {
    expect(isLitersAmount('abc')).toBe(false);
  });
});

describe('litersToMilliliters', () => {
  it('converts a whole number', () => {
    expect(litersToMilliliters('11')).toBe(11_000);
  });

  it('converts one decimal place', () => {
    expect(litersToMilliliters('11.5')).toBe(11_500);
  });

  it('converts a comma decimal identically to the dot form', () => {
    expect(litersToMilliliters('11,5')).toBe(11_500);
  });
});

describe('millilitersToLiters / millilitersToInputValue', () => {
  it('round-trips through litersToMilliliters', () => {
    expect(millilitersToLiters(litersToMilliliters('11,5'))).toBe(11.5);
  });

  it('renders an editable value with a dot, not a comma', () => {
    expect(millilitersToInputValue(11_500)).toBe('11.5');
  });
});
