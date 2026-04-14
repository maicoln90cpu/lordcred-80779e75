import { describe, it, expect } from 'vitest';
import { fmtBRL, formatDateBR, toDatetimeLocalBR, toBrasiliaTimestamp, cleanCurrency, parseExcelDate } from '@/components/commissions/commissionUtils';

describe('fmtBRL', () => {
  it('formats positive value', () => {
    const result = fmtBRL(1234.5);
    expect(result).toContain('1.234,50');
  });
  it('formats zero', () => {
    expect(fmtBRL(0)).toContain('0,00');
  });
});

describe('formatDateBR', () => {
  it('formats ISO date to BR', () => {
    const result = formatDateBR('2026-03-15T12:00:00Z');
    expect(result).toMatch(/15\/03\/2026/);
  });
  it('returns original on invalid', () => {
    expect(formatDateBR('invalid')).toBe('invalid');
  });
});

describe('toDatetimeLocalBR', () => {
  it('converts ISO to datetime-local format', () => {
    const result = toDatetimeLocalBR('2026-01-15T15:30:00Z');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
  it('handles invalid gracefully', () => {
    expect(toDatetimeLocalBR('bad')).toBe('bad');
  });
});

describe('toBrasiliaTimestamp', () => {
  it('appends -03:00 to naive datetime', () => {
    expect(toBrasiliaTimestamp('2026-01-15T10:00')).toBe('2026-01-15T10:00-03:00');
  });
  it('does not modify already-zoned value', () => {
    expect(toBrasiliaTimestamp('2026-01-15T10:00Z')).toBe('2026-01-15T10:00Z');
    expect(toBrasiliaTimestamp('2026-01-15T10:00-03:00')).toBe('2026-01-15T10:00-03:00');
  });
  it('returns empty string as-is', () => {
    expect(toBrasiliaTimestamp('')).toBe('');
  });
});

describe('cleanCurrency', () => {
  it('parses BR currency string', () => {
    expect(cleanCurrency('R$ 1.234,56')).toBeCloseTo(1234.56);
  });
  it('handles plain number', () => {
    expect(cleanCurrency(42)).toBe(42);
  });
  it('returns 0 for null/undefined', () => {
    expect(cleanCurrency(null)).toBe(0);
    expect(cleanCurrency(undefined)).toBe(0);
  });
});

describe('parseExcelDate', () => {
  it('returns null for empty', () => {
    expect(parseExcelDate(null)).toBeNull();
    expect(parseExcelDate('')).toBeNull();
  });
  it('parses BR date string', () => {
    const result = parseExcelDate('15/03/2026');
    expect(result).toBe('2026-03-15T12:00-03:00');
  });
  it('parses BR date with time', () => {
    const result = parseExcelDate('15/03/2026 14:30');
    expect(result).toBe('2026-03-15T14:30-03:00');
  });
  it('parses Date object', () => {
    const result = parseExcelDate(new Date(2026, 2, 15, 10, 30));
    expect(result).toContain('2026-03-15');
    expect(result).toContain('-03:00');
  });
});
