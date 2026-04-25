import { describe, it, expect } from 'vitest';
import {
  parseSmartRates,
  pairLabelsAndPercents,
  extractBank,
  extractTerm,
  extractValueRange,
  extractInsurance,
  looksLikePercent,
  parsePercent,
} from '../smartRateParser';

describe('looksLikePercent', () => {
  it('recognises BR and EN percent formats', () => {
    expect(looksLikePercent('16,00%')).toBe(true);
    expect(looksLikePercent('9.5%')).toBe(true);
    expect(looksLikePercent('  3 % ')).toBe(true);
  });
  it('rejects non-percent text', () => {
    expect(looksLikePercent('LOTUS 1+')).toBe(false);
    expect(looksLikePercent('250,00')).toBe(false);
  });
});

describe('parsePercent', () => {
  it('parses BR comma decimals', () => {
    expect(parsePercent('16,00%')).toBe(16);
    expect(parsePercent('9,5%')).toBeCloseTo(9.5);
  });
});

describe('extractBank', () => {
  it('matches multi-word banks before single-word ones', () => {
    expect(extractBank('PARANA BANCO acima de 250,00').bank).toBe('PARANA BANCO');
  });
  it('falls back to first token when bank is unknown', () => {
    expect(extractBank('XYZBANK Tabela A').bank).toBe('XYZBANK');
  });
});

describe('extractTerm', () => {
  it('parses "N anos"', () => {
    expect(extractTerm('GOLD PLUS 2 anos')).toEqual({ min: 2, max: 2, matched: '2 anos' });
  });
  it('parses "N+" notation', () => {
    expect(extractTerm('LOTUS 4+')).toEqual({ min: 4, max: 4, matched: '4+' });
  });
  it('returns null when no term info', () => {
    expect(extractTerm('SONHO')).toBeNull();
  });
});

describe('extractValueRange', () => {
  it('parses "até R$X"', () => {
    const r = extractValueRange('Carta na Manga até 250,00');
    expect(r?.min).toBe(0);
    expect(r?.max).toBe(250);
  });
  it('parses "acima de R$X"', () => {
    const r = extractValueRange('Carta na Manga acima de 250,00');
    expect(r?.min).toBe(250);
    expect(r?.max).toBe(999999999);
  });
});

describe('extractInsurance', () => {
  it('detects "com seguro" / "sem seguro"', () => {
    expect(extractInsurance('PARANA com seguro 2 anos').has).toBe(true);
    expect(extractInsurance('PARANA sem seguro 2 anos').has).toBe(false);
    expect(extractInsurance('LOTUS 1+').has).toBeNull();
  });
});

describe('pairLabelsAndPercents', () => {
  it('pairs label/percent across blank lines', () => {
    const text = 'LOTUS 1+\n\n16,00%\n\nHUB Sonho\n9,5%';
    const { pairs, orphans } = pairLabelsAndPercents(text);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toEqual({ label: 'LOTUS 1+', percent: '16,00%' });
    expect(orphans).toHaveLength(0);
  });
  it('captures orphan percent without label', () => {
    const { orphans } = pairLabelsAndPercents('16%');
    expect(orphans).toEqual(['16%']);
  });
});

describe('parseSmartRates — end-to-end', () => {
  it('parses a real-world FGTS list', () => {
    const text = [
      'LOTUS 1+',
      '16,00%',
      'HUB Sonho',
      '9,5%',
      'HUB Carta na Manga até 250,00',
      '2,75%',
      'HUB Carta na Manga acima de 250,00',
      '4,25%',
      'FACTA FGTS GOLD PLUS 2 anos',
      '6,35%',
      'PARANA com seguro 3 anos',
      '7,1%',
    ].join('\n');

    const { rates, warnings } = parseSmartRates(text);
    expect(warnings).toHaveLength(0);
    expect(rates).toHaveLength(6);

    expect(rates[0]).toMatchObject({ bank: 'LOTUS', rate: 16, term_min: 1, term_max: 1 });
    expect(rates[1]).toMatchObject({ bank: 'HUB', table_key: 'Sonho', rate: 9.5 });
    expect(rates[2]).toMatchObject({ bank: 'HUB', table_key: 'Carta na Manga', max_value: 250, rate: 2.75 });
    expect(rates[3]).toMatchObject({ bank: 'HUB', min_value: 250, max_value: 999999999, rate: 4.25 });
    expect(rates[4]).toMatchObject({ bank: 'FACTA', term_min: 2, term_max: 2, rate: 6.35 });
    expect(rates[5]).toMatchObject({ bank: 'PARANA', has_insurance: true, term_min: 3, term_max: 3, rate: 7.1 });
  });

  it('reports orphans as warnings without crashing', () => {
    const { rates, warnings } = parseSmartRates('LOTUS 1+\nHUB Sonho\n9,5%');
    expect(rates).toHaveLength(1);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
