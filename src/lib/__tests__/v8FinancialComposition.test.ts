import { describe, it, expect } from 'vitest';
import { computeFinancialBreakdown } from '../v8FinancialComposition';

describe('computeFinancialBreakdown', () => {
  it('explica o caso reportado: 10.847 / 745,84 / 36', () => {
    const b = computeFinancialBreakdown(10847, 745.84, 36)!;
    expect(b).not.toBeNull();
    expect(b.totalPaid).toBeCloseTo(26850.24, 2);
    expect(b.totalInterest).toBeCloseTo(16003.24, 2);
    expect(b.markupPct).toBeGreaterThan(140);
    expect(b.markupPct).toBeLessThan(160);
    expect(b.monthlyRatePct).not.toBeNull();
    expect(b.monthlyRatePct!).toBeGreaterThan(3);
    expect(b.monthlyRatePct!).toBeLessThan(8);
  });

  it('retorna null para entradas inválidas', () => {
    expect(computeFinancialBreakdown(null, 100, 12)).toBeNull();
    expect(computeFinancialBreakdown(0, 100, 12)).toBeNull();
    expect(computeFinancialBreakdown(1000, -1, 12)).toBeNull();
    expect(computeFinancialBreakdown(1000, 100, 0)).toBeNull();
  });

  it('zero juros quando parcela * n == liberado', () => {
    const b = computeFinancialBreakdown(1200, 100, 12)!;
    expect(b.totalInterest).toBe(0);
    expect(b.monthlyRatePct).toBe(0);
  });
});
