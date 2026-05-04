import { describe, it, expect } from 'vitest';
import { calcCommissionV2, calcCommissionV1, extractTableKey, type RateRow, type SaleInput } from '@/lib/commissionTriggerLogic';

const baseRate: RateRow = {
  effective_date: '2026-01-01',
  bank: 'FACTA',
  table_key: 'FACTA GOLD',
  term_min: 12,
  term_max: 24,
  min_value: 0,
  max_value: 100000,
  has_insurance: false,
  rate: 5,
};

const sale: SaleInput = {
  sale_date: '2026-04-01',
  product: 'FGTS',
  bank: 'facta',          // case-insensitive
  table_name: 'FACTA GOLD 24m',
  term: 18,
  released_value: 5000,
  has_insurance: false,
};

describe('extractTableKey', () => {
  it('detecta LOTUS 1+ a 5+', () => {
    expect(extractTableKey('Lotus 1+ promo')).toBe('LOTUS 1+');
    expect(extractTableKey('LOTUS 5+')).toBe('LOTUS 5+');
  });
  it('detecta FACTA GOLD vs GOLD PLUS', () => {
    expect(extractTableKey('FACTA GOLD PLUS 24m')).toBe('FACTA GOLD PLUS');
    expect(extractTableKey('FACTA GOLD')).toBe('FACTA GOLD');
  });
  it('detecta variações Paraná/Parana', () => {
    expect(extractTableKey('Paraná Turbo')).toBe('PARANA TURBO');
    expect(extractTableKey('Parana base')).toBe('PARANA');
  });
  it('null/empty', () => {
    expect(extractTableKey(null)).toBeNull();
    expect(extractTableKey('')).toBeNull();
  });
});

describe('calcCommissionV2 — fallback levels', () => {
  it('nível 1 specific — bank+table_key+term+value+insurance', () => {
    const r = calcCommissionV2(sale, [baseRate]);
    expect(r.match_level).toBe('specific');
    expect(r.rate).toBe(5);
    expect(r.commission_value).toBe(250);
  });

  it('nível 2 generic — table_key não casa, mas term/value sim', () => {
    const r = calcCommissionV2(
      { ...sale, table_name: 'TABELA ESTRANHA' },
      [{ ...baseRate, table_key: 'OUTRA' }],
    );
    expect(r.match_level).toBe('generic');
    expect(r.rate).toBe(5);
  });

  it('nível 3 fallback — só bank+insurance+date (V1 parity)', () => {
    const r = calcCommissionV2(sale, [{ ...baseRate, term_min: 60, term_max: 72 }]);
    expect(r.match_level).toBe('fallback');
    expect(r.rate).toBe(5);
  });

  it('nenhum match → none / 0', () => {
    const r = calcCommissionV2(sale, [{ ...baseRate, bank: 'OUTRO' }]);
    expect(r.match_level).toBe('none');
    expect(r.commission_value).toBe(0);
  });

  it('respeita has_insurance', () => {
    const r = calcCommissionV2({ ...sale, has_insurance: true }, [baseRate]);
    expect(r.match_level).toBe('none');
  });

  it('respeita data de vigência', () => {
    const r = calcCommissionV2(sale, [{ ...baseRate, effective_date: '2027-01-01' }]);
    expect(r.match_level).toBe('none');
  });

  it('escolhe a vigência mais recente', () => {
    const r = calcCommissionV2(sale, [
      { ...baseRate, effective_date: '2026-01-01', rate: 5 },
      { ...baseRate, effective_date: '2026-03-01', rate: 7 },
    ]);
    expect(r.rate).toBe(7);
    expect(r.commission_value).toBe(350);
  });

  it('case-insensitive bank', () => {
    const r = calcCommissionV2({ ...sale, bank: 'FaCtA' }, [{ ...baseRate, bank: 'facta' }]);
    expect(r.match_level).toBe('specific');
  });
});

describe('calcCommissionV1 — paridade simples', () => {
  it('aplica taxa por bank+insurance+date', () => {
    const r = calcCommissionV1(sale, [baseRate]);
    expect(r.rate).toBe(5);
    expect(r.commission_value).toBe(250);
  });
  it('zera quando nenhum match', () => {
    const r = calcCommissionV1(sale, [{ ...baseRate, bank: 'X' }]);
    expect(r.commission_value).toBe(0);
  });
});

describe('V1 vs V2 — divergências esperadas', () => {
  const rates: RateRow[] = [
    { ...baseRate, table_key: 'FACTA GOLD', rate: 6, term_min: 12, term_max: 24 },
    { ...baseRate, table_key: null,         rate: 4, term_min: 0,  term_max: 999 },
  ];
  it('V2 escolhe rate específica (6%) e V1 pega a última genérica (4%)', () => {
    const v2 = calcCommissionV2(sale, rates);
    const v1 = calcCommissionV1(sale, rates);
    expect(v2.rate).toBe(6);
    expect(v1.rate).toBe(4); // V1 não filtra por table_key
  });
});
