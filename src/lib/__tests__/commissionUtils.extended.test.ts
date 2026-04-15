import { describe, it, expect } from 'vitest';
import {
  cleanCurrency,
  parseExcelDate,
  toBrasiliaTimestamp,
  DAY_NAMES,
} from '@/components/commissions/commissionUtils';

describe('cleanCurrency — edge cases', () => {
  it('handles string with only spaces', () => {
    expect(cleanCurrency('   ')).toBe(0);
  });
  it('handles "R$ 0,00"', () => {
    expect(cleanCurrency('R$ 0,00')).toBe(0);
  });
  it('handles negative BR format', () => {
    // "-1.234,56" → -1234.56
    expect(cleanCurrency('-1.234,56')).toBeCloseTo(-1234.56);
  });
  it('handles value with extra whitespace', () => {
    expect(cleanCurrency('  R$  500,00 ')).toBeCloseTo(500);
  });
  it('handles thousands without cents', () => {
    expect(cleanCurrency('1.000')).toBeCloseTo(1000);
  });
  it('handles integer string', () => {
    expect(cleanCurrency('42')).toBe(42);
  });
});

describe('parseExcelDate — edge cases', () => {
  it('parses date with dash separator', () => {
    const result = parseExcelDate('15-03-2026');
    expect(result).toBe('2026-03-15T12:00-03:00');
  });
  it('parses date with seconds', () => {
    const result = parseExcelDate('15/03/2026 14:30:45');
    expect(result).toBe('2026-03-15T14:30-03:00');
  });
  it('parses Excel serial number', () => {
    // 44927 is approx 2023-01-01 in Excel serial
    const result = parseExcelDate(44927);
    expect(result).not.toBeNull();
    expect(result).toContain('-03:00');
  });
  it('returns null for empty string', () => {
    expect(parseExcelDate('')).toBeNull();
  });
  it('returns null for undefined', () => {
    expect(parseExcelDate(undefined)).toBeNull();
  });
  it('returns null for garbage string', () => {
    expect(parseExcelDate('abc')).toBeNull();
  });
});

describe('toBrasiliaTimestamp — edge cases', () => {
  it('handles +00:00 offset', () => {
    expect(toBrasiliaTimestamp('2026-01-01T00:00+00:00')).toBe('2026-01-01T00:00+00:00');
  });
  it('handles -05:00 offset', () => {
    expect(toBrasiliaTimestamp('2026-01-01T00:00-05:00')).toBe('2026-01-01T00:00-05:00');
  });
});

describe('DAY_NAMES', () => {
  it('has 7 entries starting with Domingo', () => {
    expect(DAY_NAMES).toHaveLength(7);
    expect(DAY_NAMES[0]).toBe('Domingo');
    expect(DAY_NAMES[6]).toBe('Sábado');
  });
});
