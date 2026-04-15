import { describe, expect, it } from 'vitest';
import { applySortToData, getComparableSortValue, type SortConfig } from '@/components/commission-reports/CRSortUtils';

describe('table sorting utils', () => {
  it('ordena strings numéricas corretamente', () => {
    const sort: SortConfig = { key: 'qty', dir: 'asc' };
    const data = [{ qty: '10' }, { qty: '2' }, { qty: '1' }];

    expect(applySortToData(data, sort).map((item) => item.qty)).toEqual(['1', '2', '10']);
  });

  it('ordena datas ISO em ordem cronológica', () => {
    const sort: SortConfig = { key: 'date', dir: 'desc' };
    const data = [
      { date: '2026-04-01T10:00:00Z' },
      { date: '2026-04-15T08:00:00Z' },
      { date: '2026-03-20T09:00:00Z' },
    ];

    expect(applySortToData(data, sort).map((item) => item.date)).toEqual([
      '2026-04-15T08:00:00Z',
      '2026-04-01T10:00:00Z',
      '2026-03-20T09:00:00Z',
    ]);
  });

  it('normaliza booleanos para comparação previsível', () => {
    expect(getComparableSortValue(true)).toBe(1);
    expect(getComparableSortValue(false)).toBe(0);
  });
});