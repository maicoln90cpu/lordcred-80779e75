import { describe, it, expect } from 'vitest';
import { parseClipboardText, looksLikeDateValue } from '../clipboardParser';

describe('looksLikeDateValue', () => {
  it('detects BR date format', () => {
    expect(looksLikeDateValue('01/02/2026')).toBe(true);
    expect(looksLikeDateValue('1-2-26')).toBe(true);
  });
  it('rejects non-date text', () => {
    expect(looksLikeDateValue('Nome')).toBe(false);
    expect(looksLikeDateValue('Banco')).toBe(false);
  });
});

describe('parseClipboardText', () => {
  it('parses TSV with headers', () => {
    const raw = 'Nome\tValor\nJoão\t100\nMaria\t200';
    const result = parseClipboardText(raw);
    expect(result.headers).toEqual(['Nome', 'Valor']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].Nome).toBe('João');
    expect(result.format).toContain('TSV');
  });

  it('parses CSV with semicolons', () => {
    const raw = 'Nome;Valor\nJoão;100';
    const result = parseClipboardText(raw);
    expect(result.headers).toEqual(['Nome', 'Valor']);
    expect(result.rows).toHaveLength(1);
    expect(result.format).toContain('semicolon');
  });

  it('detects headerless data when first cell is a date', () => {
    const raw = '01/02/2026\tJoão\t100';
    const result = parseClipboardText(raw, ['Data', 'Nome', 'Valor']);
    expect(result.headers).toEqual(['Data', 'Nome', 'Valor']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].Data).toBe('01/02/2026');
    expect(result.format).toContain('sem cabeçalho');
  });

  it('handles quoted fields with embedded newlines', () => {
    const raw = 'Nome\tObs\nJoão\t"linha1\nlinha2"';
    const result = parseClipboardText(raw);
    expect(result.rows[0].Obs).toBe('linha1\nlinha2');
  });

  it('returns empty for blank input', () => {
    const result = parseClipboardText('');
    expect(result.rows).toHaveLength(0);
  });

  it('skips empty rows', () => {
    const raw = 'A\tB\nX\tY\n\t\nZ\tW';
    const result = parseClipboardText(raw);
    expect(result.rows).toHaveLength(2);
    expect(result.emptyLines).toBe(0);
  });
});
